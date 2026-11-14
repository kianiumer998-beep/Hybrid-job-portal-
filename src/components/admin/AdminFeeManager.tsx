import React, { useState, useRef, useEffect } from 'react';
import { UserAccount, Job, JobPostingFeeLog, JobPostingPricingConfig } from '../../types/job';
import { 
  LandingPageConfig, 
  CategoryPostingFee, 
  DEFAULT_CATEGORY_POSTING_FEES,
  DEFAULT_LANDING_PAGE_CONFIG 
} from '../../types/landing';
import { 
  DollarSign, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  Plus, 
  Trash2, 
  Search, 
  Gift, 
  Save, 
  RefreshCw,
  Tag, 
  AlertCircle
} from 'lucide-react';

export interface CompleteFeeConfigSavePayload {
  standardFeePkr: number;
  globalDiscount: number;
  isFreeAllPostings: boolean;
  categoryPostingFees: CategoryPostingFee[];
  exemptUserEmails: string[];
  landingPageConfig?: LandingPageConfig;
}

interface AdminFeeManagerProps {
  landingConfig?: LandingPageConfig;
  onUpdateLandingConfig?: (newConfig: LandingPageConfig) => Promise<any> | any | void;
  onSaveCompleteFeeConfig?: (payload: CompleteFeeConfigSavePayload) => Promise<any> | any | void;
  isPricingLoading?: boolean;
  pricingLoadError?: string | null;
  isPricingReady?: boolean;
  onReloadPricingConfig?: () => Promise<void> | void;
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

export const normalizeFeeSearchText = (value?: unknown): string => {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

export const normalizeFeeEmail = (value?: unknown): string => {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

export const isUserEmailExempt = (userEmail: unknown, exemptEmails: unknown[]): boolean => {
  const normalizedUserEmail = normalizeFeeEmail(userEmail);
  if (!normalizedUserEmail || !Array.isArray(exemptEmails)) return false;
  return exemptEmails.some((e) => normalizeFeeEmail(e) === normalizedUserEmail);
};

export const toggleExemptEmailList = (exemptEmails: unknown[], targetEmail: unknown): string[] => {
  const cleanList = Array.isArray(exemptEmails)
    ? exemptEmails.map((e) => normalizeFeeEmail(e)).filter(Boolean)
    : [];
  const normalizedTarget = normalizeFeeEmail(targetEmail);
  if (!normalizedTarget) return cleanList;
  if (cleanList.includes(normalizedTarget)) {
    return cleanList.filter((e) => e !== normalizedTarget);
  }
  return [...cleanList, normalizedTarget];
};

export const filterFeeManagerUsers = (
  users: UserAccount[] | undefined | null,
  query?: string | null
): UserAccount[] => {
  const safeUsers = Array.isArray(users) ? users.filter((u): u is UserAccount => Boolean(u)) : [];
  const q = normalizeFeeSearchText(query);
  if (!q) return safeUsers;
  return safeUsers.filter((u) => {
    const name = normalizeFeeSearchText(u.name);
    const email = normalizeFeeSearchText(u.email);
    const companyName = normalizeFeeSearchText(u.companyName);
    return name.includes(q) || email.includes(q) || companyName.includes(q);
  });
};



export interface FeeSaveExecutionResult {
  success: boolean;
  message: string;
}

export async function executeFeeConfigSave(
  updatedConfig: LandingPageConfig,
  onUpdateLandingConfig?: (newConfig: LandingPageConfig) => Promise<any> | any | void
): Promise<FeeSaveExecutionResult> {
  if (typeof onUpdateLandingConfig !== 'function') {
    return {
      success: false,
      message: 'Save failed: fee configuration save handler is unavailable.'
    };
  }

  try {
    const result = await onUpdateLandingConfig(updatedConfig);
    if (
      result === false ||
      (result && typeof result === 'object' && 'success' in result && result.success === false)
    ) {
      const reason =
        result && typeof result === 'object' && typeof result.message === 'string' && result.message.trim()
          ? result.message.trim()
          : 'The save handler reported a failure.';
      return {
        success: false,
        message: `Save failed: ${reason}`
      };
    }
    return {
      success: true,
      message: 'Fee configuration & employer exemptions updated successfully.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Save failed: ${err?.message || 'Unable to save fee configuration.'}`
    };
  }
}

export const resolveAuthoritativeStandardFee = (
  postingPricing?: JobPostingPricingConfig,
  globalPostingFeePkr?: number,
  jobPostingFeePkr?: number
): number => {
  if (typeof postingPricing?.standardFeePkr === 'number' && Number.isFinite(postingPricing.standardFeePkr)) {
    return Math.max(0, postingPricing.standardFeePkr);
  }
  if (typeof globalPostingFeePkr === 'number' && Number.isFinite(globalPostingFeePkr)) {
    return Math.max(0, globalPostingFeePkr);
  }
  if (typeof jobPostingFeePkr === 'number' && Number.isFinite(jobPostingFeePkr)) {
    return Math.max(0, jobPostingFeePkr);
  }
  return 0;
};

export const resolveRestoredStandardFee = (
  currentStandardFee: number,
  configuredStandardFee?: number
): number => {
  if (typeof configuredStandardFee === 'number' && Number.isFinite(configuredStandardFee) && configuredStandardFee >= 0) {
    return configuredStandardFee;
  }
  if (typeof currentStandardFee === 'number' && Number.isFinite(currentStandardFee) && currentStandardFee >= 0) {
    return currentStandardFee;
  }
  return 0;
};

export const resolveAuthoritativeCategories = (
  postingPricing?: JobPostingPricingConfig,
  landingConfig?: LandingPageConfig
): CategoryPostingFee[] => {
  if (Array.isArray(postingPricing?.categoryPostingFees)) {
    return postingPricing.categoryPostingFees;
  }
  if (Array.isArray(landingConfig?.categoryPostingFees)) {
    return landingConfig.categoryPostingFees;
  }
  return DEFAULT_CATEGORY_POSTING_FEES;
};

export const resolveAuthoritativeExemptEmails = (
  postingPricing?: JobPostingPricingConfig,
  landingConfig?: LandingPageConfig
): string[] => {
  const source = Array.isArray(postingPricing?.exemptUserEmails)
    ? postingPricing.exemptUserEmails
    : Array.isArray(landingConfig?.exemptUserEmails)
    ? landingConfig.exemptUserEmails
    : [];
  return Array.from(new Set(source.map((e) => normalizeFeeEmail(e)).filter(Boolean)));
};

export async function executeCompleteFeeConfigSave(
  payload: CompleteFeeConfigSavePayload,
  onSaveCompleteFeeConfig?: (payload: CompleteFeeConfigSavePayload) => Promise<any> | any | void
): Promise<FeeSaveExecutionResult> {
  if (typeof onSaveCompleteFeeConfig !== 'function') {
    return {
      success: false,
      message: 'Save failed: fee configuration save handler is unavailable.'
    };
  }

  try {
    const result = await onSaveCompleteFeeConfig(payload);
    if (
      result === false ||
      (result && typeof result === 'object' && 'success' in result && result.success === false)
    ) {
      const reason =
        result && typeof result === 'object' && typeof result.message === 'string' && result.message.trim()
          ? result.message.trim()
          : 'The save handler reported a failure.';
      return {
        success: false,
        message: `Save failed: ${reason}`
      };
    }
    return {
      success: true,
      message:
        result && typeof result === 'object' && typeof result.message === 'string' && result.message.trim()
          ? result.message.trim()
          : 'Fee configuration & employer exemptions updated successfully.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Save failed: ${err?.message || 'Unable to save fee configuration.'}`
    };
  }
}

export const AdminFeeManager: React.FC<AdminFeeManagerProps> = ({
  landingConfig,
  onUpdateLandingConfig,
  onSaveCompleteFeeConfig,
  isPricingLoading = false,
  pricingLoadError = null,
  isPricingReady = true,
  onReloadPricingConfig,
  users = [],
  jobs = [],
  pendingJobs = [],
  jobPostingFeePkr,
  globalPostingFeePkr,
  onChangeGlobalPostingFee,
  postingPricing,
  onBulkEndUnpaidMemberships,
  onMakeJobFree
}) => {
  const initialFee = resolveAuthoritativeStandardFee(postingPricing, globalPostingFeePkr, jobPostingFeePkr);
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'exemptions' | 'global-tiers' | 'job-waivers'>('categories');
  const [standardFeeDraft, setStandardFeeDraft] = useState<number>(initialFee);
  const configuredStandardFeeRef = useRef<number>(initialFee);
  const [categoryFees, setCategoryFees] = useState<CategoryPostingFee[]>(() =>
    resolveAuthoritativeCategories(postingPricing, landingConfig)
  );
  const [exemptEmails, setExemptEmails] = useState<string[]>(() =>
    resolveAuthoritativeExemptEmails(postingPricing, landingConfig)
  );
  const [newExemptEmailInput, setNewExemptEmailInput] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isFreeAllPostings, setIsFreeAllPostings] = useState<boolean>(() =>
    Boolean(postingPricing?.isFreeAllPostings)
  );
  const [globalDiscount, setGlobalDiscount] = useState<number>(() =>
    Math.min(100, Math.max(0, Number(postingPricing?.globalDiscount ?? 0) || 0))
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const isSavingRef = useRef<boolean>(false);

  // Sync draft state whenever authoritative backend pricing props hydrate or update
  useEffect(() => {
    const resolvedFee = resolveAuthoritativeStandardFee(postingPricing, globalPostingFeePkr, jobPostingFeePkr);
    const resolvedFreeAll = Boolean(postingPricing?.isFreeAllPostings);
    setStandardFeeDraft(resolvedFee);
    if (resolvedFee > 0 || !resolvedFreeAll) {
      configuredStandardFeeRef.current = resolvedFee;
    }
    setIsFreeAllPostings(resolvedFreeAll);
    setGlobalDiscount(Math.min(100, Math.max(0, Number(postingPricing?.globalDiscount ?? 0) || 0)));
    setCategoryFees(resolveAuthoritativeCategories(postingPricing, landingConfig));
    setExemptEmails(resolveAuthoritativeExemptEmails(postingPricing, landingConfig));
  }, [postingPricing, landingConfig, globalPostingFeePkr, jobPostingFeePkr]);

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
      feePkr: Math.max(0, Number(standardFeeDraft) || 0),
      isFree: false,
      discountPercent: 0
    };
    setCategoryFees([...categoryFees, newCategory]);
  };

  const handleDeleteCategory = (categoryId: string) => {
    setCategoryFees((prev) => prev.filter((c) => c.categoryId !== categoryId));
  };

  const handleToggleUserExemption = (email?: string | null) => {
    const normalized = normalizeFeeEmail(email);
    if (!normalized) return;
    setExemptEmails((prev) => toggleExemptEmailList(prev, normalized));
  };

  const handleAddCustomExemptEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeFeeEmail(newExemptEmailInput);
    if (!cleanEmail || !cleanEmail.includes('@')) return;
    if (!isUserEmailExempt(cleanEmail, exemptEmails)) {
      setExemptEmails((prev) => toggleExemptEmailList(prev, cleanEmail));
    }
    setNewExemptEmailInput('');
  };

  const handleStandardFeeInputChange = (rawValue: string) => {
    const parsed = Number(rawValue);
    const nextFee = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setStandardFeeDraft(nextFee);
    configuredStandardFeeRef.current = nextFee;
    if (onChangeGlobalPostingFee) {
      onChangeGlobalPostingFee(nextFee);
    }
  };

  const handleSaveAll = async () => {
    if (isSavingRef.current) return;
    if (!isPricingReady || isPricingLoading || pricingLoadError) {
      setSaveErrorMsg(
        pricingLoadError ||
          'Cannot save: authoritative pricing configuration has not finished loading from the server.'
      );
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const cleanExempt = Array.from(new Set(exemptEmails.map((e) => normalizeFeeEmail(e)).filter(Boolean)));
      const baseConfig = landingConfig || DEFAULT_LANDING_PAGE_CONFIG;
      const updatedConfig: LandingPageConfig = {
        ...baseConfig,
        categoryPostingFees: categoryFees,
        exemptUserEmails: cleanExempt
      };

      const persistedStandardFee =
        isFreeAllPostings && standardFeeDraft === 0 && configuredStandardFeeRef.current > 0
          ? configuredStandardFeeRef.current
          : Math.max(0, Number(standardFeeDraft) || 0);

      const outcome =
        typeof onSaveCompleteFeeConfig === 'function'
          ? await executeCompleteFeeConfigSave(
              {
                standardFeePkr: persistedStandardFee,
                globalDiscount: Math.min(100, Math.max(0, Number(globalDiscount) || 0)),
                isFreeAllPostings: Boolean(isFreeAllPostings),
                categoryPostingFees: categoryFees,
                exemptUserEmails: cleanExempt,
                landingPageConfig: updatedConfig
              },
              onSaveCompleteFeeConfig
            )
          : await executeFeeConfigSave(updatedConfig, onUpdateLandingConfig);

      if (outcome.success) {
        setSaveSuccessMsg(outcome.message);
      } else {
        setSaveErrorMsg(outcome.message);
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleMakeAllFreeToggle = (enable: boolean) => {
    setIsFreeAllPostings(enable);
    if (enable) {
      if (standardFeeDraft > 0) {
        configuredStandardFeeRef.current = standardFeeDraft;
      }
    } else {
      const restored = resolveRestoredStandardFee(standardFeeDraft, configuredStandardFeeRef.current);
      setStandardFeeDraft(restored);
      if (onChangeGlobalPostingFee) {
        onChangeGlobalPostingFee(restored);
      }
    }
  };

  const filteredUsers = filterFeeManagerUsers(users, userSearchQuery);

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
            type="button"
            disabled={isSaving || isPricingLoading || !isPricingReady || Boolean(pricingLoadError)}
            onClick={handleSaveAll}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-xl transition-all flex items-center space-x-2 ${
              isSaving || isPricingLoading || !isPricingReady || Boolean(pricingLoadError)
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed opacity-70'
                : 'bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 shadow-amber-500/20 hover:scale-[1.02] active:scale-95 cursor-pointer'
            }`}
          >
            <Save className={`w-4 h-4 ${isSaving ? 'text-slate-300' : 'text-slate-950'}`} />
            <span>{isSaving ? 'Saving...' : 'Save Fee Configuration'}</span>
          </button>
        </div>
      </div>

      {isPricingLoading && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
          <span>Loading authoritative pricing configuration from server...</span>
        </div>
      )}

      {pricingLoadError && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Unable to load authoritative pricing: {pricingLoadError}</span>
          </div>
          {onReloadPricingConfig && (
            <button
              type="button"
              onClick={() => onReloadPricingConfig()}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 text-xs font-bold cursor-pointer shrink-0"
            >
              Retry Load
            </button>
          )}
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
              type="button"
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
              type="button"
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
            <span className="text-xs font-mono font-bold text-amber-400">
              {isFreeAllPostings ? `0 PKR (Configured: ${standardFeeDraft} PKR)` : `${standardFeeDraft} PKR`}
            </span>
          </div>
          <h4 className="text-base font-black text-white">Default Standard Rate</h4>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              min="0"
              step="50"
              value={standardFeeDraft}
              onChange={(e) => handleStandardFeeInputChange(e.target.value)}
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
                    value={cat.categoryName || ''}
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
                  {filteredUsers.map((user, idx) => {
                    const normalizedEmail = normalizeFeeEmail(user.email);
                    const isExempt = isUserEmailExempt(normalizedEmail, exemptEmails);
                    return (
                      <tr key={user.id || normalizedEmail || idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-bold text-white">{user.name || 'Unnamed User'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{user.email || 'No email on file'}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {user.companyName || user.role || 'Member'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.plan === 'Premium' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                            {user.plan || 'Free'}
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
                            disabled={!normalizedEmail}
                            onClick={() => handleToggleUserExemption(user.email)}
                            className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                              !normalizedEmail
                                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                : isExempt
                                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 cursor-pointer'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 cursor-pointer'
                            }`}
                          >
                            {!normalizedEmail ? 'No Email' : isExempt ? 'Revoke Free' : 'Grant 100% Free'}
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
