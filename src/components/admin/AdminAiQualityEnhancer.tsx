import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  AlertCircle
} from 'lucide-react';
import { Job } from '../../types/job';
import { AiJobAuditReport } from '../../types/adminSuite';

export type JobUpdateOutcome =
  | { success: boolean; job?: Job; message?: string }
  | boolean
  | void;

interface AdminAiQualityEnhancerProps {
  jobs?: Job[];
  pendingJobs?: Job[];
  onUpdateJob?: (updatedJob: Job) => Promise<JobUpdateOutcome> | JobUpdateOutcome;
}

const SPAM_SIGNAL_KEYWORDS = [
  'earn money fast',
  'send processing fee',
  'guaranteed visa',
  'telegram only',
  'whatsapp fee'
];

export function evaluateRuleBasedJobQuality(job: Job): AiJobAuditReport {
  const cleanTitle = (job.title || '').trim();
  const cleanSalary = (job.salary || '').trim();
  const cleanDesc = (job.description || '').trim();
  const existingTags = Array.isArray(job.tags) ? job.tags.filter((t) => Boolean(t && String(t).trim())) : [];
  const requirements = Array.isArray(job.requirements)
    ? job.requirements.map((r) => String(r || '').trim()).filter(Boolean)
    : [];

  const hasSalary =
    cleanSalary.length > 0 &&
    !cleanSalary.toLowerCase().includes('undisclosed') &&
    !cleanSalary.toLowerCase().includes('not specified');
  const hasTags = existingTags.length >= 3;
  const descLength = cleanDesc.length;

  const titleClarity = cleanTitle.length >= 12 ? 95 : cleanTitle.length >= 6 ? 78 : 45;
  const salaryTransparency = hasSalary ? 92 : 40;
  const descriptionDepth = descLength >= 250 ? 94 : descLength >= 100 ? 74 : descLength > 0 ? 52 : 20;
  const seoKeywordDensity = hasTags ? 94 : existingTags.length > 0 ? 72 : 45;
  const overallScore = Math.round(
    (titleClarity + salaryTransparency + descriptionDepth + seoKeywordDensity) / 4
  );

  const lowerCombined = `${cleanTitle} ${cleanDesc}`.toLowerCase();
  const spamMatches = SPAM_SIGNAL_KEYWORDS.filter((kw) => lowerCombined.includes(kw));
  const spamConfidenceScore = Math.min(
    95,
    spamMatches.length * 30 + (cleanTitle.length < 4 ? 20 : 0) + (descLength < 30 ? 15 : 0)
  );

  const suggestedTags = Array.from(
    new Set(
      [...existingTags, job.jobType, job.region, job.experienceLevel]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    )
  );

  const sections: string[] = [];
  if (cleanDesc) {
    sections.push(`Position Overview:\n${cleanDesc.replace(/\n{3,}/g, '\n\n')}`);
  }
  if (requirements.length > 0) {
    sections.push(`Listed Requirements:\n${requirements.map((r) => `• ${r}`).join('\n')}`);
  }
  const enhancedDescriptionPreview =
    sections.length > 0 ? sections.join('\n\n') : cleanDesc || 'No existing description provided.';

  return {
    jobId: job.id,
    overallScore,
    titleClarity,
    salaryTransparency,
    descriptionDepth,
    seoKeywordDensity,
    suggestedSalaryRange: hasSalary
      ? cleanSalary
      : 'Not specified in listing — request verified salary range from poster',
    suggestedTags,
    spamConfidenceScore,
    grammarIssuesDetected: descLength >= 100 ? 0 : 1,
    enhancedDescriptionPreview
  };
}

export async function applyRuleBasedEnhancement(params: {
  activeJob: Job | undefined;
  activeReport: AiJobAuditReport | null;
  onUpdateJob?: (updatedJob: Job) => Promise<JobUpdateOutcome> | JobUpdateOutcome;
}): Promise<{ ok: boolean; updatedJob?: Job; message: string }> {
  const { activeJob, activeReport, onUpdateJob } = params;
  if (!activeJob) {
    return { ok: false, message: 'No job selected for update.' };
  }
  if (!activeReport) {
    return { ok: false, message: 'Run the rule-based audit before applying changes.' };
  }
  if (typeof onUpdateJob !== 'function') {
    return {
      ok: false,
      message: 'Job update callback is unavailable — changes cannot be persisted.'
    };
  }

  const nextDescription =
    (activeJob.description || '').trim().length > 0 || (activeJob.requirements || []).length > 0
      ? activeReport.enhancedDescriptionPreview
      : activeJob.description;

  // Preserve activeJob.id and all unrelated/factual fields; never overwrite missing salary with invented values
  const updatedJob: Job = {
    ...activeJob,
    id: activeJob.id,
    tags:
      activeReport.suggestedTags.length > 0
        ? activeReport.suggestedTags
        : activeJob.tags,
    description: nextDescription
  };

  try {
    const result = await onUpdateJob(updatedJob);
    const confirmed =
      result === true ||
      Boolean(result && typeof result === 'object' && (result as any).success === true);
    if (!confirmed) {
      const errMsg =
        result && typeof result === 'object' && typeof (result as any).message === 'string'
          ? (result as any).message
          : 'Job update could not be confirmed by the server.';
      return { ok: false, message: errMsg };
    }
    return {
      ok: true,
      updatedJob:
        result && typeof result === 'object' && (result as any).job
          ? (result as any).job
          : updatedJob,
      message: `Rule-based formatting and tags saved for "${activeJob.title}".`
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Unexpected error while saving job update.'
    };
  }
}

export const AdminAiQualityEnhancer: React.FC<AdminAiQualityEnhancerProps> = ({
  jobs = [],
  pendingJobs = [],
  onUpdateJob
}) => {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safePendingJobs = Array.isArray(pendingJobs) ? pendingJobs : [];
  const allJobs = [...safePendingJobs, ...safeJobs];

  const [reports, setReports] = useState<Record<string, AiJobAuditReport>>({});
  const [selectedJobId, setSelectedJobId] = useState<string>(allJobs[0]?.id || '');
  const [isAuditing, setIsAuditing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyStatus, setApplyStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (allJobs.length === 0) {
      setSelectedJobId('');
      return;
    }
    if (!allJobs.some((j) => j?.id === selectedJobId)) {
      setSelectedJobId(allJobs[0]?.id || '');
    }
  }, [allJobs.length, selectedJobId]);

  const activeJob = allJobs.find((j) => j?.id === selectedJobId) || allJobs[0];
  const activeReport: AiJobAuditReport | null = activeJob ? reports[activeJob.id] || null : null;
  const hasUpdateCallback = typeof onUpdateJob === 'function';

  const handleRunRuleAuditOnJob = (job?: Job) => {
    if (!job) return;
    setIsAuditing(true);
    setApplyStatus(null);
    const report = evaluateRuleBasedJobQuality(job);
    setReports((prev) => ({ ...prev, [job.id]: report }));
    setIsAuditing(false);
  };

  const handleApplyEnhancement = async () => {
    setIsApplying(true);
    setApplyStatus(null);
    const outcome = await applyRuleBasedEnhancement({
      activeJob,
      activeReport,
      onUpdateJob
    });
    setApplyStatus({
      type: outcome.ok ? 'success' : 'error',
      message: outcome.message
    });
    setIsApplying(false);
  };

  return (
    <div className="space-y-6 text-white">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Rule-Based Quality Analyzer</span>
          </div>
          <h2 className="text-xl font-black text-white">
            Deterministic Listing Quality Check, Tag Normalization &amp; Heuristic Review
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Evaluates existing job fields using deterministic rules (title length, salary presence, description depth, tags, and heuristic spam keywords). Does not call an external AI model or fabricate missing salary data.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleRunRuleAuditOnJob(activeJob)}
          disabled={isAuditing || !activeJob}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
          <span>{isAuditing ? 'Running Checks...' : 'Run Rule-Based Audit'}</span>
        </button>
      </div>

      {!hasUpdateCallback && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center space-x-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Job update handler is unavailable in this context. Auditing is read-only and applying changes is disabled.</span>
        </div>
      )}

      {applyStatus && (
        <div
          role={applyStatus.type === 'error' ? 'alert' : 'status'}
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center space-x-2 ${
            applyStatus.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}
        >
          {applyStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{applyStatus.message}</span>
        </div>
      )}

      {allJobs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400">
          No jobs available to analyze. Add or approve listings first to run rule-based quality checks.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Job Selector List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl max-h-[600px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase text-slate-400">Select Vacancy ({allJobs.length})</h3>
              <span className="text-[10px] text-amber-400 font-mono font-bold">Rule Scan</span>
            </div>

            <div className="space-y-2">
              {allJobs.map((job) => {
                const rep = reports[job.id];
                const isSelected = job.id === activeJob?.id;

                return (
                  <div
                    key={job.id}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setApplyStatus(null);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-slate-800 border-amber-500 shadow-md'
                        : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white line-clamp-1">{job.title}</span>
                      {rep ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                            rep.overallScore >= 85
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : rep.overallScore >= 65
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {rep.overallScore}/100
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 shrink-0">
                          Not scanned
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex justify-between">
                      <span>{job.company}</span>
                      <span className="font-mono text-slate-500">{job.region}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Rule-Based Diagnostic & Controlled Update */}
          {activeJob && (
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {activeJob.jobCategory || 'Corporate'}
                    </span>
                    {activeJob.isGovtJob && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Govt / {activeJob.govtScale || 'BPS'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">{activeJob.title}</h3>
                  <p className="text-xs text-slate-400">
                    {activeJob.company} • {activeJob.salary || 'Salary not specified'}
                  </p>
                </div>

                {activeReport ? (
                  <div className="flex items-center space-x-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Rule Score</span>
                      <span className="text-xs text-emerald-400 font-bold">
                        {activeReport.overallScore >= 85 ? 'High Completeness' : 'Needs Review'}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-amber-500 p-0.5 flex items-center justify-center font-black font-mono text-lg text-slate-950">
                      <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-emerald-400">
                        {activeReport.overallScore}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 px-3.5 py-2.5 rounded-2xl border border-slate-800 text-xs text-slate-400 font-semibold">
                    Not scanned yet
                  </div>
                )}
              </div>

              {!activeReport ? (
                <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-300">
                    No audit has been run for <strong>{activeJob.title}</strong> yet. Click{' '}
                    <strong>Run Rule-Based Audit</strong> to compute deterministic field scores and tag suggestions.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRunRuleAuditOnJob(activeJob)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
                  >
                    Run Rule-Based Audit
                  </button>
                </div>
              ) : (
                <>
                  {/* 4 Rule-Based Gauges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Title Length Check</span>
                      <span className="text-base font-black font-mono text-white">{activeReport.titleClarity}%</span>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full" style={{ width: `${activeReport.titleClarity}%` }} />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Salary Presence</span>
                      <span className="text-base font-black font-mono text-white">{activeReport.salaryTransparency}%</span>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full" style={{ width: `${activeReport.salaryTransparency}%` }} />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Description Depth</span>
                      <span className="text-base font-black font-mono text-white">{activeReport.descriptionDepth}%</span>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-400 h-full" style={{ width: `${activeReport.descriptionDepth}%` }} />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Heuristic Spam Flag</span>
                      <span
                        className={`text-base font-black font-mono ${
                          activeReport.spamConfidenceScore >= 30 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {activeReport.spamConfidenceScore}%
                      </span>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${activeReport.spamConfidenceScore}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Rule-Based Suggestions */}
                  <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                    <h4 className="font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5 text-[11px]">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Rule-Based Suggestions</span>
                    </h4>

                    <div className="space-y-2">
                      <div>
                        <span className="font-bold text-slate-300">Salary Field Check:</span>{' '}
                        <span className="font-mono text-emerald-400 font-bold">{activeReport.suggestedSalaryRange}</span>
                      </div>

                      <div>
                        <span className="font-bold text-slate-300 block mb-1">Normalized Search Tags (From Job Fields):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeReport.suggestedTags?.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-semibold border border-slate-700"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-slate-300 block mb-1">Formatted Existing Description Preview:</span>
                        <div className="p-3 bg-slate-900 rounded-xl text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto border border-slate-800">
                          {activeReport.enhancedDescriptionPreview}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">
                      Updates existing job record in-place (preserves job ID, company, and factual salary).
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyEnhancement}
                      disabled={!hasUpdateCallback || isApplying || !activeReport}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {isApplying
                          ? 'Saving Update...'
                          : !hasUpdateCallback
                          ? 'Update Unavailable'
                          : 'Apply Rule-Based Formatting & Tags'}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
