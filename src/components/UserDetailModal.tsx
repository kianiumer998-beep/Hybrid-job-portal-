import React, { useState } from 'react';
import { UserAccount, Job, JobApplication, PaymentTransaction } from '../types/job';
import { Advertisement } from '../types/ad';
import { 
  X, 
  User, 
  Lock, 
  Mail, 
  Key, 
  Shield, 
  CheckCircle2, 
  Briefcase, 
  FileText, 
  Receipt, 
  Sparkles, 
  Edit3,
  Megaphone,
  Wallet,
  ShieldCheck,
  Save,
  Check
} from 'lucide-react';

interface UserDetailModalProps {
  user: UserAccount | null;
  userJobs?: Job[];
  userApplications?: JobApplication[];
  userAds?: Advertisement[];
  onClose: () => void;
  onUpdateUserExpiry?: (userId: string, newExpiryDate: string) => void;
  onToggleUserPlan?: (userId: string) => void;
  onUpdateUserPassword?: (userId: string, newPassword: string) => void;
  onEndUserMembership?: (userId: string) => void;
  onDeactivateUserJobs?: (userId: string) => void;
  onEndUserMembershipAndJobs?: (userId: string) => void;
  onSuspendJob?: (jobId: string, reason?: string) => void;
  onInspectJob?: (job: Job) => void;
  onSaveAdminNotes?: (userId: string, notes: string) => void;
  onUpdateUserVerification?: (userId: string, status: 'Verified' | 'Pending' | 'Unverified', kycStatus?: 'Verified' | 'Pending' | 'Rejected' | 'Not Submitted') => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  userJobs = [],
  userApplications = [],
  userAds = [],
  onClose,
  onUpdateUserExpiry,
  onToggleUserPlan,
  onUpdateUserPassword,
  onEndUserMembership,
  onDeactivateUserJobs,
  onEndUserMembershipAndJobs,
  onSuspendJob,
  onInspectJob,
  onSaveAdminNotes,
  onUpdateUserVerification
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'info' | 'campaigns' | 'applications' | 'posted-jobs' | 'transactions'>('overview');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminNotesInput, setAdminNotesInput] = useState(user?.adminNotes || '');
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);

  if (!user) return null;

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

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSaveAdminNotes) {
      onSaveAdminNotes(user.id, adminNotesInput.trim());
    } else {
      user.adminNotes = adminNotesInput.trim();
    }
    setNotesSavedSuccess(true);
    setTimeout(() => setNotesSavedSuccess(false), 3000);
  };

  const applicationsList = user.appliedJobs && user.appliedJobs.length > 0 ? user.appliedJobs : userApplications;
  const postedJobsList = userJobs.filter(j => j.submittedByUserId === user.id);
  const myCampaignsList = userAds.filter(
    ad => ad.submittedByUserId === user.id || (ad.submittedByUserEmail && ad.submittedByUserEmail.toLowerCase() === user.email.toLowerCase())
  );

  const transactionsList: PaymentTransaction[] = user.transactions && user.transactions.length > 0 
    ? user.transactions 
    : [
        {
          id: 'tx-init-1',
          dateTime: user.activationDate || '2026-07-25 09:00',
          amount: 300,
          currency: 'PKR',
          type: 'Subscription',
          status: 'Success',
          paymentMethod: 'JazzCash',
          balanceBefore: 0,
          balanceAfter: 0,
          description: 'Initial Membership Subscription'
        }
      ];

  const totalSpent = transactionsList
    .filter(t => t.status === 'Success' && t.type !== 'Wallet Deposit' && t.type !== 'Refund')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalDeposited = transactionsList
    .filter(t => t.status === 'Success' && t.type === 'Wallet Deposit')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalCampaignImpressions = myCampaignsList.reduce((acc, ad) => acc + (ad.impressions || 0), 0);
  const totalCampaignClicks = myCampaignsList.reduce((acc, ad) => acc + (ad.clicks || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 text-white animate-in fade-in zoom-in duration-200">
        
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
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                  user.verificationStatus === 'Verified' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  <ShieldCheck className="w-3 h-3" />
                  <span>{user.verificationStatus || 'Unverified'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span className="flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono text-slate-300 font-semibold">{user.email}</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">ID: {user.id}</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <Wallet className="w-3 h-3" />
                  <span>Wallet: PKR {(user.walletBalance || 0).toLocaleString()}</span>
                </span>
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
            { id: 'overview', label: 'User 360 Overview', icon: Sparkles },
            { id: 'info', label: 'Profile & Security', icon: User },
            { id: 'campaigns', label: `Campaigns & Ads (${myCampaignsList.length})`, icon: Megaphone },
            { id: 'applications', label: `Jobs Applied (${applicationsList.length})`, icon: FileText },
            { id: 'posted-jobs', label: `Posted Jobs (${postedJobsList.length})`, icon: Briefcase },
            { id: 'transactions', label: `Payment Ledger (${transactionsList.length})`, icon: Receipt }
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

          {/* TAB 0: USER 360 OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* 360 KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Wallet Balance</span>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    PKR {(user.walletBalance || 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 block">Total Deposited: PKR {totalDeposited.toLocaleString()}</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Spend (Jobs & Ads)</span>
                  <div className="text-lg font-black text-white font-mono">
                    PKR {totalSpent.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-indigo-400 block">{transactionsList.length} Transactions</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Ad Campaigns Active</span>
                  <div className="text-lg font-black text-amber-400 font-mono">
                    {myCampaignsList.filter(c => c.status === 'active').length} / {myCampaignsList.length}
                  </div>
                  <span className="text-[10px] text-slate-400 block">{totalCampaignImpressions} Impr • {totalCampaignClicks} Clicks</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Jobs Posted / Applied</span>
                  <div className="text-lg font-black text-indigo-400 font-mono">
                    {postedJobsList.length} / {applicationsList.length}
                  </div>
                  <span className="text-[10px] text-slate-400 block">Plan: {user.plan}</span>
                </div>
              </div>

              {/* Registration & Verification 360 Card */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Identity, Registration & KYC Audit</span>
                  </span>
                  <span className="text-slate-400 font-mono text-[10px] normal-case">
                    Member Since: {user.createdAt || user.activationDate || '2026-07-25'}
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Account Verification</span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{user.verificationStatus || 'Verified'}</span>
                      {onUpdateUserVerification && (
                        <button
                          type="button"
                          onClick={() => onUpdateUserVerification(user.id, user.verificationStatus === 'Verified' ? 'Unverified' : 'Verified')}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-bold cursor-pointer"
                        >
                          Toggle
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">KYC Verification Status</span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400">{user.kycStatus || 'Verified'}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">CNIC Checked</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Last Activity & Login</span>
                    <div className="font-mono font-semibold text-slate-200">
                      {user.lastLoginAt || '2026-09-15 11:20 PKT'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Notes & Case Comments */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider flex items-center space-x-2">
                    <Edit3 className="w-4 h-4" />
                    <span>Admin Case Notes & User Audit Comments</span>
                  </h3>
                  {notesSavedSuccess && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Notes Saved Successfully!</span>
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveNotes} className="space-y-3">
                  <textarea
                    rows={3}
                    value={adminNotesInput}
                    onChange={(e) => setAdminNotesInput(e.target.value)}
                    placeholder="Enter private administrative notes, user dispute history, payment notes, VIP arrangements..."
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Admin Notes</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}

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
              </div>

              {/* Admin Subscription, Unpaid Termination & Security Controls */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider flex items-center space-x-2">
                    <Shield className="w-4 h-4" />
                    <span>Admin Security & Unpaid Membership Enforcement Controls</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                      user.paymentStatus === 'Unpaid' || user.membershipStatus === 'Unpaid' || user.membershipStatus === 'Revoked'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {user.paymentStatus === 'Unpaid' || user.membershipStatus === 'Unpaid' || user.membershipStatus === 'Revoked' ? '⚠️ Payment: Unpaid / Revoked' : '💳 Payment: Paid Active'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {onEndUserMembership && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`End premium membership for ${user.name} and mark as Unpaid?`)) {
                          onEndUserMembership(user.id);
                        }
                      }}
                      className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl border border-rose-500/40 transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      <span>🚫 End Premium (Unpaid)</span>
                    </button>
                  )}

                  {onDeactivateUserJobs && postedJobsList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Deactivate/Suspend all ${postedJobsList.length} jobs posted by ${user.name}?`)) {
                          onDeactivateUserJobs(user.id);
                        }
                      }}
                      className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-xs rounded-xl border border-amber-500/40 transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      <span>📴 Deactivate All Jobs ({postedJobsList.length})</span>
                    </button>
                  )}

                  {onEndUserMembershipAndJobs && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`End membership AND deactivate all jobs for unpaid user ${user.name}?`)) {
                          onEndUserMembershipAndJobs(user.id);
                        }
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      <span>⚡ End Membership & Deactivate All Jobs</span>
                    </button>
                  )}

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
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
                      >
                        ⛔ Set Expired
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

          {/* TAB 2: CAMPAIGNS & ADS */}
          {activeTab === 'campaigns' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                  Ad Campaigns Owned by {user.name} ({myCampaignsList.length})
                </h3>
              </div>

              {myCampaignsList.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 italic">
                  This user has not launched any ad campaigns yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {myCampaignsList.map((ad) => {
                    const budgetLimit = ad.budgetLimit || ad.campaignCostPkr || 0;
                    const budgetSpent = ad.budgetSpent || 0;
                    const budgetRemaining = Math.max(0, budgetLimit - budgetSpent);
                    return (
                      <div
                        key={ad.id}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-sm">{ad.title}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                              {ad.placement}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase">
                              {ad.billingModel || 'Duration'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ad.status === 'active' 
                                ? 'bg-emerald-500/20 text-emerald-300' 
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {ad.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {ad.headline} • <span className="font-mono text-slate-300">{ad.scheduledStartAt} → {ad.scheduledEndAt}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 text-xs font-mono">
                          <div className="text-center">
                            <div className="text-[10px] text-slate-500 uppercase">Impr / Clicks</div>
                            <div className="font-bold text-white">{ad.impressions || 0} / {ad.clicks || 0}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] text-slate-500 uppercase">Spend / Budget</div>
                            <div className="font-bold text-rose-400">PKR {budgetSpent.toLocaleString()} / <span className="text-slate-400">{budgetLimit.toLocaleString()}</span></div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] text-slate-500 uppercase">Balance</div>
                            <div className="font-bold text-emerald-400">PKR {budgetRemaining.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: JOBS APPLIED FOR */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                All Jobs Applied For by {user.name} ({applicationsList.length})
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

          {/* TAB 4: POSTED JOBS */}
          {activeTab === 'posted-jobs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                  Jobs Posted by {user.name} ({postedJobsList.length})
                </h3>
                {onDeactivateUserJobs && postedJobsList.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Deactivate/Suspend all ${postedJobsList.length} jobs posted by ${user.name}?`)) {
                        onDeactivateUserJobs(user.id);
                      }
                    }}
                    className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg text-xs font-bold border border-rose-500/30 cursor-pointer"
                  >
                    📴 Deactivate All ({postedJobsList.length})
                  </button>
                )}
              </div>

              {postedJobsList.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 italic">
                  This user has not submitted any job postings yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {postedJobsList.map((job) => {
                    const isSuspended = job.status === 'Suspended' || job.isSuspended;
                    return (
                      <div
                        key={job.id}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-sm">{job.title}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSuspended
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : job.status === 'Approved'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {isSuspended ? 'SUSPENDED' : job.status}
                            </span>
                            {job.paymentStatus && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                                {job.paymentStatus}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {job.company} • {job.city || job.region} • {job.salary} • {job.applicationsCount || 0} applicants
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {onInspectJob && (
                            <button
                              onClick={() => onInspectJob(job)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
                            >
                              Inspect
                            </button>
                          )}
                          {onSuspendJob && (
                            <button
                              onClick={() => {
                                if (confirm(`Suspend / end job listing "${job.title}"?`)) {
                                  onSuspendJob(job.id, 'Ended via Admin User Detail');
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/30 transition-all cursor-pointer"
                            >
                              📴 End Job
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TRANSACTIONS & WALLET LEDGER */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                  Payment Ledger & Financial Audit
                </h3>
                <div className="text-xs font-mono text-emerald-400 font-bold">
                  Wallet Balance: PKR {(user.walletBalance || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Balance Before/After</th>
                      <th className="p-3">Method / TID</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {transactionsList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-semibold text-slate-200">{tx.dateTime}</td>
                        <td className="p-3 font-sans font-bold text-emerald-400">
                          <div>{tx.type}</div>
                          {tx.description && <div className="text-[10px] text-slate-400 font-normal font-sans">{tx.description}</div>}
                        </td>
                        <td className="p-3 font-bold text-white">{tx.currency} {tx.amount.toLocaleString()}</td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {tx.balanceBefore !== undefined && tx.balanceAfter !== undefined ? (
                            <span>PKR {tx.balanceBefore.toLocaleString()} → <strong className="text-emerald-400 font-bold">PKR {tx.balanceAfter.toLocaleString()}</strong></span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="p-3 font-sans">
                          <div>{tx.paymentMethod}</div>
                          {tx.transactionId && <div className="font-mono text-[10px] text-slate-400">TID: {tx.transactionId}</div>}
                        </td>
                        <td className="p-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.status === 'Success' 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : tx.status === 'Pending'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
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
