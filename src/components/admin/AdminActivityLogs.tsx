import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  UserCheck, 
  Briefcase, 
  DollarSign, 
  Megaphone, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Plus, 
  X, 
  Eye, 
  FileText, 
  Sparkles,
  Server,
  Layers,
  ChevronDown
} from 'lucide-react';
import { UserAccount, Job, JobPostingFeeLog, PaymentTransaction } from '../../types/job';
import { Advertisement } from '../../types/ad';
import { api } from '../../services/api';

export type ActivityLogCategory = 'all' | 'users' | 'jobs' | 'payments' | 'ads' | 'kyc' | 'security';
export type ActivityLogSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface ActivityLogItem {
  id: string;
  timestamp: string; // "YYYY-MM-DD HH:mm:ss"
  category: 'users' | 'jobs' | 'payments' | 'ads' | 'kyc' | 'security';
  severity: ActivityLogSeverity;
  actionTitle: string;
  details: string;
  actorName: string;
  actorRole: 'Admin' | 'User' | 'Employer' | 'System' | 'Scraper Cron';
  ipAddress?: string;
  metadata?: Record<string, any>;
}

// Initial realistic baseline activity history
export const INITIAL_ACTIVITY_LOGS: ActivityLogItem[] = [
  {
    id: 'log-001',
    timestamp: '2026-08-29 10:14:22',
    category: 'payments',
    severity: 'success',
    actionTitle: 'Payment Received: JazzCash Pro Subscription',
    details: 'User "Khurram Shahzad" completed 30-Day Pro Subscription payment of 300 PKR via JazzCash (Ref: JC-992144).',
    actorName: 'Khurram Shahzad',
    actorRole: 'User',
    ipAddress: '39.40.12.184',
    metadata: { amount: 300, currency: 'PKR', method: 'JazzCash', plan: 'Pro Alerts' }
  },
  {
    id: 'log-002',
    timestamp: '2026-08-29 09:48:15',
    category: 'jobs',
    severity: 'info',
    actionTitle: 'Job Posting Submitted: Lead Full Stack Engineer',
    details: 'Company "Devsinc Lahore" posted new Hybrid role with 350,000 PKR monthly budget. Queued for standard review.',
    actorName: 'Devsinc HR',
    actorRole: 'Employer',
    ipAddress: '110.38.24.90',
    metadata: { jobId: 'job-9821', department: 'Software Development', region: 'Pakistan' }
  },
  {
    id: 'log-003',
    timestamp: '2026-08-29 09:12:08',
    category: 'ads',
    severity: 'success',
    actionTitle: 'Ad Campaign Approved: Silicon Valley Bootcamp',
    details: 'Admin approved Centered Pop-up Lightbox campaign (ID: #ad-01) for 14-day flight.',
    actorName: 'Super Admin',
    actorRole: 'Admin',
    ipAddress: '182.180.4.11',
    metadata: { campaignId: 'ad-bootcamp-01', placement: 'popup-modal', costPkr: 4500 }
  },
  {
    id: 'log-004',
    timestamp: '2026-08-29 08:35:40',
    category: 'users',
    severity: 'info',
    actionTitle: 'New Candidate Registration',
    details: 'Candidate "Amina Bilal" registered an account with ATS CV builder profile initialized.',
    actorName: 'Amina Bilal',
    actorRole: 'User',
    ipAddress: '175.107.199.34',
    metadata: { role: 'Job Seeker', plan: 'Free', email: 'amina.bilal@example.com' }
  },
  {
    id: 'log-005',
    timestamp: '2026-08-29 08:02:11',
    category: 'kyc',
    severity: 'success',
    actionTitle: 'Employer KYC Verified: Systems Limited',
    details: 'SECP and NTN credentials verified. Company granted Gold Employer badge and 1-click publishing.',
    actorName: 'Super Admin',
    actorRole: 'Admin',
    ipAddress: '182.180.4.11',
    metadata: { company: 'Systems Limited', ntn: '7829104-2', status: 'Verified' }
  },
  {
    id: 'log-006',
    timestamp: '2026-08-29 07:15:00',
    category: 'jobs',
    severity: 'info',
    actionTitle: 'Automated Scraping Batch Completed',
    details: 'Ingested 28 verified vacancies from Dawn & FPSC Consolidated Gazette. 3 duplicates automatically filtered.',
    actorName: 'Cron Scraper Engine',
    actorRole: 'Scraper Cron',
    ipAddress: '127.0.0.1',
    metadata: { batchId: 'batch-2026-0829-01', extracted: 28, duplicates: 3 }
  },
  {
    id: 'log-007',
    timestamp: '2026-08-28 23:40:19',
    category: 'security',
    severity: 'warning',
    actionTitle: 'Failed Login Attempt Rate-Limited',
    details: 'IP 185.220.101.5 exceeded 5 consecutive invalid authentication attempts. Temporarily throttled for 15 minutes.',
    actorName: 'Security Firewall',
    actorRole: 'System',
    ipAddress: '185.220.101.5',
    metadata: { targetEmail: 'admin@hybridjobs.pk', attempts: 5, action: 'Throttled' }
  },
  {
    id: 'log-008',
    timestamp: '2026-08-28 20:11:55',
    category: 'payments',
    severity: 'success',
    actionTitle: 'Job Posting Fee Processed: Easypaisa',
    details: 'Employer paid 1,000 PKR standard posting fee for Urgent Software Architect vacancy.',
    actorName: 'Techlogix Careers',
    actorRole: 'Employer',
    ipAddress: '115.186.134.22',
    metadata: { amount: 1000, method: 'Easypaisa', feeType: 'Standard Posting' }
  }
];

interface AdminActivityLogsProps {
  users?: UserAccount[];
  jobs?: Job[];
  feeLogs?: JobPostingFeeLog[];
  ads?: Advertisement[];
}

function mapBackendAuditLog(raw: any, index: number): ActivityLogItem {
  const validCategories = ['users', 'jobs', 'payments', 'ads', 'kyc', 'security'] as const;
  const rawCategory = (
    raw?.category ||
    raw?.details?.category ||
    raw?.metadata?.category ||
    ''
  )
    .toString()
    .toLowerCase();

  let category: ActivityLogItem['category'] = 'security';
  if ((validCategories as readonly string[]).includes(rawCategory)) {
    category = rawCategory as ActivityLogItem['category'];
  } else {
    const combinedText = `${raw?.action || ''} ${raw?.target || ''}`.toLowerCase();
    if (
      combinedText.includes('payment') ||
      combinedText.includes('transaction') ||
      combinedText.includes('wallet') ||
      combinedText.includes('pricing') ||
      combinedText.includes('fee') ||
      combinedText.includes('refund') ||
      combinedText.includes('jazzcash') ||
      combinedText.includes('easypaisa')
    ) {
      category = 'payments';
    } else if (
      combinedText.includes('ad ') ||
      combinedText.includes('ads') ||
      combinedText.includes('campaign') ||
      combinedText.includes('banner') ||
      combinedText.includes('advertis')
    ) {
      category = 'ads';
    } else if (
      combinedText.includes('kyc') ||
      combinedText.includes('badge') ||
      combinedText.includes('ntn') ||
      combinedText.includes('secp')
    ) {
      category = 'kyc';
    } else if (
      combinedText.includes('job') ||
      combinedText.includes('scraper') ||
      combinedText.includes('scrape') ||
      combinedText.includes('vacancy') ||
      combinedText.includes('application') ||
      combinedText.includes('cv')
    ) {
      category = 'jobs';
    } else if (
      (combinedText.includes('register') ||
        combinedText.includes('signup') ||
        combinedText.includes('user') ||
        combinedText.includes('profile') ||
        combinedText.includes('candidate')) &&
      !combinedText.includes('admin panel')
    ) {
      category = 'users';
    }
  }

  const validSeverities = ['info', 'success', 'warning', 'danger'] as const;
  const rawSeverity = (
    raw?.severity ||
    raw?.details?.severity ||
    raw?.metadata?.severity ||
    ''
  )
    .toString()
    .toLowerCase();

  let severity: ActivityLogSeverity = 'info';
  if ((validSeverities as readonly string[]).includes(rawSeverity)) {
    severity = rawSeverity as ActivityLogSeverity;
  } else {
    const statusStr = (raw?.status || '').toString().toLowerCase();
    if (statusStr === 'error' || statusStr === 'failed' || statusStr === 'rejected') {
      severity = 'danger';
    } else if (statusStr === 'warning') {
      severity = 'warning';
    } else if (statusStr === 'success') {
      severity = 'success';
    }
  }

  const rawRoleStr = (raw?.actorRole || raw?.role || '').toString().toLowerCase();
  let actorRole: ActivityLogItem['actorRole'] = 'User';
  if (rawRoleStr.includes('scraper') || rawRoleStr.includes('cron')) {
    actorRole = 'Scraper Cron';
  } else if (
    rawRoleStr.includes('admin') ||
    rawRoleStr.includes('manager') ||
    rawRoleStr.includes('moderator')
  ) {
    actorRole = 'Admin';
  } else if (
    rawRoleStr.includes('employer') ||
    rawRoleStr.includes('advertiser') ||
    rawRoleStr.includes('recruiter')
  ) {
    actorRole = 'Employer';
  } else if (rawRoleStr.includes('system')) {
    actorRole = 'System';
  }

  const rawTs = (raw?.timestamp || '').toString();
  const timestamp = rawTs.includes('T')
    ? rawTs.replace('T', ' ').substring(0, 19)
    : rawTs || new Date().toISOString().replace('T', ' ').substring(0, 19);

  const actionTitle = String(raw?.actionTitle || raw?.action || 'System Event');

  let details = '';
  if (typeof raw?.details === 'string' && raw.details.trim()) {
    details = raw.details.trim();
  } else if (typeof raw?.details?.description === 'string' && raw.details.description.trim()) {
    details = raw.details.description.trim();
  } else if (typeof raw?.target === 'string' && raw.target.trim()) {
    details = raw.target.trim();
  } else {
    details = actionTitle;
  }

  const metadata =
    raw?.metadata && typeof raw.metadata === 'object'
      ? raw.metadata
      : raw?.details && typeof raw.details === 'object'
        ? raw.details
        : {
            target: raw?.target || 'Portal',
            status: raw?.status || 'Success',
            role: raw?.role || actorRole
          };

  return {
    id: String(raw?.id || `log-${index}`),
    timestamp,
    category,
    severity,
    actionTitle,
    details,
    actorName: String(raw?.actorName || raw?.user || 'System'),
    actorRole,
    ipAddress: raw?.ipAddress || raw?.details?.ipAddress || raw?.metadata?.ipAddress || undefined,
    metadata
  };
}

export const AdminActivityLogs: React.FC<AdminActivityLogsProps> = ({
  users = [],
  jobs = [],
  feeLogs = [],
  ads = []
}) => {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<ActivityLogCategory>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectingLog, setInspectingLog] = useState<ActivityLogItem | null>(null);
  const [isAddingLog, setIsAddingLog] = useState<boolean>(false);

  // Manual Log Entry Form
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState<'users' | 'jobs' | 'payments' | 'ads' | 'kyc' | 'security'>('security');
  const [manualSeverity, setManualSeverity] = useState<ActivityLogSeverity>('info');
  const [manualDetails, setManualDetails] = useState('');

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.audit.getLogs();
      if (res && res.success && Array.isArray(res.logs)) {
        setLogs(res.logs.map((item: any, idx: number) => mapBackendAuditLog(item, idx)));
      } else {
        setLoadError(res?.message || 'Failed to load audit logs from the backend.');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to connect to the backend audit log service.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
      if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = log.actionTitle.toLowerCase().includes(q);
        const matchDetails = log.details.toLowerCase().includes(q);
        const matchActor = log.actorName.toLowerCase().includes(q);
        const matchIp = (log.ipAddress || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDetails && !matchActor && !matchIp) return false;
      }
      return true;
    });
  }, [logs, selectedCategory, selectedSeverity, searchQuery]);

  // Handle Manual Log Submission via authenticated backend POST /api/audit-logs
  const handleCreateManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualDetails.trim() || isSubmittingNote) return;

    setIsSubmittingNote(true);
    setSubmitError(null);
    try {
      const status =
        manualSeverity === 'danger'
          ? 'Error'
          : manualSeverity === 'warning'
            ? 'Warning'
            : 'Success';

      const res = await api.audit.addLog({
        action: manualTitle.trim(),
        target: manualDetails.trim(),
        status,
        details: {
          description: manualDetails.trim(),
          category: manualCategory,
          severity: manualSeverity,
          source: 'Manual Admin Annotation'
        }
      });

      if (res && res.success) {
        setIsAddingLog(false);
        setManualTitle('');
        setManualDetails('');
        await fetchAuditLogs();
      } else {
        setSubmitError(res?.message || 'Failed to record admin note.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to record admin note.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = 'ID,Timestamp,Category,Severity,ActionTitle,ActorName,ActorRole,IPAddress,Details\n';
    const rows = filteredLogs.map((l) => 
      `"${l.id}","${l.timestamp}","${l.category}","${l.severity}","${l.actionTitle.replace(/"/g, '""')}","${l.actorName}","${l.actorRole}","${l.ipAddress || ''}","${l.details.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Platform_Activity_Logs_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'users': return UserCheck;
      case 'jobs': return Briefcase;
      case 'payments': return DollarSign;
      case 'ads': return Megaphone;
      case 'kyc': return ShieldCheck;
      case 'security': return AlertTriangle;
      default: return Activity;
    }
  };

  const getSeverityBadge = (sev: ActivityLogSeverity) => {
    switch (sev) {
      case 'success':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'danger':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      
      {/* Top Banner & Action Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-black text-white">Platform Activity & Audit Logs</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                Live Audit Stream
              </span>
            </div>
            <p className="text-xs text-slate-400">Chronological history of registrations, job postings, transactions, and security events</p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => {
              setSubmitError(null);
              setIsAddingLog(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Admin Note</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs cursor-pointer transition-all"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchAuditLogs}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4 text-xs text-rose-300">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={fetchAuditLogs}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold transition-all cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs by action title, user name, IP address, or details..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Event Categories</option>
              <option value="users">👤 User Registrations & Accounts</option>
              <option value="jobs">💼 Job Postings & Scraper</option>
              <option value="payments">💳 Payments & Billing</option>
              <option value="ads">📢 Ad Campaigns</option>
              <option value="kyc">🛡️ Employer KYC & Badges</option>
              <option value="security">⚠️ Security & System Events</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Severity Levels</option>
              <option value="info">ℹ️ Info Only</option>
              <option value="success">✅ Success Events</option>
              <option value="warning">⚠️ Warnings</option>
              <option value="danger">🚨 Critical / Danger</option>
            </select>
          </div>

        </div>

        {/* Quick Category Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-1 text-xs">
          {[
            { id: 'all', label: `All Events (${logs.length})` },
            { id: 'payments', label: 'Payments' },
            { id: 'jobs', label: 'Job Postings' },
            { id: 'users', label: 'User Signups' },
            { id: 'ads', label: 'Ad Placements' },
            { id: 'kyc', label: 'KYC Verifications' },
            { id: 'security', label: 'Security Alerts' }
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSelectedCategory(chip.id as any)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === chip.id
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>Event Timeline ({filteredLogs.length} Records)</span>
          <span className="font-mono text-slate-500">Sorted Chronologically (Latest First)</span>
        </div>

        {isLoading && logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-7 h-7 text-indigo-400 mx-auto animate-spin" />
            <p className="text-sm font-semibold">Loading authoritative audit records...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <Activity className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold">No activity logs matched your filter criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 space-y-2">
            {filteredLogs.map((log) => {
              const CategoryIcon = getCategoryIcon(log.category);
              const severityClass = getSeverityBadge(log.severity);

              return (
                <div
                  key={log.id}
                  onClick={() => setInspectingLog(log)}
                  className="pt-3 pb-2.5 px-3 rounded-xl hover:bg-slate-800/50 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300 group-hover:border-indigo-500/40 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5">
                      <CategoryIcon className="w-4 h-4" />
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-xs text-white group-hover:text-indigo-300 transition-colors truncate">
                          {log.actionTitle}
                        </span>
                        
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${severityClass}`}>
                          {log.severity}
                        </span>

                        <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-mono">
                          {log.category.toUpperCase()}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2">
                        {log.details}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 pt-0.5">
                        <span>Actor: <strong className="text-slate-200">{log.actorName}</strong> ({log.actorRole})</span>
                        {log.ipAddress && <span>IP: <strong className="font-mono text-slate-300">{log.ipAddress}</strong></span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center text-right shrink-0 gap-1 text-[11px]">
                    <div className="flex items-center space-x-1 text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{log.timestamp}</span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-bold group-hover:underline flex items-center space-x-0.5">
                      <span>Inspect Payload</span>
                      <Eye className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspect Log Modal */}
      {inspectingLog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Event Log Inspector</h4>
                  <p className="text-[10px] text-slate-400 font-mono">ID: {inspectingLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingLog(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Action Summary</div>
                <div className="text-sm font-bold text-white">{inspectingLog.actionTitle}</div>
                <p className="text-slate-300">{inspectingLog.details}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Timestamp</span>
                  <div className="font-mono text-white">{inspectingLog.timestamp}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Severity / Category</span>
                  <div className="capitalize font-bold text-indigo-400">{inspectingLog.severity} • {inspectingLog.category}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Actor Name & Role</span>
                  <div className="font-bold text-white">{inspectingLog.actorName} ({inspectingLog.actorRole})</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">IP Address</span>
                  <div className="font-mono text-emerald-400">{inspectingLog.ipAddress || 'Internal'}</div>
                </div>
              </div>

              {inspectingLog.metadata && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Structured JSON Metadata</span>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-300 overflow-x-auto">
                    {JSON.stringify(inspectingLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectingLog(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Admin Log Entry Modal */}
      {isAddingLog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-black text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Add Admin Annotation to Activity Log</span>
              </h4>
              <button
                onClick={() => setIsAddingLog(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualLog} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Action Title *</label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. Manual Database Backup & Integrity Check"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="security">Security</option>
                    <option value="jobs">Jobs</option>
                    <option value="payments">Payments</option>
                    <option value="users">Users</option>
                    <option value="ads">Ads</option>
                    <option value="kyc">KYC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Severity</label>
                  <select
                    value={manualSeverity}
                    onChange={(e) => setManualSeverity(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="danger">Danger</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Details & Description *</label>
                <textarea
                  required
                  rows={3}
                  value={manualDetails}
                  onChange={(e) => setManualDetails(e.target.value)}
                  placeholder="Provide audit notes, rationale, or system context..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                {submitError && (
                  <span className="text-xs text-rose-400 font-semibold mr-auto">
                    {submitError}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setIsAddingLog(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isSubmittingNote ? 'Recording...' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
