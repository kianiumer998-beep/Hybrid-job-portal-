import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount, Job, JobType, Region, ChatMessage, PaymentTransaction, JobApplication, Currency, GOVT_DEPT_OPTIONS, GOVT_SCALE_OPTIONS, GOVT_CADRE_OPTIONS, NEWSPAPER_OPTIONS, JobPostingPricingConfig, DEFAULT_JOB_POSTING_PRICING_CONFIG } from '../types/job';
import { Advertisement, AdPricingConfig, DEFAULT_AD_PRICING_CONFIG, CampaignCustomizationConfig } from '../types/ad';
import { UserCampaignHub } from './ads/UserCampaignHub';
import { PAKISTAN_LOCATIONS } from '../data/pakistanLocations';
import { User, Building2, Briefcase, Plus, MessageSquare, Send, CheckCircle2, AlertCircle, Clock, ShieldCheck, Sparkles, RefreshCw, X, CreditCard, DollarSign, Calendar, History, Receipt, Lock, Key, FileText, Edit3, Megaphone, Pin, Flame, Zap, Crown, ArrowRight, Bookmark, ThumbsUp, Globe } from 'lucide-react';
import { JobSeoPreviewModal } from './common/JobSeoPreviewModal';

interface UserDashboardProps {
  currentUser: UserAccount;
  userJobs: Job[];
  chatMessages: ChatMessage[];
  jobPostingFeePkr: number;
  userApplications?: JobApplication[];
  allJobs?: Job[];
  savedJobIds?: string[];
  onSelectJob?: (job: Job) => void;
  onApplyJob?: (job: Job) => void;
  onToggleSaveJob?: (jobId: string) => void;
  initialTab?: 'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat' | 'campaigns';
  userAds?: Advertisement[];
  allAds?: Advertisement[];
  pricingConfig?: AdPricingConfig;
  campaignConfig?: CampaignCustomizationConfig;
  jobPostingPricing?: JobPostingPricingConfig;
  onSubmitCampaign?: (ad: Advertisement, cost: number) => void;
  onDepositFunds?: (amount: number, paymentMethod: string) => void;
  onDeleteAd?: (adId: string) => void;
  onDuplicateAd?: (ad: Advertisement) => void;
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
  allJobs = [],
  savedJobIds = [],
  onSelectJob,
  onApplyJob,
  onToggleSaveJob,
  initialTab = 'overview',
  userAds = [],
  allAds = [],
  pricingConfig = DEFAULT_AD_PRICING_CONFIG,
  campaignConfig,
  jobPostingPricing = DEFAULT_JOB_POSTING_PRICING_CONFIG,
  onSubmitCampaign,
  onDepositFunds,
  onDeleteAd,
  onDuplicateAd,
  onToggleAutoRenew,
  onRenewSubscription,
  onSubmitJobForApproval,
  onSendMessageToAdmin,
  onUpdateProfile,
  onChangePassword,
  onLogout,
  onOpenSubscriptionModal
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat' | 'campaigns'>(initialTab);

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
  const [jobCategory, setJobCategory] = useState<'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote'>('Private Corporate');
  const [jobType, setJobType] = useState<JobType>('Remote');
  const [region, setRegion] = useState<Region>('Pakistan');
  const [province, setProvince] = useState('Punjab');
  const [city, setCity] = useState('Lahore');
  const [district, setDistrict] = useState('Gulberg');
  const [salary, setSalary] = useState('PKR 250,000 - PKR 350,000 / month');
  const [currency, setCurrency] = useState<Currency>('PKR');
  const [experienceLevel, setExperienceLevel] = useState<'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive'>('Mid');
  const [department, setDepartment] = useState('Software Development');
  const [tagsInput, setTagsInput] = useState('React, TypeScript, Remote');
  const [description, setDescription] = useState('');
  const [requirementsInput, setRequirementsInput] = useState('');

  // Priority & Placement Boost Options
  const [priorityTier, setPriorityTier] = useState<'standard' | 'urgent' | 'featured_top' | 'future_job' | 'vip_bundle'>('standard');
  const [futureIntakeDate, setFutureIntakeDate] = useState('2026-11-01');

  // Extended Government Sector Form Fields (With Manual Entry Support)
  const [govtDeptPreset, setGovtDeptPreset] = useState(GOVT_DEPT_OPTIONS[0]);
  const [customGovtDept, setCustomGovtDept] = useState('');

  const [govtScalePreset, setGovtScalePreset] = useState(GOVT_SCALE_OPTIONS[5]); // BPS-17
  const [customGovtScale, setCustomGovtScale] = useState('');

  const [govtCadrePreset, setGovtCadrePreset] = useState(GOVT_CADRE_OPTIONS[0]);
  const [customGovtCadre, setCustomGovtCadre] = useState('');

  // Extended Newspaper Classified Ad Form Fields (With Manual Entry Support)
  const [newspaperPreset, setNewspaperPreset] = useState(NEWSPAPER_OPTIONS[0]);
  const [customNewspaper, setCustomNewspaper] = useState('');
  const [clippingImageUrl, setClippingImageUrl] = useState('');
  const [newspaperDate, setNewspaperDate] = useState('2026-08-11');

  // Extended Contact & Benefits Fields
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>(['Health Insurance', 'Remote Work Options', 'EOBI Registration']);
  const [externalApplyUrl, setExternalApplyUrl] = useState('');
  const [contactEmailOrPhone, setContactEmailOrPhone] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');

  // Per-Job Fee Payment Modal State
  const [showFeeInvoiceModal, setShowFeeInvoiceModal] = useState(false);
  const [pendingJobData, setPendingJobData] = useState<Job | null>(null);
  const [calculatedPostingFee, setCalculatedPostingFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'JazzCash' | 'Easypaisa' | 'Credit Card' | 'Bank Transfer'>('JazzCash');

  // Chat message input state
  const [newMessageText, setNewMessageText] = useState('');

  // SEO Preview Modal State for User Postings
  const [userJobSeoPreview, setUserJobSeoPreview] = useState<Job | null>(null);

  // Pricing calculation helper
  const computeJobPostingCost = (tier: 'standard' | 'urgent' | 'featured_top' | 'future_job' | 'vip_bundle'): number => {
    const baseStandardFee = jobPostingPricing?.standardFeePkr ?? jobPostingFeePkr ?? 1000;
    if (tier === 'vip_bundle') {
      return jobPostingPricing?.vipBundleFeePkr ?? 2500;
    }
    if (tier === 'featured_top') {
      return baseStandardFee + (jobPostingPricing?.featuredTopFeePkr ?? 1500);
    }
    if (tier === 'urgent') {
      return baseStandardFee + (jobPostingPricing?.urgentFeePkr ?? 500);
    }
    if (tier === 'future_job') {
      return baseStandardFee + (jobPostingPricing?.futureJobFeePkr ?? 800);
    }
    if (jobPostingPricing?.freePostingAllowed && baseStandardFee === 0) {
      return 0;
    }
    return baseStandardFee;
  };

  const currentTotalFee = computeJobPostingCost(priorityTier);

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
    const p = (PAKISTAN_LOCATIONS || []).find((loc) => loc && loc.province === province);
    return p && Array.isArray(p.cities) ? p.cities : [];
  }, [province]);

  const formDistricts = React.useMemo(() => {
    const c = (formCities || []).find((ci) => ci && ci.name === city);
    return c && Array.isArray(c.districts) ? c.districts : [];
  }, [city, formCities]);

  const handleJobSubmitInitiate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      alert('Please fill out Job Title and Description.');
      return;
    }

    const isGovt = jobCategory === 'Government Sector';
    const isNews = jobCategory === 'Newspaper Classified';

    const resolvedGovtDept = govtDeptPreset === 'Other (Manual Entry)' ? (customGovtDept || 'Government Department') : govtDeptPreset;
    const resolvedGovtScale = govtScalePreset === 'Other (Manual Entry)' ? (customGovtScale || 'BPS Scale') : govtScalePreset;
    const resolvedGovtCadre = govtCadrePreset === 'Other (Manual Entry)' ? (customGovtCadre || 'Public Sector') : govtCadrePreset;
    const resolvedNewspaper = newspaperPreset === 'Other (Manual Entry)' ? (customNewspaper || 'Newspaper Classified') : newspaperPreset;

    const isPinnedTop = priorityTier === 'featured_top' || priorityTier === 'vip_bundle';
    const isUrgent = priorityTier === 'urgent' || priorityTier === 'vip_bundle';
    const isFeatured = priorityTier === 'featured_top' || priorityTier === 'vip_bundle';
    const isFuture = priorityTier === 'future_job' || priorityTier === 'vip_bundle';

    const totalCalculatedFee = computeJobPostingCost(priorityTier);
    setCalculatedPostingFee(totalCalculatedFee);

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
      currency: currency || (region === 'Pakistan' ? 'PKR' : 'USD'),
      experienceLevel: experienceLevel || 'Mid',
      department,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      description,
      requirements: requirementsInput.split('\n').filter(Boolean),
      benefits: selectedBenefits.length > 0 ? selectedBenefits : ['Health Insurance', 'Remote Flexibility'],
      postedAt: 'Just now',
      applicationsCount: 0,
      status: 'Pending',
      submittedByUserId: currentUser.id,

      // Priority & Placement Options
      priorityTier: (priorityTier === 'future_job' ? 'standard' : priorityTier) as any,
      isPinnedTop,
      urgent: isUrgent,
      featured: isFeatured,
      isFutureJob: isFuture,
      futureIntakeDate: isFuture ? futureIntakeDate : undefined,

      // Government Sector Attributes
      isGovtJob: isGovt,
      govtDepartment: isGovt ? resolvedGovtDept : undefined,
      govtScale: isGovt ? resolvedGovtScale : undefined,
      govtCategory: isGovt ? (resolvedGovtCadre as any) : undefined,

      // Newspaper Classified Ad Attributes
      isNewspaperAd: isNews,
      newspaperName: isNews ? resolvedNewspaper : undefined,
      clippingImageUrl: isNews ? (clippingImageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=60') : undefined,
      newspaperDate: isNews ? newspaperDate : undefined,

      // External Details
      applicationUrl: externalApplyUrl || undefined,
      contactEmailOrPhone: contactEmailOrPhone || undefined,
      deadlineDate: applicationDeadline || undefined
    };

    if (totalCalculatedFee > 0) {
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

    const feeToPay = calculatedPostingFee > 0 ? calculatedPostingFee : computeJobPostingCost(priorityTier);

    onSubmitJobForApproval(pendingJobData, {
      amount: feeToPay,
      paymentMethod
    });

    alert(`Payment of PKR ${feeToPay.toLocaleString()} via ${paymentMethod} received for plan "${pendingJobData.priorityTier?.toUpperCase() || 'STANDARD'}"! Job "${pendingJobData.title}" submitted to Admin queue for verification.`);
    
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

  // Recommended Jobs Calculation Engine
  const recommendedJobs = useMemo(() => {
    if (!allJobs || allJobs.length === 0) return [];
    
    // Gather user affinity keywords
    const keywords: string[] = [];
    if (currentUser.skills) {
      keywords.push(...currentUser.skills.map((s) => s.toLowerCase()));
    }
    if (currentUser.name) {
      keywords.push(...currentUser.name.toLowerCase().split(' '));
    }
    if (currentUser.bio) {
      keywords.push(...currentUser.bio.toLowerCase().split(/[\s,]+/));
    }
    // From applied jobs
    userApplications.forEach((app) => {
      if (app.jobTitle) keywords.push(...app.jobTitle.toLowerCase().split(/[\s,]+/));
    });
    // From saved jobs
    if (savedJobIds && savedJobIds.length > 0) {
      const saved = allJobs.filter((j) => savedJobIds.includes(j.id));
      saved.forEach((j) => {
        keywords.push(...j.title.toLowerCase().split(/[\s,]+/));
        j.tags.forEach((t) => keywords.push(t.toLowerCase()));
      });
    }

    const stopWords = new Set(['and', 'for', 'the', 'with', 'from', 'into', 'that', 'this', 'jobs', 'remote', 'hybrid', 'lead', 'senior', 'junior']);
    const uniqueKeywords = Array.from(new Set(keywords.filter((k) => k.length > 2 && !stopWords.has(k))));

    return allJobs
      .filter((j) => j.status === 'Approved' || !j.status)
      .map((job) => {
        let matchScore = 60; // base fit
        const matchedReasons: string[] = [];

        const jobText = `${job.title} ${job.description} ${job.tags.join(' ')} ${job.department || ''} ${job.city || ''} ${job.region}`.toLowerCase();
        
        let keywordHits = 0;
        uniqueKeywords.forEach((kw) => {
          if (jobText.includes(kw)) {
            keywordHits++;
          }
        });

        if (keywordHits > 0) {
          matchScore += Math.min(35, keywordHits * 12);
          matchedReasons.push(`Matches ${keywordHits} saved skills & target keywords`);
        }

        if (job.jobType === 'Remote' || job.jobType === 'Hybrid') {
          matchScore += 4;
          matchedReasons.push('High-flexibility Remote/Hybrid role');
        }

        if (job.featured || job.urgent) {
          matchScore += 3;
        }

        const fitPercent = Math.min(99, Math.max(65, matchScore));

        return {
          job,
          fitPercent,
          reasons: matchedReasons.length > 0 ? matchedReasons : ['Matches trending hybrid opportunities in your region']
        };
      })
      .sort((a, b) => b.fitPercent - a.fitPercent)
      .slice(0, 6);
  }, [allJobs, currentUser, userApplications, savedJobIds]);

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
          { id: 'campaigns', label: `Self-Serve Ads & Wallet (${userAds.length})`, icon: Megaphone },
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

          {/* RECOMMENDED JOBS BASED ON PROFILE & SAVED TAGS */}
          {recommendedJobs.length > 0 && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black flex items-center space-x-2 text-white">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>Personalized Job Recommendations</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Matched automatically to your profile skills, applied roles, and saved preferences.
                  </p>
                </div>
                <span className="text-xs text-amber-400 font-bold bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 self-start sm:self-auto">
                  {recommendedJobs.length} Recommended Openings
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedJobs.map(({ job, fitPercent, reasons }) => (
                  <div
                    key={`rec-job-${job.id}`}
                    className="p-4 bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 rounded-xl flex flex-col justify-between space-y-3 transition-all hover:shadow-lg group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {fitPercent}% Match
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {job.jobType} • {job.region}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                          {job.title}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">
                          {job.company} • <span className="text-slate-300">{job.city || job.region}</span>
                        </p>
                      </div>

                      <p className="text-xs font-semibold text-emerald-400 font-mono">
                        {job.salary}
                      </p>

                      <div className="text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-center space-x-1.5">
                        <ThumbsUp className="w-3 h-3 shrink-0 text-amber-400" />
                        <span className="truncate">{reasons[0]}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                      {onToggleSaveJob && (
                        <button
                          type="button"
                          onClick={() => onToggleSaveJob(job.id)}
                          className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                            savedJobIds.includes(job.id)
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title="Save Job"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectJob) onSelectJob(job);
                        }}
                        className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-extrabold flex items-center justify-center space-x-1 transition-all shadow-md"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        <form onSubmit={handleJobSubmitInitiate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 text-white max-w-4xl shadow-2xl">
          <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-white flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                <span>Create Detailed Job Post</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Post corporate openings, public sector government positions, or newspaper classified clipping ads.
              </p>
            </div>
            {jobPostingFeePkr > 0 && (
              <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-3.5 py-1.5 rounded-full self-start sm:self-auto">
                Posting Fee: PKR {jobPostingFeePkr.toLocaleString()}
              </span>
            )}
          </div>

          {/* SECTION 1: SECTOR & CATEGORY SELECTION */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Select Job Sector / Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'Private Corporate', label: 'Corporate / Private', desc: 'Standard company roles', icon: '🏢' },
                { id: 'Government Sector', label: 'Government / FPSC', desc: 'Public sector & BPS scales', icon: '🏛️' },
                { id: 'Newspaper Classified', label: 'Newspaper Clipping', desc: 'Classified ad with image', icon: '📰' },
                { id: 'International Remote', label: 'Global Remote', desc: 'Overseas & relocation', icon: '🌐' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setJobCategory(cat.id as any);
                    if (cat.id === 'Government Sector') {
                      setRegion('Pakistan');
                      setCurrency('PKR');
                    } else if (cat.id === 'International Remote') {
                      setRegion('Global');
                      setCurrency('USD');
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    jobCategory === cat.id
                      ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className="font-bold text-xs text-white">{cat.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 2: CONDITIONAL GOVERNMENT SECTOR FIELDS */}
          {jobCategory === 'Government Sector' && (
            <div className="p-4 sm:p-5 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-4">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Government Sector & Public Scale Configuration</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ministry / Department</label>
                  <select
                    value={govtDeptPreset}
                    onChange={(e) => setGovtDeptPreset(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {GOVT_DEPT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {govtDeptPreset === 'Other (Manual Entry)' && (
                    <input
                      type="text"
                      required
                      value={customGovtDept}
                      onChange={(e) => setCustomGovtDept(e.target.value)}
                      placeholder="Type custom Ministry / Dept name..."
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pay Scale (BPS Scale)</label>
                  <select
                    value={govtScalePreset}
                    onChange={(e) => setGovtScalePreset(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {GOVT_SCALE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {govtScalePreset === 'Other (Manual Entry)' && (
                    <input
                      type="text"
                      required
                      value={customGovtScale}
                      onChange={(e) => setCustomGovtScale(e.target.value)}
                      placeholder="Type custom Pay Scale (e.g. BPS-17 or Contract)..."
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Public Sector Cadre</label>
                  <select
                    value={govtCadrePreset}
                    onChange={(e) => setGovtCadrePreset(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {GOVT_CADRE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {govtCadrePreset === 'Other (Manual Entry)' && (
                    <input
                      type="text"
                      required
                      value={customGovtCadre}
                      onChange={(e) => setCustomGovtCadre(e.target.value)}
                      placeholder="Type custom Public Sector Cadre..."
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: CONDITIONAL NEWSPAPER AD CLIPPING FIELDS */}
          {jobCategory === 'Newspaper Classified' && (
            <div className="p-4 sm:p-5 bg-teal-950/20 border border-teal-500/30 rounded-2xl space-y-4">
              <div className="flex items-center space-x-2 text-teal-300 font-bold text-xs uppercase tracking-wider">
                <FileText className="w-4 h-4 text-teal-400" />
                <span>Newspaper Classified Advertisement Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Newspaper Name</label>
                  <select
                    value={newspaperPreset}
                    onChange={(e) => setNewspaperPreset(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {NEWSPAPER_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {newspaperPreset === 'Other (Manual Entry)' && (
                    <input
                      type="text"
                      required
                      value={customNewspaper}
                      onChange={(e) => setCustomNewspaper(e.target.value)}
                      placeholder="Type custom Newspaper name..."
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-teal-500/50 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-teal-400"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Publication Date</label>
                  <input
                    type="date"
                    value={newspaperDate}
                    onChange={(e) => setNewspaperDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Clipping Image URL (Optional)</label>
                  <input
                    type="url"
                    value={clippingImageUrl}
                    onChange={(e) => setClippingImageUrl(e.target.value)}
                    placeholder="https://... image link"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: BASIC JOB INFORMATION */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Accounts Officer or Full Stack Engineer"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Organization / Company Name *</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company or Recruiting Agency"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Job Arrangement</label>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                >
                  <option value="Remote">100% Remote Work</option>
                  <option value="Hybrid">Hybrid (Office + Remote)</option>
                  <option value="On-site">On-site Office</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Target Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                >
                  <option value="Pakistan">🇵🇰 Pakistan</option>
                  <option value="Global">🌐 Global International Remote</option>
                  <option value="US">🇺🇸 United States</option>
                  <option value="UK">🇬🇧 United Kingdom</option>
                  <option value="UAE">🇦🇪 United Arab Emirates</option>
                  <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
                  <option value="Canada">🇨🇦 Canada</option>
                  <option value="Europe">🇪🇺 Europe</option>
                  <option value="Australia">🇦🇺 Australia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Department / Discipline</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                >
                  <option value="Software Development">Software & Technology</option>
                  <option value="Public Administration">Public Administration / Govt</option>
                  <option value="Finance & Accounts">Finance & Accounts</option>
                  <option value="Healthcare">Healthcare & Medicine</option>
                  <option value="Education">Education & Academia</option>
                  <option value="Operations & Logistics">Operations & Logistics</option>
                  <option value="Marketing & Sales">Marketing & Digital Media</option>
                  <option value="Engineering & Construction">Engineering & Construction</option>
                </select>
              </div>
            </div>

            {/* PAKISTAN SUB-DISTRICT UNLOCKED LOCATION SELECTOR */}
            {region === 'Pakistan' && (
              <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  🇵🇰 Detailed Location Mapping (Pakistan Sub-Districts)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Province</label>
                    <select
                      value={province}
                      onChange={(e) => {
                        setProvince(e.target.value);
                        const p = (PAKISTAN_LOCATIONS || []).find((loc) => loc && loc.province === e.target.value);
                        if (p && Array.isArray(p.cities) && p.cities.length) {
                          setCity(p.cities[0].name);
                          setDistrict(p.cities[0].districts[0] || '');
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                    >
                      {(PAKISTAN_LOCATIONS || []).map((p) => (
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
                        const c = (formCities || []).find((ci) => ci && ci.name === e.target.value);
                        if (c && Array.isArray(c.districts) && c.districts.length) {
                          setDistrict(c.districts[0]);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                    >
                      {(formCities || []).map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Sub-District / Area</label>
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

            {/* SALARY & CURRENCY SELECTION */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold"
                >
                  <option value="PKR">PKR (Pakistani Rupee)</option>
                  <option value="USD">USD ($ United States)</option>
                  <option value="GBP">GBP (£ United Kingdom)</option>
                  <option value="EUR">EUR (€ Europe)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                  <option value="SAR">SAR (Saudi Riyal)</option>
                  <option value="CAD">CAD ($ Canada)</option>
                  <option value="AUD">AUD ($ Australia)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">Salary Range / Compensation Package</label>
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="e.g. PKR 250,000 - PKR 350,000 / month or AED 18,000 / month"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>
            </div>

            {/* DESCRIPTION & REQUIREMENTS */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Job Description & Overview *</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a comprehensive job summary, role expectations, and responsibilities..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Requirements (One requirement per line)</label>
              <textarea
                rows={3}
                value={requirementsInput}
                onChange={(e) => setRequirementsInput(e.target.value)}
                placeholder="e.g. 3+ years experience with React & TypeScript&#10;Bachelor's degree in CS or equivalent&#10;Excellent communication skills"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>

            {/* BENEFITS & PERKS MULTI-CHECKBOX */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">Job Benefits & Perks Offered</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  'Health Insurance',
                  'Pension & Gratuity',
                  '100% Remote Work',
                  'Free Medical Cover',
                  'Relocation Allowance',
                  'Annual Bonus',
                  'EOBI Registration',
                  'Education Stipend'
                ].map((benefit) => {
                  const isChecked = selectedBenefits.includes(benefit);
                  return (
                    <button
                      key={benefit}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedBenefits(selectedBenefits.filter(b => b !== benefit));
                        } else {
                          setSelectedBenefits([...selectedBenefits, benefit]);
                        }
                      }}
                      className={`p-2.5 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <input type="checkbox" checked={isChecked} readOnly className="rounded text-emerald-500" />
                      <span className="font-semibold text-[11px] truncate">{benefit}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* APPLICATION CONTACT & DEADLINE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Direct Apply Link (Optional)</label>
                <input
                  type="url"
                  value={externalApplyUrl}
                  onChange={(e) => setExternalApplyUrl(e.target.value)}
                  placeholder="https://company.com/careers"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">HR Contact Email or WhatsApp</label>
                <input
                  type="text"
                  value={contactEmailOrPhone}
                  onChange={(e) => setContactEmailOrPhone(e.target.value)}
                  placeholder="hr@company.com or +92 300 1234567"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Application Deadline</label>
                <input
                  type="date"
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            {/* SECTION 5: PRIORITY & TOP-OF-BOARD PLACEMENT BOOSTS */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-bold text-sm text-white">Choose Placement & Visibility Boost</h4>
                    <p className="text-[11px] text-slate-400">Select where and how long your job is highlighted on the public job board</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Total Posting Fee:</span>
                  <div className="text-base font-black text-emerald-400 font-mono">
                    {currentTotalFee === 0 ? 'FREE' : `PKR ${currentTotalFee.toLocaleString()}`}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {/* 1. Standard Option */}
                {jobPostingPricing.enableStandard !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('standard')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'standard'
                        ? 'bg-slate-800 border-slate-400 text-white shadow-lg'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white flex items-center space-x-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>Standard Listing</span>
                        </span>
                        <span className="font-mono font-bold text-slate-300">
                          {computeJobPostingCost('standard') === 0 ? 'Free' : `PKR ${computeJobPostingCost('standard').toLocaleString()}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.standardDescription || 'Regular chronological placement on the public board.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Listing Duration:</span>
                      <span className="font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {jobPostingPricing.standardDurationDays || 30} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 2. Urgent Hiring Boost */}
                {jobPostingPricing.enableUrgent !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('urgent')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'urgent'
                        ? 'bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-rose-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-rose-300 flex items-center space-x-1.5">
                          <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                          <span>{jobPostingPricing.urgentBadgeText || '🔥 Urgent Hiring'}</span>
                        </span>
                        <span className="font-mono font-bold text-rose-300">
                          PKR {computeJobPostingCost('urgent').toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.urgentDescription || 'Shows glowing Urgent Flame badge & ranks above regular jobs for instant applicant attention.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-rose-900/30 flex items-center justify-between text-[10px] text-rose-300">
                      <span>Boost Duration:</span>
                      <span className="font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50">
                        {jobPostingPricing.urgentDurationDays || 15} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 3. Pinned Top of Board */}
                {jobPostingPricing.enableFeaturedTop !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('featured_top')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'featured_top'
                        ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-amber-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                          <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span>{jobPostingPricing.featuredBadgeText || '⭐ Pinned Top & Featured'}</span>
                        </span>
                        <span className="font-mono font-bold text-amber-300">
                          PKR {computeJobPostingCost('featured_top').toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.featuredTopDescription || 'Pinned at the very top of all jobs first! Premium gold border & maximum impressions.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-amber-900/30 flex items-center justify-between text-[10px] text-amber-300">
                      <span>Top Lock Duration:</span>
                      <span className="font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50">
                        {jobPostingPricing.featuredTopDurationDays || 30} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 4. Future Job Opportunity */}
                {jobPostingPricing.enableFutureJob !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('future_job')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'future_job'
                        ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-cyan-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-cyan-300 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{jobPostingPricing.futureBadgeText || '🚀 Advance Intake'}</span>
                        </span>
                        <span className="font-mono font-bold text-cyan-300">
                          PKR {computeJobPostingCost('future_job').toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.futureJobDescription || 'Post upcoming openings in advance with batch date countdown. Priority placement above standard listings.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-cyan-900/30 flex items-center justify-between text-[10px] text-cyan-300">
                      <span>Advance Window:</span>
                      <span className="font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                        {jobPostingPricing.futureJobDurationDays || 60} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 5. VIP All-in-One Bundle */}
                {jobPostingPricing.enableVipBundle !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('vip_bundle')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between sm:col-span-2 ${
                      priorityTier === 'vip_bundle'
                        ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-purple-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-purple-300 flex items-center space-x-1.5">
                          <Crown className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
                          <span>{jobPostingPricing.vipBadgeText || '👑 VIP All-in-One Power Bundle'}</span>
                        </span>
                        <span className="font-mono font-bold text-purple-300">
                          PKR {computeJobPostingCost('vip_bundle').toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.vipBundleDescription || 'All privileges included: Pinned Top #1 + Urgent Flame Badge + Featured Gold Styling + Advance Intake options.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-purple-900/30 flex items-center justify-between text-[10px] text-purple-300">
                      <span>Complete VIP Validity:</span>
                      <span className="font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50">
                        {jobPostingPricing.vipBundleDurationDays || 45} Days Full Coverage
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {/* Conditional Future Job Date Input */}
              {(priorityTier === 'future_job' || priorityTier === 'vip_bundle') && (
                <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-300 font-bold text-xs">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>Expected Future Intake / Joining Date</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Estimated Intake Date or Month</label>
                      <input
                        type="date"
                        value={futureIntakeDate}
                        onChange={(e) => setFutureIntakeDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-cyan-500/40 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center">
                      Candidates can view and register their early interest for your upcoming hiring batch.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TAGS INPUT */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Tags / Keywords (Comma separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="React, TypeScript, Remote, BPS-17, Tax Free"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 cursor-pointer transition-all flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4 text-slate-950" />
            <span>
              {currentTotalFee > 0
                ? `Proceed to Pay Fee (PKR ${currentTotalFee.toLocaleString()}) & Submit Listing`
                : 'Publish Job Listing for Verification'}
            </span>
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
                  <div className="flex-1 min-w-0">
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

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setUserJobSeoPreview(j)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-teal-400 border border-teal-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                      title="Inspect Google Search SEO Metadata & Schema"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Google SEO Tag</span>
                    </button>
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

      {/* TAB 7: SELF-SERVE AD CAMPAIGNS & WALLET */}
      {activeTab === 'campaigns' && (
        <UserCampaignHub
          currentUser={currentUser}
          userAds={userAds}
          allAds={allAds}
          pricingConfig={pricingConfig}
          campaignConfig={campaignConfig}
          onSubmitCampaign={(newAd, cost) => {
            if (onSubmitCampaign) {
              onSubmitCampaign(newAd, cost);
            }
          }}
          onDepositWallet={(amount, paymentMethod) => {
            if (onDepositFunds) {
              onDepositFunds(amount, paymentMethod);
            }
          }}
          onDeleteCampaign={(adId) => {
            if (onDeleteAd) {
              onDeleteAd(adId);
            }
          }}
          onDuplicateCampaign={(ad) => {
            if (onDuplicateAd) {
              onDuplicateAd(ad);
            }
          }}
        />
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

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Job Opening:</span>
                <span className="font-bold text-white text-right line-clamp-1">{pendingJobData.title}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Employer / Company:</span>
                <span className="font-bold text-white">{pendingJobData.company}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Selected Placement:</span>
                <span className="font-bold text-amber-300 uppercase tracking-wider text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {pendingJobData.priorityTier ? pendingJobData.priorityTier.replace('_', ' ') : 'Standard Listing'}
                </span>
              </div>
              {pendingJobData.isFutureJob && (
                <div className="flex justify-between text-slate-400">
                  <span>Intake Target:</span>
                  <span className="font-bold text-cyan-300">{pendingJobData.futureIntakeDate || 'Advance Batch'}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="font-bold text-slate-300">Total Posting Fee:</span>
                <span className="font-black text-emerald-400 font-mono text-base">
                  PKR {(calculatedPostingFee || computeJobPostingCost(priorityTier)).toLocaleString()}
                </span>
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
                Pay PKR {(calculatedPostingFee || computeJobPostingCost(priorityTier)).toLocaleString()} & Submit Job
              </button>
            </div>

          </div>
        </div>
      )}

      {/* USER JOB GOOGLE SEARCH SEO & SCHEMA PREVIEW MODAL */}
      {userJobSeoPreview && (
        <JobSeoPreviewModal
          job={userJobSeoPreview}
          isOpen={!!userJobSeoPreview}
          onClose={() => setUserJobSeoPreview(null)}
        />
      )}

    </div>
  );
};
