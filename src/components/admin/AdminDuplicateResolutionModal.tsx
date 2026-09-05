import React from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  GitMerge, 
  Copy, 
  Trash2, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  ArrowRight,
  Split
} from 'lucide-react';
import { Job } from '../../types/job';

interface AdminDuplicateResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  scrapedJob: Job;
  existingJob: Job;
  confidence: number;
  duplicateCategory: string;
  matchReason: string;
  comparisonDetails?: {
    titleSimilarity?: number;
    companySimilarity?: number;
    locationMatch?: boolean;
    salaryMatch?: boolean;
    sourceUrlMatch?: boolean;
    govtDetailsMatch?: boolean;
  };
  onKeepExisting: (scrapedId: string) => void;
  onReplaceExisting: (existingId: string, scrapedJob: Job) => void;
  onKeepBoth: (scrapedJob: Job) => void;
  onMergeJobs: (primaryId: string, secondaryId: string) => void;
  onDeleteScraped: (scrapedId: string) => void;
}

export const AdminDuplicateResolutionModal: React.FC<AdminDuplicateResolutionModalProps> = ({
  isOpen,
  onClose,
  scrapedJob,
  existingJob,
  confidence,
  duplicateCategory,
  matchReason,
  comparisonDetails,
  onKeepExisting,
  onReplaceExisting,
  onKeepBoth,
  onMergeJobs,
  onDeleteScraped
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl p-6 text-white my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-white">Duplicate Resolution Console</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {duplicateCategory || 'POSSIBLE DUPLICATE'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {confidence}% Confidence
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {matchReason || 'Multi-signal analysis detected significant overlap between the scraped record and existing database.'}
            </p>
          </div>
        </div>

        {/* Multi-Signal Breakdown Pill Tags */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6 text-[11px] font-semibold">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-slate-500 block">Title Overlap</span>
            <span className="text-amber-400 font-bold text-sm">
              {comparisonDetails?.titleSimilarity !== undefined ? `${comparisonDetails.titleSimilarity}%` : 'N/A'}
            </span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-slate-500 block">Company Similarity</span>
            <span className="text-amber-400 font-bold text-sm">
              {comparisonDetails?.companySimilarity !== undefined ? `${comparisonDetails.companySimilarity}%` : 'N/A'}
            </span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-slate-500 block">Location Match</span>
            <span className={`font-bold text-sm ${comparisonDetails?.locationMatch ? 'text-emerald-400' : 'text-slate-400'}`}>
              {comparisonDetails?.locationMatch ? 'Exact Match' : 'Different / None'}
            </span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-slate-500 block">Salary Match</span>
            <span className={`font-bold text-sm ${comparisonDetails?.salaryMatch ? 'text-emerald-400' : 'text-slate-400'}`}>
              {comparisonDetails?.salaryMatch ? 'Identical' : 'Different / Undisclosed'}
            </span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-slate-500 block">Source URL Match</span>
            <span className={`font-bold text-sm ${comparisonDetails?.sourceUrlMatch ? 'text-rose-400' : 'text-slate-400'}`}>
              {comparisonDetails?.sourceUrlMatch ? 'Identical URL' : 'Distinct'}
            </span>
          </div>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          
          {/* Existing Job Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Existing in Database (Status: {existingJob?.status || 'Live'})</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ID: {existingJob?.id}</span>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm">{existingJob?.title}</h4>
              <p className="text-xs text-amber-400 font-medium">{existingJob?.company}</p>
            </div>

            <div className="text-xs text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-xl">
              <div><span className="text-slate-500">Location:</span> {existingJob?.city || existingJob?.province || existingJob?.region}</div>
              <div><span className="text-slate-500">Salary:</span> {existingJob?.salary || 'Salary not disclosed'}</div>
              <div><span className="text-slate-500">Department:</span> {existingJob?.department || 'N/A'}</div>
              {existingJob?.sourceUrl && (
                <div className="truncate">
                  <span className="text-slate-500">Source:</span>{' '}
                  <a href={existingJob.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                    {existingJob.sourceUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-300 line-clamp-3 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
              {existingJob?.description}
            </div>
          </div>

          {/* Incoming Scraped Job Card */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-400 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Incoming Scraped Record</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ID: {scrapedJob?.id}</span>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm">{scrapedJob?.title}</h4>
              <p className="text-xs text-amber-400 font-medium">{scrapedJob?.company}</p>
            </div>

            <div className="text-xs text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-xl">
              <div><span className="text-slate-500">Location:</span> {scrapedJob?.city || scrapedJob?.province || scrapedJob?.region}</div>
              <div><span className="text-slate-500">Salary:</span> {scrapedJob?.salary || 'Salary not disclosed'}</div>
              <div><span className="text-slate-500">Scraper Source:</span> {scrapedJob?.scraperSourceName || 'External Feed'}</div>
              {scrapedJob?.sourceUrl && (
                <div className="truncate">
                  <span className="text-slate-500">Source:</span>{' '}
                  <a href={scrapedJob.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                    {scrapedJob.sourceUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-300 line-clamp-3 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
              {scrapedJob?.description}
            </div>
          </div>

        </div>

        {/* 5 Resolution Actions */}
        <div className="border-t border-slate-800 pt-5">
          <span className="text-xs font-semibold text-slate-400 block mb-3">Choose Resolution Action:</span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            
            {/* 1. Keep Existing */}
            <button
              onClick={() => {
                onKeepExisting(scrapedJob.id);
                onClose();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs active:scale-95 transition-all text-center border border-slate-700"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
              <span>Keep Existing</span>
              <span className="text-[9px] text-slate-400 font-normal">Discard incoming</span>
            </button>

            {/* 2. Replace Existing */}
            <button
              onClick={() => {
                onReplaceExisting(existingJob.id, scrapedJob);
                onClose();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs active:scale-95 transition-all text-center border border-amber-500/40"
            >
              <Copy className="w-4 h-4 text-amber-400 mb-1" />
              <span>Replace Existing</span>
              <span className="text-[9px] text-amber-200/70 font-normal">Overwrite old</span>
            </button>

            {/* 3. Keep Both */}
            <button
              onClick={() => {
                onKeepBoth(scrapedJob);
                onClose();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs active:scale-95 transition-all text-center border border-slate-700"
            >
              <Split className="w-4 h-4 text-indigo-400 mb-1" />
              <span>Keep Both</span>
              <span className="text-[9px] text-slate-400 font-normal">Allow dual entries</span>
            </button>

            {/* 4. Merge Jobs */}
            <button
              onClick={() => {
                onMergeJobs(existingJob.id, scrapedJob.id);
                onClose();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs active:scale-95 transition-all text-center shadow-lg shadow-emerald-500/20 border border-emerald-400/40"
            >
              <GitMerge className="w-4 h-4 text-white mb-1" />
              <span>Merge Intelligently</span>
              <span className="text-[9px] text-emerald-100 font-normal">Combine best fields</span>
            </button>

            {/* 5. Delete Scraped */}
            <button
              onClick={() => {
                onDeleteScraped(scrapedJob.id);
                onClose();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs active:scale-95 transition-all text-center border border-rose-500/40"
            >
              <Trash2 className="w-4 h-4 text-rose-400 mb-1" />
              <span>Delete Scraped</span>
              <span className="text-[9px] text-rose-300/70 font-normal">Purge from queue</span>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
};
