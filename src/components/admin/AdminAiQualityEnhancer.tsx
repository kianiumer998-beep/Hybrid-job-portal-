import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Zap,
  Tag,
  DollarSign,
  FileText,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Job } from '../../types/job';
import { AiJobAuditReport } from '../../types/adminSuite';
import { INITIAL_AI_AUDIT_REPORTS } from '../../data/mockAdminSuiteData';

interface AdminAiQualityEnhancerProps {
  jobs?: Job[];
  pendingJobs?: Job[];
  onUpdateJob?: (updatedJob: Job) => void;
}

export const AdminAiQualityEnhancer: React.FC<AdminAiQualityEnhancerProps> = ({
  jobs = [],
  pendingJobs = [],
  onUpdateJob = (_updatedJob: Job) => {}
}) => {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safePendingJobs = Array.isArray(pendingJobs) ? pendingJobs : [];
  const allJobs = [...safePendingJobs, ...safeJobs];

  const [reports, setReports] = useState<Record<string, AiJobAuditReport>>(INITIAL_AI_AUDIT_REPORTS);
  const [selectedJobId, setSelectedJobId] = useState<string>(allJobs[0]?.id || '');
  const [isAuditing, setIsAuditing] = useState(false);
  const [filterScore, setFilterScore] = useState<'all' | 'needs-improvement' | 'high-quality'>('all');

  const activeJob = allJobs.find(j => j?.id === selectedJobId) || allJobs[0];
  const activeReport = (activeJob && reports[activeJob.id]) || {
    jobId: activeJob?.id || 'default',
    overallScore: 88,
    titleClarity: 90,
    salaryTransparency: 85,
    descriptionDepth: 86,
    seoKeywordDensity: 91,
    suggestedSalaryRange: activeJob?.salary || 'Market Competitive (Standard Scale)',
    suggestedTags: (activeJob?.tags && activeJob.tags.length > 0) ? activeJob.tags : ['Recruitment', 'Full-Time', 'Professional'],
    spamConfidenceScore: 4,
    grammarIssuesDetected: 0,
    enhancedDescriptionPreview: activeJob?.description || ''
  };

  const handleRunAiAuditOnJob = (job: Job) => {
    if (!job) return;
    setIsAuditing(true);
    setTimeout(() => {
      // Calculate realistic scores based on fields
      const hasSalary = job.salary && !job.salary.toLowerCase().includes('undisclosed');
      const hasTags = Array.isArray(job.tags) && job.tags.length >= 3;
      const descLength = (job.description || '').length;

      const titleClarity = (job.title || '').length > 8 ? 95 : 70;
      const salaryTransparency = hasSalary ? 92 : 60;
      const descriptionDepth = descLength > 200 ? 94 : 65;
      const seoKeywordDensity = hasTags ? 96 : 72;
      const overall = Math.round((titleClarity + salaryTransparency + descriptionDepth + seoKeywordDensity) / 4);

      const report: AiJobAuditReport = {
        jobId: job.id,
        overallScore: overall,
        titleClarity,
        salaryTransparency,
        descriptionDepth,
        seoKeywordDensity,
        suggestedSalaryRange: hasSalary ? job.salary : 'PKR 120,000 - 180,000 / mo (Market Benchmark)',
        suggestedTags: [
          ...(job.tags || []),
          job.jobType,
          job.region,
          job.experienceLevel
        ].filter((v, i, a) => a.indexOf(v) === i),
        spamConfidenceScore: overall > 80 ? 2 : 15,
        grammarIssuesDetected: descLength > 100 ? 0 : 2,
        enhancedDescriptionPreview: `🌟 Position Summary:\n${job.description}\n\n🎯 Key Performance Areas & Deliverables:\n• Spearhead technical roadmap execution and team collaboration\n• Ensure high standards of quality and operational rigor\n\n📌 Minimum Eligibility & Qualifications:\n${job.requirements?.map(r => `• ${r}`).join('\n') || '• Relevant academic background & experience'}`
      };

      setReports(prev => ({ ...prev, [job.id]: report }));
      setIsAuditing(false);
    }, 900);
  };

  const handleApplyAiEnhancement = () => {
    if (!activeJob || !activeReport) return;
    const updated: Job = {
      ...activeJob,
      tags: activeReport.suggestedTags || activeJob.tags,
      salary: activeReport.suggestedSalaryRange || activeJob.salary,
      description: activeReport.enhancedDescriptionPreview || activeJob.description
    };
    onUpdateJob(updated);
    alert(`✨ AI Enhancements successfully applied to "${activeJob.title}"!`);
  };

  return (
    <div className="space-y-6 text-white">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>AI Quality Auditor & Content Optimizer</span>
          </div>
          <h2 className="text-xl font-black text-white">Automated Listing Polish, SEO Tags & Spam Filter</h2>
          <p className="text-xs text-slate-400 mt-1">
            Deep scan job descriptions, compute readability/clarity scores, detect fraudulent postings, and re-format listings in 1-click.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleRunAiAuditOnJob(activeJob)}
          disabled={isAuditing}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
          <span>{isAuditing ? 'Auditing Listing...' : 'Scan Active Job with AI'}</span>
        </button>
      </div>

      {/* Grid: Job Selector on Left, AI Audit Report on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Job Selector List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl max-h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase text-slate-400">Select Vacancy to Audit ({allJobs.length})</h3>
            <span className="text-[10px] text-amber-400 font-mono font-bold">1-Click Scan</span>
          </div>

          <div className="space-y-2">
            {allJobs.map((job) => {
              const rep = reports[job.id];
              const score = rep?.overallScore || 85;
              const isSelected = job.id === selectedJobId;

              return (
                <div
                  key={job.id}
                  onClick={() => {
                    setSelectedJobId(job.id);
                    if (!reports[job.id]) {
                      handleRunAiAuditOnJob(job);
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-slate-800 border-amber-500 shadow-md'
                      : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white line-clamp-1">{job.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      score >= 90
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : score >= 75
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {score}/100
                    </span>
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

        {/* Right Column: Detailed AI Quality Diagnostic & 1-Click Fixer */}
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
                <p className="text-xs text-slate-400">{activeJob.company} • {activeJob.salary}</p>
              </div>

              {/* Overall Score Dial */}
              <div className="flex items-center space-x-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Quality Rating</span>
                  <span className="text-xs text-emerald-400 font-bold">
                    {activeReport.overallScore >= 90 ? '⭐⭐⭐⭐⭐ High Quality' : '⭐ Needs Enhancement'}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-amber-500 p-0.5 flex items-center justify-center font-black font-mono text-lg text-slate-950">
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-emerald-400">
                    {activeReport.overallScore}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Detailed Quality Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Title Clarity</span>
                <span className="text-base font-black font-mono text-white">{activeReport.titleClarity}%</span>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full" style={{ width: `${activeReport.titleClarity}%` }} />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Salary Clarity</span>
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
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Spam Risk</span>
                <span className="text-base font-black font-mono text-emerald-400">{activeReport.spamConfidenceScore}% (Safe)</span>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${activeReport.spamConfidenceScore}%` }} />
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              <h4 className="font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5 text-[11px]">
                <Zap className="w-3.5 h-3.5" />
                <span>AI Suggested Optimizations</span>
              </h4>

              <div className="space-y-2">
                <div>
                  <span className="font-bold text-slate-300">Recommended Salary Benchmark:</span>{' '}
                  <span className="font-mono text-emerald-400 font-bold">{activeReport.suggestedSalaryRange}</span>
                </div>

                <div>
                  <span className="font-bold text-slate-300 block mb-1">Optimized SEO Search Tags:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeReport.suggestedTags?.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-semibold border border-slate-700">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-300 block mb-1">Enhanced Markdown Description Preview:</span>
                  <div className="p-3 bg-slate-900 rounded-xl text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto border border-slate-800">
                    {activeReport.enhancedDescriptionPreview}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">Applies clean formatting and injects high-ranking search keywords.</span>
              <button
                type="button"
                onClick={handleApplyAiEnhancement}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Apply 1-Click AI Enhancements</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
