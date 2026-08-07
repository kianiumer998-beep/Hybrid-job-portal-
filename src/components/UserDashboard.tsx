import React, { useState, useEffect } from 'react';
import { UserAccount, Job, JobType, Region, ChatMessage, PaymentTransaction, JobApplication } from '../types/job';
import { PAKISTAN_LOCATIONS } from '../data/pakistanLocations';
import { User, Building2, Briefcase, Plus, MessageSquare, Send, CheckCircle2, AlertCircle, Clock, ShieldCheck, Sparkles, RefreshCw, X, CreditCard, DollarSign, Calendar, History, Receipt, Lock, Key, FileText, Edit3 } from 'lucide-react';

interface UserDashboardProps {
  currentUser: UserAccount;
  userJobs: Job[];
  chatMessages: ChatMessage[];
  jobPostingFeePkr: number;
  userApplications?: JobApplication[];
  initialTab?: 'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat';
  onToggleAutoRenew: () => void;
  onRenewSubscription: () => void;
  onSubmitJobForApproval: (job: Job, feePayment?: { amount: number; paymentMethod: string }) => void;
  onSendMessageToAdmin: (text: string) => void;
  onUpdateProfile?: (updated: UserAccount) => void;
  onChangePassword?: (currentPass: string, newPass: string) => boolean;
  onLogout: () => void;
  onOpenSubscriptionModal: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  userJobs,
  chatMessages,
  jobPostingFeePkr,
  userApplications = [],
  initialTab = 'overview',
  onToggleAutoRenew,
  onRenewSubscription,
  onSubmitJobForApproval,
  onSendMessageToAdmin,
  onUpdateProfile,
  onChangePassword,
  onLogout,
  onOpenSubscriptionModal
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // User Profile Form State
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || '');
  const [profileCompany, setProfileCompany] = useState(currentUser.companyName || '');
  const [profileAddress, setProfileAddress] = useState(currentUser.address || '');
  const [profileBio, setProfileBio] = useState(currentUser.bio || '');

  // Password Change Form State
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // New Job Post Form State
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState(currentUser.companyName || currentUser.name || '');
  const [jobType, setJobType] = useState<JobType>('Remote');
  const [region, setRegion] = useState<Region>('Pakistan');
  const [province, setProvince] = useState('Punjab');
  const [city, setCity] = useState('Lahore');
  const [district, setDistrict] = useState('Gulberg');
  const [salary, setSalary] = useState('PKR 250,000 - PKR 350,000 / month');
  const [department, setDepartment] = useState('Software Development');
  const [tagsInput, setTagsInput] = useState('React, TypeScript, Remote');
  const [description, setDescription] = useState('');
  const [requirementsInput, setRequirementsInput] = useState('');

  // Per-Job Fee Payment Modal State
  const [showFeeInvoiceModal, setShowFeeInvoiceModal] = useState(false);
  const [pendingJobData, setPendingJobData] = useState<Job | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'JazzCash' | 'Easypaisa' | 'Credit Card' | 'Bank Transfer'>('JazzCash');

  // Chat message input state
  const [newMessageText, setNewMessageText] = useState('');

  const myApplications = currentUser.appliedJobs && currentUser.appliedJobs.length > 0
    ? currentUser.appliedJobs
    : userApplications.filter(a => a.applicantId === currentUser.id);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      alert('Full name cannot be empty.');
      return;
    }

    const updated: UserAccount = {
      ...currentUser,
      name: profileName.trim(),
      phone: profilePhone.trim(),
      companyName: profileCompany.trim(),
      address: profileAddress.trim(),
      bio: profileBio.trim()
    };

    if (onUpdateProfile) {
      onUpdateProfile(updated);
      alert('Profile details saved successfully! Email remains fixed as your primary account key.');
    }
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPasswordInput || !newPasswordInput) {
      alert('Please fill out both current and new password fields.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      alert('New password and confirm password do not match.');
      return;
    }

    if (newPasswordInput.length < 6) {
      alert('New password must be at least 6 characters long.');
      return;
    }

    if (onChangePassword) {
      const success = onChangePassword(currentPasswordInput, newPasswordInput);
      if (success) {
        alert('Password changed successfully!');
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        alert('Incorrect current password. Please try again.');
      }
    }
  };

  const formCities = React.useMemo(() => {
    const p = PAKISTAN_LOCATIONS.find((loc) => loc.province === province);
    return p ? p.cities : [];
  }, [province]);

  const formDistricts = React.useMemo(() => {
    const c = formCities.find((ci) => ci.name === city);
    return c ? c.districts : [];
  }, [city, formCities]);

  const handleJobSubmitInitiate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      alert('Please fill out Job Title and Description.');
      return;
    }

    const newJob: Job = {
      id: 'job-user-' + Date.now(),
      title,
      company: company || currentUser.name,
      jobType,
      region,
      province: region === 'Pakistan' ? province : undefined,
      city: region === 'Pakistan' ? city : undefined,
      district: region === 'Pakistan' ? district : undefined,
      salary,
      currency: region === 'Pakistan' ? 'PKR' : 'USD',
      experienceLevel: 'Mid',
      department,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      description,
      requirements: requirementsInput.split('\n').filter(Boolean),
      benefits: ['Remote Work Options', 'Health Allowance', 'Flexible Working Hours'],
      postedAt: 'Just now',
      applicationsCount: 0,
      status: 'Pending',
      submittedByUserId: currentUser.id
    };

    if (jobPostingFeePkr > 0) {
      // Require fee payment step
      setPendingJobData(newJob);
      setShowFeeInvoiceModal(true);
    } else {
      // Free posting
      onSubmitJobForApproval(newJob);
      alert('Job submitted successfully! Status: Pending Approval. The admin will verify and publish your job listing.');
      resetJobForm();
    }
  };

  const handleConfirmFeePayment = () => {
    if (!pendingJobData) return;

    onSubmitJobForApproval(pendingJobData, {
      amount: jobPostingFeePkr,
      paymentMethod
    });

    alert(`Payment of PKR ${jobPostingFeePkr.toLocaleString()} via ${paymentMethod} received! Job "${pendingJobData.title}" submitted to Admin queue for verification.`);
    
    setShowFeeInvoiceModal(false);
    setPendingJobData(null);
    resetJobForm();
  };

  const resetJobForm = () => {
    setTitle('');
    setDescription('');
    setRequirementsInput('');
    setActiveTab('my-jobs');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;
    onSendMessageToAdmin(newMessageText.trim());
    setNewMessageText('');
  };

  // Filter messages for current user
  const myMessages = chatMessages.filter((m) => m.userId === currentUser.id);

  // Derived Billing Dates & Times
  const activationTimeStr = currentUser.activationDate || '2026-07-25 09:00';
  const expiryTimeStr = currentUser.expiryDate || '2026-08-24 09:00';
  const renewalCount = currentUser.renewalCount || 1;
  const userTransactions: PaymentTransaction[] = currentUser.transactions || [
    {
      id: 'tx-init-1',
      dateTime: activationTimeStr,
      amount: 300,
      currency: 'PKR',
      type: 'Subscription',
      status: 'Success',
      paymentMethod: 'JazzCash'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Profile Card - UNIFIED ACCOUNT */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-600 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-2xl text-emerald-400">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-black">{currentUser.name}</h2>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full">
                Unified Portal Member
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Username: <strong className="text-white font-mono">{currentUser.username || currentUser.email.split('@')[0]}</strong> • {currentUser.email} • {currentUser.phone || '+92 300 0000000'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 overflow-x-auto text-xs font-bold">
        {[
          { id: 'overview', label: 'Billing & Membership Metrics', icon: Receipt },
          { id: 'profile', label: 'My Profile & Security', icon: User },
          { id: 'applications', label: `My Job Applications (${myApplications.length})`, icon: FileText },
          { id: 'post-job', label: 'Post a New Job', icon: Plus },
          { id: 'my-jobs', label: `My Posted Jobs (${userJobs.length})`, icon: Briefcase },
          { id: 'chat', label: `Admin Inbox (${myMessages.length})`, icon: MessageSquare }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ADVANCED SUBSCRIPTION METRICS & PAYMENT HISTORY TABLE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Subscription Metrics Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                <span>Plan Type</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-emerald-400">{currentUser.plan} Monthly Pro</div>
              <div className="text-[11px] text-slate-400">Full Access to Job Portal & CV Engine</div>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                <span>Activation Timestamp</span>
                <Clock className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-base font-black text-white font-mono">{activationTimeStr}</div>
              <div className="text-[11px] text-teal-400 font-semibold">Active & Verified</div>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                <span>Expiry Timestamp (30 Days)</span>
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-base font-black text-amber-400 font-mono">{expiryTimeStr}</div>
              <div className="text-[11px] text-slate-400">Calculated 30 days from activation</div>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                <span>Total Renewals</span>
                <RefreshCw className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-indigo-400">{renewalCount} Counter</div>
              <div className="text-[11px] text-slate-400">Times membership was renewed</div>
            </div>

          </div>

          {/* Subscription Control & Auto-Renew Card */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Membership Auto-Renewal & Renewal Actions</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage your subscription timeline and extend your validity anytime.
                </p>
              </div>

              <button
                onClick={onRenewSubscription}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                Renew Membership (+30 Days)
              </button>
            </div>

            <div className="flex items-center justify-between py-3 bg-slate-950 px-4 rounded-xl border border-slate-800">
              <div>
                <span className="font-bold text-white text-sm block">Monthly Auto-Renewal Switch</span>
                <span className="text-xs text-slate-400">When enabled, subscription auto-renews at expiry date</span>
              </div>

              <button
                type="button"
                onClick={onToggleAutoRenew}
                className={`w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                  currentUser.autoRenew ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${
                    currentUser.autoRenew ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* PAYMENT HISTORY TABLE */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black flex items-center space-x-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  <span>Payment History & Billing Transactions</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Timeline of all subscription renewals and per-job posting fees paid.</p>
              </div>
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                {userTransactions.length} Transactions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Reference / Item</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {userTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-white">{tx.dateTime}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">{tx.type}</td>
                      <td className="py-3.5 px-4 text-slate-300">{tx.jobTitleRef || 'Monthly Pro Subscription'}</td>
                      <td className="py-3.5 px-4 font-black text-white font-mono">{tx.currency} {tx.amount.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-300">{tx.paymentMethod}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: MY PROFILE & SECURITY */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-white">
          
          {/* PROFILE EDIT FORM */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  <span>My Profile Details</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update your contact details and company representation.
                </p>
              </div>
              <span className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                Active Member
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* FIXED EMAIL ADDRESS INPUT */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Email Address (Fixed Identity)</span>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={currentUser.email}
                      disabled
                      readOnly
                      className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-amber-500/30 rounded-xl text-amber-300 font-mono text-xs font-bold cursor-not-allowed opacity-90"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-sans font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                      FIXED
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Primary account identifier cannot be altered for security auditing.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+92 300 0000000"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={profileCompany}
                    onChange={(e) => setProfileCompany(e.target.value)}
                    placeholder="e.g. Acme Tech Solutions"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium"
                  />
                </div>

              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Address / Location</label>
                <input
                  type="text"
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                  placeholder="e.g. Gulberg III, Lahore, Punjab, Pakistan"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Professional Summary / Bio</label>
                <textarea
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  rows={3}
                  placeholder="Tell employers or job candidates about yourself or your organization..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs leading-relaxed"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>

          {/* CHANGE PASSWORD & SECURITY FORM */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center space-x-2">
                <Key className="w-5 h-5 text-amber-400" />
                <span>Security & Change Password</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Update your login password securely.
              </p>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  required
                  placeholder="Enter your current password"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  required
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Update Password Now
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* TAB 3: MY JOB APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-black flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span>My Submitted Job Applications ({myApplications.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Track all your job submissions and employer response status.
              </p>
            </div>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30">
              Total Applications: {myApplications.length}
            </span>
          </div>

          {myApplications.length === 0 ? (
            <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 italic space-y-2">
              <p className="font-bold text-slate-400 text-sm">No job applications submitted yet.</p>
              <p className="text-xs">Browse the live job board and click "Apply Now" to submit your CV and application!</p>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Job Title & Company</th>
                    <th className="p-3.5">Applied Timestamp</th>
                    <th className="p-3.5">Application Status</th>
                    <th className="p-3.5">Subscription Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {myApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-900/50">
                      <td className="p-3.5">
                        <div className="font-bold text-white text-sm">{app.jobTitle}</div>
                        <div className="text-slate-400 text-xs">{app.companyName}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">{app.appliedAt}</td>
                      <td className="p-3.5 font-bold text-emerald-400">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]">
                          {app.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-[10px]">
                          {app.paymentStatus || 'Subscription Active'}
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

      {/* TAB 4: POST NEW JOB FORM */}
      {activeTab === 'post-job' && (
        <form onSubmit={handleJobSubmitInitiate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-white max-w-2xl shadow-2xl">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Create New Job Post</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every registered user can post job openings to recruit top remote and localized talent.
              </p>
            </div>
            {jobPostingFeePkr > 0 && (
              <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-3 py-1 rounded-full">
                Fee: PKR {jobPostingFeePkr.toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Job Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Remote Senior React Engineer"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Company / Recruiter Name</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Job Type</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              >
                <option value="Remote">100% Remote</option>
                <option value="Hybrid">Hybrid Office</option>
                <option value="On-site">On-site</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Target Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              >
                <option value="Pakistan">Pakistan</option>
                <option value="Global">Global International</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
              </select>
            </div>
          </div>

          {region === 'Pakistan' && (
            <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-3">
              <span className="text-xs font-bold text-emerald-400 uppercase">Pakistan Location Details</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Province</label>
                  <select
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      const p = PAKISTAN_LOCATIONS.find((loc) => loc.province === e.target.value);
                      if (p && p.cities.length) {
                        setCity(p.cities[0].name);
                        setDistrict(p.cities[0].districts[0] || '');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                  >
                    {PAKISTAN_LOCATIONS.map((p) => (
                      <option key={p.province} value={p.province}>{p.province}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">City</label>
                  <select
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      const c = formCities.find((ci) => ci.name === e.target.value);
                      if (c && c.districts.length) {
                        setDistrict(c.districts[0]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                  >
                    {formCities.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">District / Area</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                  >
                    {formDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Salary Package</label>
            <input
              type="text"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="e.g. PKR 250,000 - 350,000 / month"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Job Description</label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe role responsibilities and requirements..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 cursor-pointer"
          >
            {jobPostingFeePkr > 0 ? `Proceed to Pay Fee (PKR ${jobPostingFeePkr.toLocaleString()}) & Submit` : 'Submit Job for Admin Approval'}
          </button>
        </form>
      )}

      {/* TAB 3: MY SUBMITTED JOBS */}
      {activeTab === 'my-jobs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white shadow-xl">
          <h3 className="text-base font-bold">My Submitted Job Listings</h3>
          {userJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-950 rounded-xl border border-slate-800">
              You have not submitted any jobs yet. Switch to "Post a New Job" to list a job opening!
            </div>
          ) : (
            <div className="space-y-3">
              {userJobs.map((j) => (
                <div key={j.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-white">{j.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        j.status === 'Approved'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : j.status === 'Rejected'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        Status: {j.status || 'Pending Approval'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{j.company} • {j.city ? `${j.city}, ${j.province}` : j.region} • {j.salary}</p>
                    
                    {j.status === 'Rejected' && j.rejectionReason && (
                      <div className="mt-2 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                        <span className="font-bold">Admin Rejection Reason:</span> {j.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TWO-WAY USER-ADMIN CHAT INBOX SYSTEM */}
      {activeTab === 'chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 max-w-3xl shadow-2xl">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <span>Admin Support & Verification Chat</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct two-way line with portal administration regarding job approvals & support.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-80 overflow-y-auto space-y-3">
            {myMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                No chat messages yet. Type a message below to reach Admin!
              </div>
            ) : (
              myMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.senderRole === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-md p-3 rounded-2xl text-xs space-y-1 ${
                      msg.senderRole === 'user'
                        ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none'
                        : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] opacity-75 gap-3 font-bold">
                      <span>{msg.senderRole === 'user' ? 'You' : 'Portal Admin'}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type your message to Admin..."
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>

        </div>
      )}

      {/* JOB POSTING FEE PAYMENT INVOICE MODAL */}
      {showFeeInvoiceModal && pendingJobData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 text-white shadow-2xl relative animate-in fade-in zoom-in duration-200">
            
            <button
              onClick={() => setShowFeeInvoiceModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Job Posting Fee Required</h3>
                <p className="text-xs text-slate-400">Admin configured per-job posting fee</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Job Title:</span>
                <span className="font-bold text-white">{pendingJobData.title}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Company:</span>
                <span className="font-bold text-white">{pendingJobData.company}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Posting Fee Amount:</span>
                <span className="font-black text-emerald-400 font-mono text-sm">PKR {jobPostingFeePkr.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['JazzCash', 'Easypaisa', 'Credit Card', 'Bank Transfer'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2.5 px-3 rounded-xl font-bold border transition-all ${
                      paymentMethod === method
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirmFeePayment}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shadow-xl shadow-emerald-500/20 cursor-pointer"
              >
                Pay PKR {jobPostingFeePkr.toLocaleString()} & Submit Job
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
