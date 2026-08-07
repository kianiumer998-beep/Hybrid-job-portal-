import React from 'react';
import { MapPin, Building2, Bookmark, Clock, DollarSign, Send, Eye, Sparkles, CheckCircle2, Globe, Shield } from 'lucide-react';
import { Job } from '../types/job';

interface JobListingsProps {
  jobs: Job[];
  savedJobIds: string[];
  onToggleSaveJob: (jobId: string) => void;
  onSelectJob: (job: Job) => void;
  onApplyClick: (job: Job) => void;
  isSubscribed: boolean;
}

export const JobListings: React.FC<JobListingsProps> = ({
  jobs,
  savedJobIds,
  onToggleSaveJob,
  onSelectJob,
  onApplyClick,
  isSubscribed
}) => {
  if (jobs.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center my-8">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
          <Building2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Matching Jobs Found</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          We couldn't find any job postings matching your specific search filters. Try resetting your filters or selecting a broader location.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
      {jobs.map((job) => {
        const isSaved = savedJobIds.includes(job.id);

        return (
          <div
            key={job.id}
            className="group relative bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/50 rounded-2xl p-5 shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              {/* Header Badges & Saved Button */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex flex-wrap gap-1.5">
                  {/* Job Type Badge */}
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                      job.jobType === 'Remote'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : job.jobType === 'Hybrid'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {job.jobType}
                  </span>

                  {/* Urgent / Featured Badges */}
                  {job.featured && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Featured</span>
                    </span>
                  )}
                  {job.urgent && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      Urgent Hiring
                    </span>
                  )}
                </div>

                {/* Bookmark Toggle */}
                <button
                  onClick={() => onToggleSaveJob(job.id)}
                  className={`p-2 rounded-xl transition-all ${
                    isSaved
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                  title={isSaved ? 'Remove from Saved Jobs' : 'Save Job'}
                >
                  <Bookmark className="w-4 h-4 fill-current" />
                </button>
              </div>

              {/* Job Title & Company */}
              <h3
                onClick={() => onSelectJob(job)}
                className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors cursor-pointer leading-snug line-clamp-2 mb-1"
              >
                {job.title}
              </h3>

              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-3">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-300 font-semibold">{job.company}</span>
                <span>•</span>
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{job.postedAt}</span>
              </div>

              {/* Location Badges (Province, City, District) */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 mb-4 space-y-1">
                <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-medium">
                  {job.region === 'Pakistan' ? (
                    <span className="text-emerald-400 font-bold">🇵🇰 Pakistan</span>
                  ) : job.region === 'US' ? (
                    <span>🇺🇸 United States</span>
                  ) : job.region === 'UK' ? (
                    <span>🇬🇧 United Kingdom</span>
                  ) : (
                    <span className="text-indigo-400 font-semibold">🌐 Global International</span>
                  )}

                  {job.province && (
                    <span className="text-slate-400">• {job.province}</span>
                  )}
                </div>

                {/* Detailed City/District Badges */}
                {(job.city || job.district) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {job.city && (
                      <span className="inline-flex items-center text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                        <MapPin className="w-3 h-3 mr-1 text-emerald-400" />
                        {job.city}
                      </span>
                    )}
                    {job.district && (
                      <span className="inline-flex items-center text-[11px] font-semibold bg-teal-500/15 text-teal-300 px-2 py-0.5 rounded border border-teal-500/20">
                        District: {job.district}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {job.tags.slice(0, 4).map((tag, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60"
                  >
                    {tag}
                  </span>
                ))}
                {job.tags.length > 4 && (
                  <span className="text-[10px] text-slate-500 self-center">
                    +{job.tags.length - 4} more
                  </span>
                )}
              </div>
            </div>

            {/* Salary & Action Buttons */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                  Salary Range
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  {job.salary}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onSelectJob(job)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="View Full Details"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onApplyClick(job)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 active:scale-95 transition-all"
                >
                  <Send className="w-3.5 h-3.5 text-slate-950" />
                  <span>Apply Now</span>
                </button>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
};
