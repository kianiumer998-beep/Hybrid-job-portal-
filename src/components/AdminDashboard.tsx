import React, { useState } from 'react';
import { Job, Subscriber, Region, JobType, UserAccount, ChatMessage, CustomFormField, JobPostingFeeLog, PaymentTransaction, JobApplication } from '../types/job';
import { PAKISTAN_LOCATIONS } from '../data/pakistanLocations';
import { ShieldCheck, Plus, Trash2, Edit3, DollarSign, Users, Briefcase, TrendingUp, Settings, Search, CheckCircle2, X, RefreshCw, MessageSquare, Send, Globe, Bot, Sparkles, Filter, AlertCircle, Clock, Calendar, Receipt, UserCheck, Key, ShieldAlert, Eye, FileText } from 'lucide-react';
import { UserDetailModal } from './UserDetailModal';
import { AdminJobDetailModal } from './AdminJobDetailModal';

interface AdminDashboardProps {
  jobs: Job[];
  pendingJobs: Job[];
  subscribers: Subscriber[];
  users: UserAccount[];
  chatMessages: ChatMessage[];
  customFormFields: CustomFormField[];
  jobPostingFeePkr: number;
  onChangeJobPostingFee: (newFee: number) => void;
  jobPostingFeeLogs: JobPostingFeeLog[];
  allApplications?: JobApplication[];
  onApproveJob: (jobId: string) => void;
  onRejectJob: (jobId: string, reason: string) => void;
  onAddJob: (newJob: Job) => void;
  onDeleteJob: (jobId: string) => void;
  onSendMessageToUser: (userId: string, userName: string, text: string) => void;
  onAddCustomField: (field: CustomFormField) => void;
  onToggleCustomField: (fieldId: string) => void;
  onDeleteCustomField: (fieldId: string) => void;
  onUpdateUserExpiry: (userId: string, newExpiryDate: string) => void;
  onToggleUserPlan: (userId: string) => void;
  onUpdateUserPassword?: (userId: string, newPass: string) => void;
  monthlyFeePkr: number;
  onChangeMonthlyFee: (newFee: number) => void;
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  jobs,
  pendingJobs,
  subscribers,
  users,
  chatMessages,
  customFormFields,
  jobPostingFeePkr,
  onChangeJobPostingFee,
  jobPostingFeeLogs,
  allApplications = [],
  onApproveJob,
  onRejectJob,
  onAddJob,
  onDeleteJob,
  onSendMessageToUser,
  onAddCustomField,
  onToggleCustomField,
  onDeleteCustomField,
  onUpdateUserExpiry,
  onToggleUserPlan,
  onUpdateUserPassword,
  monthlyFeePkr,
  onChangeMonthlyFee,
  onExitAdmin
}) => {
  const [adminTab, setAdminTab] = useState<
    'stats' | 'pending' | 'scraper' | 'add-job' | 'jobs' | 'chat-hub' | 'form-customizer' | 'user-audit' | 'fee-logs' | 'subscribers' | 'settings'
  >('pending');

  // Modal inspection states
  const [selectedUserForModal, setSelectedUserForModal] = useState<UserAccount | null>(null);
  const [selectedJobForModal, setSelectedJobForModal] = useState<Job | null>(null);

  // Audit Selected User State
  const [auditUser, setAuditUser] = useState<UserAccount | null>(null);
  const [customExpiryInput, setCustomExpiryInput] = useState('');

  // Search
  const [searchJobQuery, setSearchJobQuery] = useState('');

  // Scraper & Scheduler Engine State
  const [scraperSources, setScraperSources] = useState<Array<{
    id: string;
    name: string;
    url: string;
    keywords: string;
    interval: '15m' | '1h' | '6h' | '24h' | '7d';
    autoApprove: boolean;
    status: 'Active Scheduled' | 'Paused';
    lastRun?: string;
    scrapedCount: number;
  }>>([
    {
      id: 'sc-1',
      name: 'Rozee.pk Pakistan Tech Jobs',
      url: 'https://www.rozee.pk/category/information-technology-jobs',
      keywords: 'React, Node.js, Full Stack, Lahore, Karachi, Islamabad',
      interval: '1h',
      autoApprove: false,
      status: 'Active Scheduled',
      lastRun: '2026-07-31 00:30',
      scrapedCount: 14
    },
    {
      id: 'sc-2',
      name: 'LinkedIn Global Remote Portal',
      url: 'https://www.linkedin.com/jobs/search?keywords=remote+developer',
      keywords: 'Senior Frontend, AI Engineer, DevOps',
      interval: '6h',
      autoApprove: true,
      status: 'Active Scheduled',
      lastRun: '2026-07-30 18:00',
      scrapedCount: 32
    }
  ]);

  const [newScraperName, setNewScraperName] = useState('');
  const [scraperUrl, setScraperUrl] = useState('https://indeed.com/jobs?q=full+stack+developer');
  const [scraperKeyword, setScraperKeyword] = useState('Full Stack, React Native, Node.js');
  const [scraperInterval, setScraperInterval] = useState<'15m' | '1h' | '6h' | '24h' | '7d'>('1h');
  const [scraperAutoApprove, setScraperAutoApprove] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scraperLogs, setScraperLogs] = useState<string[]>([
    '[2026-07-31 00:30:00] Scheduler triggered: Rozee.pk Pakistan Tech Jobs. Extracted 2 jobs (Pending Approval).',
    '[2026-07-30 18:00:00] Scheduler triggered: LinkedIn Global Remote Portal. Extracted 4 jobs (Auto-Approved Live).'
  ]);

  // Handle Add New Custom Scraper Target
  const handleAddScraperSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scraperUrl.trim()) {
      alert('Please enter a target URL.');
      return;
    }

    const newSource = {
      id: 'sc-' + Date.now(),
      name: newScraperName.trim() || `Scraper Target (${new URL(scraperUrl.startsWith('http') ? scraperUrl : 'https://' + scraperUrl).hostname})`,
      url: scraperUrl.trim(),
      keywords: scraperKeyword.trim() || 'Software Engineer',
      interval: scraperInterval,
      autoApprove: scraperAutoApprove,
      status: 'Active Scheduled' as const,
      scrapedCount: 0
    };

    setScraperSources(prev => [newSource, ...prev]);
    setNewScraperName('');
    alert(`New Scraper Target "${newSource.name}" configured and added to Auto-Scheduler!`);
  };

  const handleToggleSourceStatus = (id: string) => {
    setScraperSources(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'Active Scheduled' ? 'Paused' : 'Active Scheduled' } : s));
  };

  const handleToggleSourceAutoApprove = (id: string) => {
    setScraperSources(prev => prev.map(s => s.id === id ? { ...s, autoApprove: !s.autoApprove } : s));
  };

  const handleDeleteScraperSource = (id: string) => {
    setScraperSources(prev => prev.filter(s => s.id !== id));
  };

  // Chat Hub Selected User
  const [selectedChatUserId, setSelectedChatUserId] = useState<string>(users[0]?.id || '');
  const [adminReplyText, setAdminReplyText] = useState('');

  // Form Builder State
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'select' | 'textarea'>('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);

  // New Manual Job State
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobType, setJobType] = useState<JobType>('Remote');
  const [region, setRegion] = useState<Region>('Pakistan');
  const [province, setProvince] = useState('Punjab');
  const [city, setCity] = useState('Lahore');
  const [district, setDistrict] = useState('Gulberg');
  const [salary, setSalary] = useState('PKR 250,000 - PKR 350,000 / month');
  const [department, setDepartment] = useState('Software Engineering');
  const [tagsInput, setTagsInput] = useState('React, TypeScript, Node.js');
  const [description, setDescription] = useState('');

  // Location helpers
  const formCities = React.useMemo(() => {
    const p = (PAKISTAN_LOCATIONS || []).find((loc) => loc && loc.province === province);
    return p && Array.isArray(p.cities) ? p.cities : [];
  }, [province]);

  const formDistricts = React.useMemo(() => {
    const c = (formCities || []).find((ci) => ci && ci.name === city);
    return c && Array.isArray(c.districts) ? c.districts : [];
  }, [city, formCities]);

  // Scraper Simulation Handler
  // Scraper Manual / Scheduled Execution Handler
  const handleRunScraper = (specificSourceId?: string) => {
    const source = specificSourceId ? (scraperSources || []).find(s => s && s.id === specificSourceId) : null;
    const targetUrl = source ? source.url : scraperUrl;
    const targetKeyword = source ? source.keywords : scraperKeyword;
    const shouldAutoApprove = source ? source.autoApprove : scraperAutoApprove;

    if (!targetUrl && !targetKeyword) {
      alert('Please enter a target URL or Keyword to scrape.');
      return;
    }

    setIsScraping(true);
    setScrapeProgress(15);

    const interval = setInterval(() => {
      setScrapeProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 25;
      });
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      setIsScraping(false);
      setScrapeProgress(100);

      const jobStatus = shouldAutoApprove ? 'Approved' : 'Pending';
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // Job 1 Auto-Judged as Remote / Global
      const mockScraped1: Job = {
        id: 'job-scraped-' + Date.now() + '-1',
        title: `${targetKeyword.split(',')[0] || 'Software Engineer'} (AI Scraped)`,
        company: 'Global Software Corp',
        jobType: 'Remote',
        region: 'Global',
        salary: '$4,500 - $7,000 / month',
        currency: 'USD',
        experienceLevel: 'Senior',
        department: 'Engineering',
        tags: ['Scraped', 'Remote', 'AI Analyzed'],
        description: `Automated job scraped from ${targetUrl || 'Target Portal'}. Intelligently judged as Remote/Global.`,
        requirements: ['5+ years experience', 'TypeScript, Node.js, React'],
        benefits: ['100% Remote', 'USD Competitive Pay'],
        postedAt: 'Just now',
        applicationsCount: 0,
        status: jobStatus,
        sourceUrl: targetUrl
      };

      // Job 2 Auto-Judged as Pakistan -> Punjab -> Lahore
      const mockScraped2: Job = {
        id: 'job-scraped-' + Date.now() + '-2',
        title: `Lead ${targetKeyword.split(',')[1] || 'Full Stack Engineer'} - Lahore Hub`,
        company: 'DevSinc Pakistan',
        jobType: 'Hybrid',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Lahore',
        district: 'Gulberg',
        salary: 'PKR 320,000 - PKR 450,000 / month',
        currency: 'PKR',
        experienceLevel: 'Senior',
        department: 'Software Development',
        tags: ['Scraped', 'Pakistan', 'Lahore', 'Hybrid'],
        description: `Automated job scraped from ${targetUrl || 'Target Portal'}. Auto-classified to Pakistan -> Punjab -> Lahore -> Gulberg.`,
        requirements: ['4+ years stack experience'],
        benefits: ['Medical Insurance', 'Annual Bonus'],
        postedAt: 'Just now',
        applicationsCount: 0,
        status: jobStatus,
        sourceUrl: targetUrl
      };

      onAddJob(mockScraped1);
      onAddJob(mockScraped2);

      // Update scraper sources statistics
      if (source) {
        setScraperSources(prev => prev.map(s => s.id === source.id ? {
          ...s,
          lastRun: timestamp.substring(0, 16),
          scrapedCount: s.scrapedCount + 2
        } : s));
      }

      const logMsg = `[${timestamp}] ${source ? source.name : 'Custom Scraper'}: Successfully scraped 2 jobs from ${targetUrl} (${jobStatus === 'Approved' ? 'Auto-Approved to Live Listings' : 'Sent to Pending Queue'}).`;
      setScraperLogs(prev => [logMsg, ...prev]);

      if (shouldAutoApprove) {
        alert(`Scraper execution complete! 2 jobs were automatically judged, approved, and posted directly to live listings.`);
        setAdminTab('jobs');
      } else {
        alert(`Scraper execution complete! 2 jobs were extracted and placed in Pending Approvals for review.`);
        setAdminTab('pending');
      }
    }, 2500);
  };

  // Rejection with reason
  const handleRejectPrompt = (jobId: string) => {
    const reason = prompt('Enter Rejection Reason for user notification:', 'Job details incomplete or invalid salary range.');
    if (reason) {
      onRejectJob(jobId, reason);
    }
  };

  // Add Custom Form Field
  const handleCreateCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) return;

    const newField: CustomFormField = {
      id: 'field-' + Date.now(),
      label: fieldLabel.trim(),
      type: fieldType,
      options: fieldType === 'select' ? fieldOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      required: fieldRequired,
      active: true
    };

    onAddCustomField(newField);
    setFieldLabel('');
    setFieldOptions('');
    setFieldRequired(false);
    alert(`Custom field "${newField.label}" added to User Registration Form!`);
  };

  // Manual Job Creation
  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !company) {
      alert('Please fill out Job Title and Company');
      return;
    }

    const createdJob: Job = {
      id: 'job-' + Date.now(),
      title,
      company,
      jobType,
      region,
      province: region === 'Pakistan' ? province : undefined,
      city: region === 'Pakistan' ? city : undefined,
      district: region === 'Pakistan' ? district : undefined,
      salary,
      currency: region === 'Pakistan' ? 'PKR' : 'USD',
      experienceLevel: 'Senior',
      department,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      description,
      requirements: ['Proven experience in tech domain'],
      benefits: ['Flexible working hours'],
      postedAt: 'Just now',
      featured: true,
      applicationsCount: 0,
      status: 'Approved'
    };

    onAddJob(createdJob);
    alert(`Job "${title}" published directly to Live Portal!`);
    setTitle('');
    setCompany('');
    setAdminTab('jobs');
  };

  const handleAdminSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatUserId || !adminReplyText.trim()) return;

    const targetUser = (users || []).find((u) => u && u.id === selectedChatUserId);
    const userName = targetUser ? targetUser.name : 'User';

    onSendMessageToUser(selectedChatUserId, userName, adminReplyText.trim());
    setAdminReplyText('');
  };

  // Selected User Chat Messages
  const selectedUserMessages = chatMessages.filter((m) => m.userId === selectedChatUserId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border border-amber-500/40 rounded-3xl p-6 text-white shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-black">Portal Secret Control Hub</h2>
              <span className="bg-amber-500 text-slate-950 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                Admin Authorized
              </span>
            </div>
            <p className="text-xs text-slate-400">Manage approvals, per-job posting fees, user audits, and custom registration forms</p>
          </div>
        </div>

        <button
          onClick={onExitAdmin}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Exit Admin Panel</span>
        </button>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 overflow-x-auto text-xs font-bold">
        {[
          { id: 'pending', label: `Pending Approvals (${pendingJobs.length})`, icon: Clock },
          { id: 'user-audit', label: `User Directory & Audit (${users.length})`, icon: Users },
          { id: 'fee-logs', label: `Per-Job Fee Logs (${jobPostingFeeLogs.length})`, icon: Receipt },
          { id: 'scraper', label: 'Automated Scraper Controller', icon: Bot },
          { id: 'chat-hub', label: `User Chat Hub (${chatMessages.length})`, icon: MessageSquare },
          { id: 'form-customizer', label: 'Registration Form Customizer', icon: Edit3 },
          { id: 'add-job', label: 'Post Manual Job', icon: Plus },
          { id: 'jobs', label: `Live Listings (${jobs.length})`, icon: Briefcase },
          { id: 'subscribers', label: `Subscribers (${subscribers.length})`, icon: DollarSign },
          { id: 'settings', label: 'Global Fee Settings', icon: Settings }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setAdminTab(t.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                adminTab === t.id
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PENDING JOBS APPROVAL QUEUE */}
      {adminTab === 'pending' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Pending Job Approvals Queue</span>
              </h3>
              <p className="text-xs text-slate-400">Approve jobs to push to public live site or reject with custom user feedback.</p>
            </div>
            <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
              {pendingJobs.length} Items Pending
            </span>
          </div>

          {pendingJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800">
              No pending jobs in queue right now! All user submissions and scraper outputs are reviewed.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingJobs.map((pJob) => (
                <div key={pJob.id} className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4
                          onClick={() => setSelectedJobForModal(pJob)}
                          className="font-bold text-base text-white hover:text-amber-400 cursor-pointer transition-colors"
                        >
                          {pJob.title}
                        </h4>
                        <span className="bg-amber-500/20 text-amber-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                          {pJob.jobType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Company: <span className="text-white font-semibold">{pJob.company}</span> • Location: <span className="text-emerald-400 font-semibold">{pJob.city ? `${pJob.city}, ${pJob.province}` : pJob.region}</span> • Salary: {pJob.salary}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setSelectedJobForModal(pJob)}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl flex items-center space-x-1 border border-amber-500/30 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Job Details</span>
                      </button>

                      <button
                        onClick={() => onApproveJob(pJob.id)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1 shadow-lg shadow-emerald-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve to Live Site</span>
                      </button>

                      <button
                        onClick={() => handleRejectPrompt(pJob.id)}
                        className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl flex items-center space-x-1 border border-rose-500/30 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject with Reason</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800/80">
                    {pJob.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER DIRECTORY AUDIT & MANUAL SUBSCRIPTION CONTROL */}
      {adminTab === 'user-audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>Registered User Directory & Subscription Audit</span>
              </h3>
              <p className="text-xs text-slate-400">Click on any user to view complete billing history, transaction logs, or override expiry dates.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">User & Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Activation</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Renewals</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3">
                      <div
                        onClick={() => setSelectedUserForModal(u)}
                        className="font-bold text-white hover:text-amber-400 cursor-pointer transition-colors flex items-center space-x-1.5"
                      >
                        <span>{u.name}</span>
                        <Eye className="w-3.5 h-3.5 text-amber-400 opacity-80" />
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                    </td>
                    <td className="p-3 font-semibold text-emerald-400">{u.role}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {u.plan}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{u.activationDate || '2026-07-25 09:00'}</td>
                    <td className="p-3 font-mono text-amber-400 font-bold">{u.expiryDate || '2026-08-24 09:00'}</td>
                    <td className="p-3 font-bold text-indigo-400">{u.renewalCount || 1}</td>
                    <td className="p-3 flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedUserForModal(u)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-[11px] border border-emerald-500/30 transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>View Detail</span>
                      </button>
                      <button
                        onClick={() => setAuditUser(u)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-[11px] border border-amber-500/30 transition-all cursor-pointer"
                      >
                        Quick Expiry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PER-JOB FEE PAYMENT LOG SHEET */}
      {adminTab === 'fee-logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Per-Job Fee Payment Log Sheet</span>
              </h3>
              <p className="text-xs text-slate-400">Complete audit trail of all job posting fees collected by the system.</p>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30">
              Total Logged: {jobPostingFeeLogs.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Job Title</th>
                  <th className="p-3">Amount Paid</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {jobPostingFeeLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                      No per-job posting fees logged yet. (Set Per-Job Fee in Global Settings to enable requirement).
                    </td>
                  </tr>
                ) : (
                  jobPostingFeeLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 font-mono">
                      <td className="p-3 font-semibold text-slate-200">{log.dateTime}</td>
                      <td className="p-3 font-sans">
                        <div className="font-bold text-white">{log.userName}</div>
                        <div className="text-slate-400 text-[10px]">{log.userEmail}</div>
                      </td>
                      <td className="p-3 font-sans font-bold text-emerald-300">{log.jobTitle}</td>
                      <td className="p-3 font-bold text-white">{log.currency} {log.amount.toLocaleString()}</td>
                      <td className="p-3 font-sans font-medium text-slate-300">{log.paymentMethod}</td>
                      <td className="p-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUTOMATED SCRAPER & CRON SCHEDULER CONTROLLER */}
      {adminTab === 'scraper' && (
        <div className="space-y-6 text-white max-w-5xl shadow-2xl">
          
          {/* HEADER & TOP BANNER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center space-x-2">
                    <span>Automated Scraper & Cron Controller</span>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                      Auto-Scheduler Active
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Configure target URLs, automated intervals (minutes/hours/days), auto-approval, and judgment rules.</p>
                </div>
              </div>

              <button
                onClick={() => handleRunScraper()}
                disabled={isScraping}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-xs shadow-xl shadow-indigo-500/20 flex items-center justify-center space-x-2 cursor-pointer hover:scale-105 transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isScraping ? 'Scraping Active...' : 'Scrape All Targets Now'}</span>
              </button>
            </div>

            {isScraping && (
              <div className="p-4 bg-slate-950 border border-indigo-500/40 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-indigo-300">
                  <span className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Scraping & AI Auto-Judging Jobs across configured portals...</span>
                  </span>
                  <span>{scrapeProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${scrapeProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ADD NEW CUSTOM SCRAPER TARGET FORM */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-black uppercase text-indigo-300 flex items-center space-x-2 border-b border-slate-800 pb-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Configure New Scraper Portal / Target</span>
            </h4>

            <form onSubmit={handleAddScraperSource} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 text-xs">
              
              <div className="lg:col-span-3">
                <label className="block font-bold text-slate-300 mb-1">Target Portal Label</label>
                <input
                  type="text"
                  value={newScraperName}
                  onChange={(e) => setNewScraperName(e.target.value)}
                  placeholder="e.g. Rozee.pk Lahore Jobs"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
                />
              </div>

              <div className="lg:col-span-4">
                <label className="block font-bold text-slate-300 mb-1">Website URL Address</label>
                <input
                  type="url"
                  value={scraperUrl}
                  onChange={(e) => setScraperUrl(e.target.value)}
                  required
                  placeholder="https://rozee.pk or https://indeed.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block font-bold text-slate-300 mb-1">Target Keywords</label>
                <input
                  type="text"
                  value={scraperKeyword}
                  onChange={(e) => setScraperKeyword(e.target.value)}
                  placeholder="React, Full Stack, Lahore"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block font-bold text-slate-300 mb-1">Schedule Frequency</label>
                <select
                  value={scraperInterval}
                  onChange={(e) => setScraperInterval(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  <option value="15m">Every 15 Mins</option>
                  <option value="1h">Hourly (1 Hour)</option>
                  <option value="6h">Every 6 Hours</option>
                  <option value="24h">Daily (24 Hours)</option>
                  <option value="7d">Weekly (7 Days)</option>
                </select>
              </div>

              <div className="lg:col-span-8 flex items-center space-x-3 pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scraperAutoApprove}
                    onChange={(e) => setScraperAutoApprove(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-200">
                    Auto-Approve Scraped Jobs directly to Live Board (Bypass Pending Queue)
                  </span>
                </label>
              </div>

              <div className="lg:col-span-4 pt-1">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Save & Enable Scraper Schedule
                </button>
              </div>

            </form>
          </div>

          {/* ACTIVE CONFIGS LIST */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-black uppercase text-white flex items-center justify-between border-b border-slate-800 pb-3">
              <span>Configured Scraper Portals & Scheduler Rules ({scraperSources.length})</span>
              <span className="text-xs text-slate-400 font-normal">Auto-judges title, location, salary & department</span>
            </h4>

            <div className="space-y-3">
              {scraperSources.map((source) => (
                <div key={source.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition-all">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h5 className="font-bold text-white text-sm">{source.name}</h5>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          source.status === 'Active Scheduled' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {source.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {source.interval === '15m' ? '15 Min Interval' : source.interval === '1h' ? 'Hourly Cron' : source.interval === '6h' ? 'Every 6h' : source.interval === '24h' ? 'Daily 24h' : 'Weekly'}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-400 mt-0.5 truncate max-w-md">{source.url}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleToggleSourceAutoApprove(source.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          source.autoApprove
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {source.autoApprove ? '⚡ Auto-Approve: ON' : '🛡️ Admin Approval: REQUIRED'}
                      </button>

                      <button
                        onClick={() => handleToggleSourceStatus(source.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
                      >
                        {source.status === 'Active Scheduled' ? 'Pause Schedule' : 'Resume Schedule'}
                      </button>

                      <button
                        onClick={() => handleRunScraper(source.id)}
                        disabled={isScraping}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center space-x-1"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Run Now</span>
                      </button>

                      <button
                        onClick={() => handleDeleteScraperSource(source.id)}
                        className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 border-t border-slate-900 pt-2 font-mono">
                    <div>Keywords: <span className="text-slate-200 font-sans">{source.keywords}</span></div>
                    <div>Last Executed: <span className="text-emerald-400">{source.lastRun || 'Never'}</span></div>
                    <div>Jobs Harvested: <span className="text-white font-bold">{source.scrapedCount}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AUDIT LOG & SCHEDULER HISTORY */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
            <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Scraper System Audit & Real-time Cron Logs</span>
              <span className="text-[10px] text-emerald-400 font-mono">Live Monitoring Engine</span>
            </h4>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-40 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
              {scraperLogs.map((log, i) => (
                <div key={i} className="text-emerald-400">{log}</div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 5: USER CHAT HUB */}
      {adminTab === 'chat-hub' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl">
          <div className="md:col-span-4 border-r border-slate-800 pr-4 space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-400">Active User Threads</h4>
            <div className="space-y-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedChatUserId(u.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                    selectedChatUserId === u.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold">{u.name}</div>
                    <div className="text-[10px] opacity-75">{u.email}</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                    {u.role.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-8 space-y-4">
            <h4 className="text-xs font-bold uppercase text-slate-400">
              Chatting with: <span className="text-amber-400 font-bold">{(users || []).find((u) => u && u.id === selectedChatUserId)?.name || 'Select User'}</span>
            </h4>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-80 overflow-y-auto space-y-3">
              {selectedUserMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                  No messages in this user thread yet.
                </div>
              ) : (
                selectedUserMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.senderRole === 'admin' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-md p-3 rounded-2xl text-xs space-y-1 ${
                        msg.senderRole === 'admin'
                          ? 'bg-amber-500 text-slate-950 font-bold rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-75 gap-3">
                        <span>{msg.senderRole === 'admin' ? 'Portal Admin' : msg.userName}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAdminSendReply} className="flex gap-2">
              <input
                type="text"
                value={adminReplyText}
                onChange={(e) => setAdminReplyText(e.target.value)}
                placeholder="Type response to user..."
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: FORM CUSTOMIZER */}
      {adminTab === 'form-customizer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-white">
          <form onSubmit={handleCreateCustomField} className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2">
              Add New Custom Registration Field
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Field Label / Name</label>
              <input
                type="text"
                required
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="e.g. CNIC / Passport Number, Tech Stack"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Input Type</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  <option value="text">Short Text</option>
                  <option value="number">Number</option>
                  <option value="select">Dropdown Select</option>
                  <option value="textarea">Multi-line Text</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-amber-500"
                  />
                  <span>Is Required Field?</span>
                </label>
              </div>
            </div>

            {fieldType === 'select' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dropdown Options (Comma separated)</label>
                <input
                  type="text"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              Inject Field into User Registration Modal
            </button>
          </form>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2">
              Active Registration Form Fields ({customFormFields.length})
            </h3>

            {customFormFields.length === 0 ? (
              <div className="text-xs text-slate-500 p-4 bg-slate-950 rounded-xl italic">
                No custom fields added yet. Add a field on the left to customize user registration!
              </div>
            ) : (
              <div className="space-y-2">
                {customFormFields.map((f) => (
                  <div key={f.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{f.label}</span>
                      <span className="text-slate-400 text-[10px] ml-2">({f.type})</span>
                      {f.required && <span className="ml-2 text-[10px] text-rose-400 font-bold">*Required</span>}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onToggleCustomField(f.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          f.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {f.active ? 'Active' : 'Hidden'}
                      </button>

                      <button
                        onClick={() => onDeleteCustomField(f.id)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: POST MANUAL JOB */}
      {adminTab === 'add-job' && (
        <form onSubmit={handleCreateJob} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-white max-w-2xl">
          <h3 className="text-lg font-black border-b border-slate-800 pb-3">Post Job Directly to Live Site</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Job Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Company</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 cursor-pointer"
          >
            Publish Job to Portal
          </button>
        </form>
      )}

      {/* TAB 8: LIVE LISTINGS */}
      {adminTab === 'jobs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white">
          <h3 className="text-base font-bold">Active Live Listings ({jobs.length})</h3>
          <div className="divide-y divide-slate-800">
            {jobs.map((j) => (
              <div key={j.id} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <div
                    onClick={() => setSelectedJobForModal(j)}
                    className="font-bold text-white hover:text-amber-400 cursor-pointer transition-colors"
                  >
                    {j.title}
                  </div>
                  <div className="text-slate-400">{j.company} • {j.salary}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedJobForModal(j)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg flex items-center space-x-1 border border-amber-500/30 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Detail</span>
                  </button>
                  <button
                    onClick={() => onDeleteJob(j.id)}
                    className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: SUBSCRIBERS */}
      {adminTab === 'subscribers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4">
          <h3 className="text-base font-bold">WhatsApp Alert Subscribers ({subscribers.length})</h3>
          <div className="divide-y divide-slate-800 text-xs">
            {subscribers.map((s) => (
              <div key={s.id} className="py-3 flex justify-between">
                <div>
                  <div className="font-bold">{s.name} ({s.phone})</div>
                  <div className="text-slate-400">{s.email}</div>
                </div>
                <div className="text-emerald-400 font-bold">PKR {s.amountPaid}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: SETTINGS (MONTHLY SUBSCRIPTION & PER-JOB POSTING FEE) */}
      {adminTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2 flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>User Monthly Subscription Fee</span>
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Monthly Subscription Fee (PKR)</label>
              <input
                type="number"
                value={monthlyFeePkr}
                onChange={(e) => onChangeMonthlyFee(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold"
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sets the cost of monthly pro access for job alert notifications and portal tools.
            </p>
          </div>

          {/* PER-JOB POSTING FEE CONTROLLER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2 flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              <span>Set Per-Job Posting Fee Controller</span>
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Per-Job Fee Amount (PKR) [Set to 0 for Free]</label>
              <input
                type="number"
                value={jobPostingFeePkr}
                onChange={(e) => onChangeJobPostingFee(Number(e.target.value))}
                placeholder="1000"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold"
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When set &gt; 0, users who click "Post a Job" will be prompted with a payment invoice of PKR {jobPostingFeePkr.toLocaleString()} before their job enters Admin Pending Queue.
            </p>
          </div>

        </div>
      )}

      {/* USER AUDIT DETAILED CONTROL MODAL */}
      {auditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setAuditUser(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-4 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-xl text-amber-400">
                  {auditUser.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black">{auditUser.name}</h3>
                <p className="text-xs text-slate-400 font-mono">{auditUser.email} • {auditUser.phone || 'No phone'}</p>
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Current Plan</span>
                <span className="font-bold text-emerald-400">{auditUser.plan}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Activation Date</span>
                <span className="font-mono font-semibold text-white">{auditUser.activationDate || '2026-07-25 09:00'}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Expiry Date</span>
                <span className="font-mono font-bold text-amber-400">{auditUser.expiryDate || '2026-08-24 09:00'}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Total Renewals</span>
                <span className="font-bold text-indigo-400">{auditUser.renewalCount || 1}</span>
              </div>
            </div>

            {/* Manual Expiry Date Controls */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Admin Manual Subscription Controls
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const currentExp = auditUser.expiryDate || '2026-08-24 09:00';
                    const parts = currentExp.split(' ');
                    const dateParts = parts[0].split('-');
                    const d = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
                    d.setDate(d.getDate() + 30);
                    const newExp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${parts[1] || '09:00'}`;
                    onUpdateUserExpiry(auditUser.id, newExp);
                    setAuditUser({ ...auditUser, expiryDate: newExp, renewalCount: (auditUser.renewalCount || 1) + 1 });
                    alert(`Subscription for ${auditUser.name} extended by +30 Days! New Expiry: ${newExp}`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  + Extend +30 Days
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const revExp = '2020-01-01 00:00';
                    onUpdateUserExpiry(auditUser.id, revExp);
                    setAuditUser({ ...auditUser, expiryDate: revExp, plan: 'Free' });
                    alert(`Subscription for ${auditUser.name} revoked/expired immediately.`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  ⛔ Revoke / Expire Now
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onToggleUserPlan(auditUser.id);
                    const newPlan = auditUser.plan === 'Premium' ? 'Free' : 'Premium';
                    setAuditUser({ ...auditUser, plan: newPlan });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  Switch Plan ({auditUser.plan === 'Premium' ? 'Free' : 'Premium'})
                </button>
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <input
                  type="text"
                  value={customExpiryInput}
                  onChange={(e) => setCustomExpiryInput(e.target.value)}
                  placeholder="Custom Expiry e.g. 2027-12-31 23:59"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!customExpiryInput.trim()) return;
                    onUpdateUserExpiry(auditUser.id, customExpiryInput.trim());
                    setAuditUser({ ...auditUser, expiryDate: customExpiryInput.trim() });
                    alert(`Expiry date updated to ${customExpiryInput.trim()}`);
                    setCustomExpiryInput('');
                  }}
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Set Custom Date
                </button>
              </div>
            </div>

            {/* User Transactions Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400">User Payment Transaction Timeline</h4>
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
                  <tbody className="divide-y divide-slate-800">
                    {(auditUser.transactions || [
                      {
                        id: 'tx-audit-default',
                        dateTime: auditUser.activationDate || '2026-07-25 09:00',
                        amount: 300,
                        currency: 'PKR',
                        type: 'Subscription',
                        status: 'Success',
                        paymentMethod: 'JazzCash'
                      }
                    ]).map((tx) => (
                      <tr key={tx.id} className="font-mono">
                        <td className="p-3">{tx.dateTime}</td>
                        <td className="p-3 font-bold text-emerald-400 font-sans">{tx.type}</td>
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

          </div>
        </div>
      )}

      {/* USER DETAIL MODAL POP-UP */}
      {selectedUserForModal && (
        <UserDetailModal
          user={selectedUserForModal}
          allJobs={jobs.concat(pendingJobs)}
          allApplications={allApplications}
          allTransactions={selectedUserForModal.transactions || []}
          onClose={() => setSelectedUserForModal(null)}
          onUpdateUserExpiry={onUpdateUserExpiry}
          onToggleUserPlan={onToggleUserPlan}
          onUpdateUserPassword={onUpdateUserPassword}
          onInspectJob={(j) => setSelectedJobForModal(j)}
        />
      )}

      {/* ADMIN JOB DETAIL MODAL POP-UP */}
      {selectedJobForModal && (
        <AdminJobDetailModal
          job={selectedJobForModal}
          posterUser={users.find(u => u.name.toLowerCase() === selectedJobForModal.company.toLowerCase() || u.email.toLowerCase() === selectedJobForModal.company.toLowerCase()) || users[0]}
          onClose={() => setSelectedJobForModal(null)}
          onApproveJob={(id) => {
            onApproveJob(id);
            setSelectedJobForModal(null);
          }}
          onRejectJob={(id, reason) => {
            onRejectJob(id, reason);
            setSelectedJobForModal(null);
          }}
          onDeleteJob={(id) => {
            onDeleteJob(id);
            setSelectedJobForModal(null);
          }}
          onViewUserProfile={(u) => {
            setSelectedUserForModal(u);
          }}
        />
      )}

    </div>
  );
};
