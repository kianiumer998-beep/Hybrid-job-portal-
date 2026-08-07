import React, { useState } from 'react';
import { Job, UserAccount, JobPostingFeeLog } from '../types/job';
import { X, Building2, MapPin, DollarSign, Clock, CheckCircle2, AlertCircle, Sparkles, User, ShieldCheck, Tag, FileText, Check, Ban } from 'lucide-react';

interface AdminJobDetailModalProps {
  job: Job | null;
  users: UserAccount[];
  feeLogs?: JobPostingFeeLog[];
  onClose: () => void;
  onApproveJob?: (jobId: string) => void;
  onRejectJob?: (jobId: string, reason: string) => void;
  onViewUserProfile?: (user: UserAccount) => void;
}

export const AdminJobDetailModal: React.FC<AdminJobDetailModalProps> = ({
  job,
  users,
  feeLogs = [],
  onClose,
  onApproveJob,
  onRejectJob,
  onViewUserProfile
}) => {
  if (!job) return null;

  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Find user who posted the job
  const posterUser = users.find(u => u.id === job.submittedByUserId) || {
    id: job.submittedByUserId || 'user-unknown',
    name: job.company || 'Job Poster',
    email: 'poster@jobportal.com',
    role: 'Employer / Unified Member',
    plan: 'Premium',
    autoRenew: true,
    createdAt: new Date().toISOString()
  } as UserAccount;

  // Find fee log associated with this job title/user
  const feeLog = feeLogs.find(
    f => f.jobTitle.toLowerCase() === job.title.toLowerCase() || (f.userId === posterUser.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 text-white animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 rounded border text-xs font-bold uppercase ${
                job.status === 'Approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : job.status === 'Rejected'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                Status: {job.status || 'Pending Verification'}
              </span>

              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                {job.jobType}
              </span>

              <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
                {job.region}
              </span>
            </div>

            <h2 className="text-2xl font-black text-white">{job.title}</h2>
            <div className="flex items-center space-x-3 text-sm text-slate-400 mt-1">
              <span className="text-emerald-400 font-bold">{job.company}</span>
              <span>•</span>
              <span className="text-white font-bold">{job.salary}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-sm text-slate-300">
          
          {/* POSTER & USER DETAIL LINK CARD */}
          <div className="p-4 bg-slate-950/90 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-amber-400">
                  {posterUser.name.charAt(0).toUpperCase()}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">Submitted By User</span>
                <button
                  type="button"
                  onClick={() => onViewUserProfile && onViewUserProfile(posterUser)}
                  className="font-bold text-white hover:text-amber-400 text-sm hover:underline cursor-pointer flex items-center space-x-1"
                >
                  <span>{posterUser.name}</span>
                  <User className="w-3.5 h-3.5 text-amber-400" />
                </button>
                <p className="text-xs text-slate-400 font-mono">{posterUser.email} • {posterUser.role || 'Unified Account'}</p>
              </div>
            </div>

            {onViewUserProfile && (
              <button
                type="button"
                onClick={() => onViewUserProfile(posterUser)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
              >
                🔍 Inspect Full User Profile
              </button>
            )}
          </div>

          {/* PER-JOB FEE STATUS */}
          {feeLog ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-emerald-300">Per-Job Posting Fee Paid:</span>
                <span className="font-mono text-white font-bold">{feeLog.currency} {feeLog.amount.toLocaleString()} via {feeLog.paymentMethod}</span>
              </div>
              <span className="text-slate-400 font-mono">{feeLog.dateTime}</span>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
              <span>Posting Fee Requirement: Standard Subscription / Free Queue</span>
              <span className="font-mono font-semibold text-slate-300">No Extra Fee Logged</span>
            </div>
          )}

          {/* Exact Location Breakdown */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs">
            <h4 className="font-bold uppercase text-slate-400">Location Breakdown</h4>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-emerald-400">Region: {job.region}</span>
              {job.province && <span className="text-slate-300">• Province: {job.province}</span>}
              {job.city && <span className="text-slate-300">• City: {job.city}</span>}
              {job.district && <span className="text-slate-300">• Area/District: {job.district}</span>}
            </div>
          </div>

          {/* Job Description */}
          <div>
            <h3 className="text-base font-bold text-white mb-2">Job Description</h3>
            <p className="leading-relaxed text-slate-300 whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800">
              {job.description}
            </p>
          </div>

          {/* Skills & Tags */}
          {job.tags && job.tags.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-2">Required Skills & Stack</h3>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-bold"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-2">Requirements</h3>
              <ul className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {job.requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {job.rejectionReason && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              <strong className="block font-bold mb-1">Rejection Reason Note:</strong>
              <p>{job.rejectionReason}</p>
            </div>
          )}

        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close Detail
          </button>

          <div className="flex items-center space-x-2">
            {onApproveJob && job.status !== 'Approved' && (
              <button
                onClick={() => {
                  onApproveJob(job.id);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Approve Job Now</span>
              </button>
            )}

            {onRejectJob && job.status !== 'Rejected' && (
              <div>
                {!showRejectInput ? (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/30 cursor-pointer flex items-center space-x-1"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Reject Job</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-medium"
                    />
                    <button
                      onClick={() => {
                        if (!rejectionReason.trim()) {
                          alert('Please specify a rejection reason.');
                          return;
                        }
                        onRejectJob(job.id, rejectionReason.trim());
                        onClose();
                      }}
                      className="px-3 py-2 bg-rose-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Confirm Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
