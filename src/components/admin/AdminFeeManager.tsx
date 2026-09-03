import React, { useState } from 'react';
import { UserAccount, Job, JobPostingFeeLog, JobPostingPricingConfig } from '../../types/job';
import { 
  LandingPageConfig, 
  CategoryPostingFee, 
  DEFAULT_CATEGORY_POSTING_FEES,
  DEFAULT_LANDING_PAGE_CONFIG 
} from '../../types/landing';
import { 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  Percent, 
  Plus, 
  Trash2, 
  Search, 
  UserCheck, 
  UserX, 
  Gift, 
  Save, 
  RotateCcw, 
  Tag, 
  Briefcase,
  AlertCircle
} from 'lucide-react';

interface AdminFeeManagerProps {
  landingConfig?: LandingPageConfig;
  onUpdateLandingConfig?: (newConfig: LandingPageConfig) => void;
  users?: UserAccount[];
  jobs?: Job[];
  pendingJobs?: Job[];
  feeLogs?: JobPostingFeeLog[];
  jobPostingFeePkr?: number;
  globalPostingFeePkr?: number;
  onChangeGlobalPostingFee?: (amount: number) => void;
  postingPricing?: JobPostingPricingConfig;
  onChangePostingPricing?: (config: JobPostingPricingConfig) => void;
  onUpdateUser?: (updatedUser: UserAccount) => void;
  onBulkEndUnpaidMemberships?: () => void;
  onMakeJobFree?: (jobId: string) => void;
}

export const AdminFeeManager: React.FC<AdminFeeManagerProps> = ({
  landingConfig,
  onUpdateLandingConfig,
  users = [],
  jobs = [],
  pendingJobs = [],
  feeLogs = [],
  jobPostingFeePkr,
  globalPostingFeePkr,
  onChangeGlobalPostingFee,
  postingPricing,
  onChangePostingPricing,
  onUpdateUser,
  onBulkEndUnpaidMemberships,
  onMakeJobFree
}) => {
  const currentGlobalFee = globalPostingFeePkr ?? jobPostingFeePkr ?? 500;
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'exemptions' | 'global-tiers' | 'job-waivers'>('categories');
  const [categoryFees, setCategoryFees] = useState<CategoryPostingFee[]>(() => {
    return landingConfig?.categoryPostingFees || DEFAULT_CATEGORY_POSTING_FEES;
  });
  const [exemptEmails, setExemptEmails] = useState<string[]>(() => {
    return landingConfig?.exemptUserEmails || ['vip.employer@devsinc.com', 'admin@careers.com'];
  });
  const [newExemptEmailInput, setNewExemptEmailInput] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isFreeAllPostings, setIsFreeAllPostings] = useState<boolean>(false);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleUpdateCategoryFee = (categoryId: string, updates: Partial<CategoryPostingFee>) => {
    setCategoryFees((prev) =>
      prev.map((c) => (c.categoryId === categoryId ? { ...c, ...updates } : c))
    );
  };

  const handleToggleCategoryFree = (categoryId: string) => {
    setCategoryFees((prev) =>
      prev.map((c) =>
        c.categoryId === categoryId ? { ...c, isFree: !c.isFree } : c
      )
    );
  };

  const handleAddCategory = () => {
    const newId = `cat-custom-${Date.now()}`;
    const newCategory: CategoryPostingFee = {
      categoryId: newId,
      categoryName: 'New Custom Job Category',
      feePkr: 500,
      isFree: false,
      discountPercent: 0
    };
    setCategoryFees([...categoryFees, newCategory]);
  };

  const handleDeleteCategory = (categoryId: string) => {
    setCategoryFees((prev) => prev.filter((c) => c.categoryId !== categoryId));
  };

  const handleToggleUserExemption = (email: string) => {
    if (exemptEmails.includes(email.toLowerCase())) {
      setExemptEmails(exemptEmails.filter((e) => e.toLowerCase() !== email.toLowerCase()));
    } else {
      setExemptEmails([...exemptEmails, email.toLowerCase()]);
    }
  };

  const handleAddCustomExemptEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExemptEmailInput.trim() || !newExemptEmailInput.includes('@')) return;
    const cleanEmail = newExemptEmailInput.trim().toLowerCase();
    if (!exemptEmails.includes(cleanEmail)) {
      setExemptEmails([...exemptEmails, cleanEmail]);
    }
    setNewExemptEmailInput('');
  };

  const handleSaveAll = () => {
    const baseConfig = landingConfig || DEFAULT_LANDING_PAGE_CONFIG;
    const updatedConfig: LandingPageConfig = {
      ...baseConfig,
      categoryPostingFees: categoryFees,
      exemptUserEmails: exemptEmails
    };
    if (onUpdateLandingConfig) {
      onUpdateLandingConfig(updatedConfig);
    }
    setSaveSuccessMsg('Fee configuration & employer exemptions saved successfully!');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleMakeAllFreeToggle = (enable: boolean) => {
    setIsFreeAllPostings(enable);
    if (onChangeGlobalPostingFee) {
      if (enable) {
        onChangeGlobalPostingFee(0);
      } else {
        onChangeGlobalPostingFee(500);
      }
    }
    if (enable) {
      setCategoryFees((prev) => prev.map((c) => ({ ...c, isFree: true })));
    } else {
      setCategoryFees((prev) => prev.map((c) => ({ ...c, isFree: c.categoryId === 'cat-govt' || c.categoryId === 'cat-news' })));
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.companyName && u.companyName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Command Header */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-amber-400 text-xs font-black uppercase tracking-wider bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Dynamic Fee Management & Employer Waivers
            </span>
            <span className="text-emerald-400 text-xs font-bold font-mono">
              ● Live Pricing Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Dynamic Job Posting Fees & 1-Click Free Publishing
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Configure dynamic posting rates per category, grant specific VIP employers 100% free posting waivers, and toggle site-wide discounts.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={handleSaveAll}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Save className="w-4 h-4 text-slate-950" />
            <span>Save Fee Configuration</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Master 1-Click Free Posting & Global Pricing Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Master Free Switch */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Master Free Mode</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFreeAllPostings ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                {isFreeAllPostings ? '100% Free Active' : 'Standard Billing'}
              </span>
            </div>
            <h4 className="text-base font-black text-white">Make All Job Postings 100% Free</h4>
            <p className="text-xs text-slate-400">
              Instantly bypass posting fees across the entire portal with a single master toggle.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleMakeAllFreeToggle(true)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                isFreeAllPostings
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              🎉 Enable 100% Free All
            </button>
            <button
              onClick={() => handleMakeAllFreeToggle(false)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                !isFreeAllPostings
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              💼 Standard Pricing
            </button>
          </div>
        </div>

        {/* Global Standard Fee Input */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Global Base Posting Fee</span>
            <span className="text-xs font-mono font-bold text-amber-400">{currentGlobalFee} PKR</span>
          </div>
          <h4 className="text-base font-black text-white">Default Standard Rate</h4>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              min="0"
              step="50"
              value={currentGlobalFee}
              onChange={(e) => onChangeGlobalPostingFee && onChangeGlobalPostingFee(Math.max(0, Number(e.target.value)))}
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-amber-500"
            />
            <span className="text-xs font-bold text-slate-400">PKR</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Applies to standard uncategorized employer postings.
          </p>
        </div>

        {/* Global Promotional Discount */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Site-Wide Discount</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{globalDiscount}% OFF</span>
          </div>
          <h4 className="text-base font-black text-white">Global Promo Markdown</h4>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={globalDiscount}
            onChange={(e) => setGlobalDiscount(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>0% (Full Price)</span>
            <span>50% (Flash Promo)</span>
            <span>100% (Free Week)</span>
          </div>
        </div>

      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        {[
          { id: 'categories', label: `📂 Category Posting Fees (${categoryFees.length})`, icon: Tag },
          { id: 'exemptions', label: `👑 Employer 100% Free Waivers (${exemptEmails.length})`, icon: Users },
          { id: 'job-waivers', label: `⚡ Quick Job Fee Waiver (${pendingJobs.length + jobs.length})`, icon: Gift }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSubTab === t.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CATEGORY POSTING FEES */}
      {activeSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">Dynamic Pricing Per Category</h3>
              <p className="text-xs text-slate-400">
                Set individual posting fees in PKR or make specific categories 100% free (e.g. Govt Jobs, Newspaper Ads).
              </p>
            </div>
            <button
              onClick={handleAddCategory}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-black border border-amber-500/30 flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryFees.map((cat) => (
              <div
                key={cat.categoryId}
                className={`p-4 rounded-2xl border transition-all ${
                  cat.isFree
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-500/5'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <input
                    type="text"
                    value={cat.categoryName}
                    onChange={(e) => handleUpdateCategoryFee(cat.categoryId, { categoryName: e.target.value })}
                    className="bg-transparent text-sm font-black text-white focus:outline-none border-b border-transparent focus:border-amber-500 w-full"
                  />
                  <button
                    onClick={() => handleDeleteCategory(cat.categoryId)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    title="Remove Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold">Pricing Status:</span>
                    <button
                      onClick={() => handleToggleCategoryFree(cat.categoryId)}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase transition-all cursor-pointer ${
                        cat.isFree
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat.isFree ? '🎉 100% Free' : '💵 Paid Standard'}
                    </button>
                  </div>

                  {!cat.isFree ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Fee Amount:</span>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={cat.feePkr}
                          onChange={(e) =>
                            handleUpdateCategoryFee(cat.categoryId, {
                              feePkr: Math.max(0, Number(e.target.value))
                            })
                          }
                          className="w-24 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-right font-mono font-bold text-white text-xs"
                        />
                        <span className="text-xs font-bold text-slate-400">PKR</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs text-emerald-400 font-bold">
                      ✨ Employers post in this category at zero cost.
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Discount:</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={cat.discountPercent || 0}
                        onChange={(e) =>
                          handleUpdateCategoryFee(cat.categoryId, {
                            discountPercent: Number(e.target.value)
                          })
                        }
                        className="w-14 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-right font-mono text-xs text-amber-400"
                      />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYER FREE EXEMPTIONS */}
      {activeSubTab === 'exemptions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white">VIP Employers & Whitelisted Free Accounts</h3>
              <p className="text-xs text-slate-400">
                Grant specific companies or registered emails 100% free posting privileges across all categories.
              </p>
            </div>

            {/* Add Custom Email Form */}
            <form onSubmit={handleAddCustomExemptEmail} className="flex items-center space-x-2">
              <input
                type="email"
                placeholder="Enter employer email to whitelist..."
                value={newExemptEmailInput}
                onChange={(e) => setNewExemptEmailInput(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Grant Free</span>
              </button>
            </form>
          </div>

          {/* Whitelisted Emails Pills */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs font-black uppercase text-slate-400">
              Currently Whitelisted Free Emails ({exemptEmails.length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {exemptEmails.map((email) => (
                <div
                  key={email}
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center space-x-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{email}</span>
                  <button
                    onClick={() => handleToggleUserExemption(email)}
                    className="hover:text-rose-400 ml-1 cursor-pointer"
                    title="Revoke Exemption"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {exemptEmails.length === 0 && (
                <span className="text-xs text-slate-500">No specific employer exemptions granted yet.</span>
              )}
            </div>
          </div>

          {/* Search Registered Users Table */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-400">Search Registered Users Directory:</span>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, company or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2 px-3">User / Employer</th>
                    <th className="py-2 px-3">Role / Company</th>
                    <th className="py-2 px-3">Plan</th>
                    <th className="py-2 px-3">Fee Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((user) => {
                    const isExempt = exemptEmails.includes(user.email.toLowerCase());
                    return (
                      <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-bold text-white">{user.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {user.companyName || user.role}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.plan === 'Premium' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                            {user.plan}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {isExempt ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              👑 100% Free Exemption
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Standard Rates</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleToggleUserExemption(user.email)}
                            className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              isExempt
                                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {isExempt ? 'Revoke Free' : 'Grant 100% Free'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUICK JOB FEE WAIVERS */}
      {activeSubTab === 'job-waivers' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-black text-white">Individual Job Posting Fee Waivers</h3>
            <p className="text-xs text-slate-400">
              One-click mark individual pending or live jobs as Paid / Fee Exempted (0 PKR).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <span className="text-xs font-black uppercase text-slate-400">
              Jobs Queue ({pendingJobs.length} Pending, {jobs.length} Active):
            </span>

            <div className="overflow-x-auto max-h-80 scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2 px-3">Job Title & Company</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Current Payment Status</th>
                    <th className="py-2 px-3 text-right">1-Click Free Waiver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[...pendingJobs, ...jobs.slice(0, 15)].map((job) => {
                    const isPaidOrExempt = job.paymentStatus === 'Paid' || job.paymentStatus === 'Exempt';
                    return (
                      <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-bold text-white">{job.title}</div>
                          <div className="text-[11px] text-slate-400">{job.company} • {job.region}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {job.jobCategory || 'Private Corporate'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            job.paymentStatus === 'Paid'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : job.paymentStatus === 'Exempt'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {job.paymentStatus || 'Unpaid'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => onMakeJobFree && onMakeJobFree(job.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 cursor-pointer"
                          >
                            {isPaidOrExempt ? '✓ Marked Free / Paid' : '🎁 Waive Fee (Make Free)'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
