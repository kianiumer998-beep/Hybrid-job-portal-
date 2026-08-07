import React, { useState } from 'react';
import { UserAccount, Job, JobApplication } from '../types/job';
import { X, User, Lock, Mail, Phone, Building2, MapPin, Calendar, Clock, DollarSign, Key, Shield, CheckCircle2, Briefcase, FileText, Receipt, Sparkles, Edit3 } from 'lucide-react';

interface UserDetailModalProps {
  user: UserAccount | null;
  userJobs?: Job[];
  userApplications?: JobApplication[];
  onClose: () => void;
  onUpdateUserExpiry?: (userId: string, newExpiryDate: string) => void;
  onToggleUserPlan?: (userId: string) => void;
  onUpdateUserPassword?: (userId: string, newPassword: string) => void;
  onInspectJob?: (job: Job) => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  userJobs = [],
  userApplications = [],
  onClose,
  onUpdateUserExpiry,
  onToggleUserPlan,
  onUpdateUserPassword,
  onInspectJob
}) => {
  if (!user) return null;

  const [activeTab, setActiveTab] = useState<'info' | 'applications' | 'posted-jobs' | 'transactions'>('info');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [customExpiryInput, setCustomExpiryInput] = useState('');

  const handleAdminChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNewPassword.trim()) {
      alert('Please enter a valid new password.');
      return;
    }
    if (onUpdateUserPassword) {
      onUpdateUserPassword(user.id, adminNewPassword.trim());
      alert(`Password for ${user.name} has been updated successfully!`);
      setAdminNewPassword('');
    }
  };

  const applicationsList = user.appliedJobs && user.appliedJobs.length > 0 ? user.appliedJobs : userApplications;
  const postedJobsList = userJobs.filter(j => j.submittedByUserId === user.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 text-white animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-indigo-600 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-2xl text-amber-400">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-white">{user.name}</h2>
                <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                  {user.role || 'Unified Portal Member'}
                </span>
                <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                  {user.plan} Plan
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center space-x-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-mono text-slate-300 font-semibold">{user.email}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">ID: {user.id}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 bg-slate-950/50 px-6 pt-3 overflow-x-auto text-xs font-bold">
          {[
            { id: 'info', label: 'Full Profile & Security', icon: User },
            { id: 'applications', label: `Jobs Applied For (${applicationsList.length})`, icon: FileText },
            { id: 'posted-jobs', label: `Posted Jobs (${postedJobsList.length})`, icon: Briefcase },
            { id: 'transactions', label: `Payment History (${(user.transactions || []).length})`, icon: Receipt }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl transition-all whitespace-nowrap cursor-pointer border-t border-x ${
                  activeTab === t.id
                    ? 'bg-slate-900 text-amber-400 border-slate-800 font-extrabold'
                    : 'bg-slate-950/40 text-slate-400 hover:bg-slate-800/50 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-sm text-slate-300">

          {/* TAB 1: FULL PROFILE & SECURITY */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              
              {/* Profile Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Account Status</span>
                  <span className="font-bold text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Member</span>
                  </span>
                </div>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Activation Timestamp</span>
                  <span className="font-mono font-bold text-white">{user.activationDate || '2026-07-25 09:00'}</span>
                </div>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Subscription Expiry</span>
                  <span className="font-mono font-bold text-amber-400">{user.expiryDate || '2026-08-24 09:00'}</span>
                </div>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Renewal Cycles</span>
                  <span className="font-bold text-indigo-400">{user.renewalCount || 1} Times</span>
                </div>
              </div>

              {/* Personal Details Table */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Personal Profile Attributes</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Full Name</label>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl font-bold text-white">
                      {user.name}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1 flex items-center justify-between">
                      <span>Email Address (Fixed / Non-Editable)</span>
                      <Lock className="w-3 h-3 text-amber-400" />
                    </label>
                    <div className="p-2.5 bg-slate-900/60 border border-amber-500/30 rounded-xl font-mono text-amber-300 font-bold flex items-center justify-between">
                      <span>{user.email}</span>
                      <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-400 font-sans uppercase">Fixed</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Username</label>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl font-mono text-slate-200">
                      {user.username || user.email.split('@')[0]}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Phone Number</label>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl font-mono text-slate-200">
                      {user.phone || '+92 300 0000000'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Company / Organization</label>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl font-semibold text-slate-200">
                      {user.companyName || 'N/A (Individual Jobseeker)'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Current Address / Location</label>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200">
                      {user.address || 'Lahore, Punjab, Pakistan'}
                    </div>
                  </div>

                </div>

                {user.bio && (
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Professional Bio / Summary</label>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs leading-relaxed">
                      {user.bio}
                    </div>
                  </div>
                )}

                {user.customFieldsData && Object.keys(user.customFieldsData).length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <h4 className="text-xs font-bold text-slate-400 mb-2">Custom Field Entries</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(user.customFieldsData).map(([key, val]) => (
                        <div key={key} className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase block">{key}</span>
                          <span className="font-semibold text-white">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Subscription & Password Overrides */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>Admin Security & Subscription Management Controls</span>
                </h3>

                <div className="flex flex-wrap gap-2.5">
                  {onUpdateUserExpiry && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const currentExp = user.expiryDate || '2026-08-24 09:00';
                          const parts = currentExp.split(' ');
                          const dateParts = parts[0].split('-');
                          const d = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
                          d.setDate(d.getDate() + 30);
                          const newExp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${parts[1] || '09:00'}`;
                          onUpdateUserExpiry(user.id, newExp);
                          alert(`Extended ${user.name} by +30 days to ${newExp}`);
                        }}
                        className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-xs rounded-xl border border-emerald-500/40 transition-all cursor-pointer"
                      >
                        + Extend +30 Days
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onUpdateUserExpiry(user.id, '2020-01-01 00:00');
                          alert(`Subscription for ${user.name} revoked immediately.`);
                        }}
                        className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl border border-rose-500/40 transition-all cursor-pointer"
                      >
                        ⛔ Revoke Subscription
                      </button>
                    </>
                  )}

                  {onToggleUserPlan && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleUserPlan(user.id);
                        alert(`Toggled plan for ${user.name}`);
                      }}
                      className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white font-bold text-xs rounded-xl border border-indigo-500/40 transition-all cursor-pointer"
                    >
                      Toggle Plan ({user.plan === 'Premium' ? 'Free' : 'Premium'})
                    </button>
                  )}
                </div>

                {/* Change Password on behalf of user */}
                {onUpdateUserPassword && (
                  <form onSubmit={handleAdminChangePassword} className="pt-3 border-t border-slate-800 flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={adminNewPassword}
                        onChange={(e) => setAdminNewPassword(e.target.value)}
                        placeholder="Admin Set New User Password (e.g. 123456)"
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl cursor-pointer"
                    >
                      Update Password
                    </button>
                  </form>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: JOBS APPLIED FOR */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                All Jobs Applied For by {user.name}
              </h3>

              {applicationsList.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 italic">
                  No job applications recorded for this user yet.
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3">Job Title & Company</th>
                        <th className="p-3">Applied Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Payment Tier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {applicationsList.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-900/50">
                          <td className="p-3 font-medium">
                            <div className="font-bold text-white text-sm">{app.jobTitle}</div>
                            <div className="text-slate-400 text-[11px]">{app.companyName}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-300">{app.appliedAt}</td>
                          <td className="p-3 font-bold text-emerald-400">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[11px]">
                              {app.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-[10px]">
                              {app.paymentStatus || 'Subscription Paid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: POSTED JOBS */}
          {activeTab === 'posted-jobs' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                Jobs Posted by {user.name}
              </h3>

              {postedJobsList.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 italic">
                  This user has not submitted any job postings yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {postedJobsList.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-white text-sm">{job.title}</h4>
                        <p className="text-xs text-slate-400 font-mono">
                          {job.jobType} • {job.region} • {job.salary} • Status: <strong className="text-emerald-400">{job.status || 'Approved'}</strong>
                        </p>
                      </div>

                      {onInspectJob && (
                        <button
                          onClick={() => onInspectJob(job)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-xs border border-amber-500/30 transition-all cursor-pointer shrink-0"
                        >
                          View Job Details
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                Payment & Billing Ledger
              </h3>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {(user.transactions || [
                      {
                        id: 'tx-default-1',
                        dateTime: user.activationDate || '2026-07-25 09:00',
                        amount: 300,
                        currency: 'PKR',
                        type: 'Subscription',
                        status: 'Success',
                        paymentMethod: 'JazzCash'
                      }
                    ]).map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-semibold text-slate-200">{tx.dateTime}</td>
                        <td className="p-3 font-sans font-bold text-emerald-400">{tx.type}</td>
                        <td className="p-3 font-bold text-white">{tx.currency} {tx.amount.toLocaleString()}</td>
                        <td className="p-3 font-sans">{tx.paymentMethod}</td>
                        <td className="p-3 font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close Detail Window
          </button>
        </div>

      </div>
    </div>
  );
};
