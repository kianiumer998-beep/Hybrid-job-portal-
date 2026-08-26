import React from 'react';
import { X, MapPin, Building2, Clock, CheckCircle2, Sparkles, Send, ShieldCheck, Share2, Bookmark } from 'lucide-react';
import { Job } from '../types/job';
import { sanitizeJob } from '../utils/jobSanitizer';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onApply: (job: Job) => void;
  isSaved: boolean;
  onToggleSave: (jobId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job: rawJob,
  onClose,
  onApply,
  isSaved,
  onToggleSave
}) => {
  if (!rawJob) return null;

  const job = sanitizeJob(rawJob);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                {job.jobType}
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                {job.experienceLevel} Level
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">{job.title}</h2>
            <div className="flex items-center space-x-3 text-sm text-slate-400 mt-1">
              <span className="text-slate-200 font-bold">{job.company}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{job.salary}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-sm text-slate-300">
          
          {/* Government Job Banner */}
          {job.isGovtJob && (
            <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-2 text-amber-200">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Government / Public Sector Position</span>
              </div>
              <div className="text-xs space-y-1">
                <div><strong>Department:</strong> {job.govtDepartment || 'Federal Public Service'}</div>
                <div><strong>Grade / Pay Scale:</strong> {job.govtScale || 'BPS Scale'}</div>
                <div><strong>Sector Classification:</strong> {job.govtCategory || 'Federal'} Sector</div>
              </div>
            </div>
          )}

          {/* Newspaper Clipping Image Preview */}
          {job.isNewspaperAd && job.clippingImageUrl && (
            <div className="p-4 bg-slate-950/90 border border-teal-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-teal-300">
                <span>📰 Official Newspaper Classified Ad Clipping</span>
                <span>{job.newspaperName} ({job.newspaperDate || 'Recent Edition'})</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-slate-800 bg-black max-h-64 flex justify-center">
                <img
                  src={job.clippingImageUrl}
                  alt="Newspaper Classified Ad Clipping"
                  className="object-cover max-h-64 w-full hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          )}

          {/* Detailed Location Breakdown */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Exact Location Details</h4>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-emerald-400">
                Region: {job.region}
              </span>
              {job.province && <span className="text-slate-400">• Province: {job.province}</span>}
              {job.city && <span className="text-slate-400">• City: {job.city}</span>}
              {job.district && <span className="text-slate-400">• District/Area: {job.district}</span>}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-base font-bold text-white mb-2">Job Description</h3>
            <p className="leading-relaxed text-slate-300 whitespace-pre-line">{job.description}</p>
          </div>

          {/* Key Tags */}
          <div>
            <h3 className="text-base font-bold text-white mb-2">Required Skills & Stack</h3>
            <div className="flex flex-wrap gap-2">
              {job.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div>
            <h3 className="text-base font-bold text-white mb-2">Requirements & Qualifications</h3>
            <ul className="space-y-2">
              {job.requirements.map((req, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Benefits */}
          {job.benefits && job.benefits.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-2">Perks & Compensation</h3>
              <ul className="space-y-2">
                {job.benefits.map((ben, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{ben}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-4">
          <button
            onClick={() => onToggleSave(job.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1.5 ${
              isSaved
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Bookmark className="w-4 h-4 fill-current" />
            <span>{isSaved ? 'Saved in Bookmarks' : 'Save Job'}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onApply(job);
            }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center space-x-2"
          >
            <Send className="w-4 h-4 text-slate-950" />
            <span>Apply Now</span>
          </button>
        </div>

      </div>
    </div>
  );
};
