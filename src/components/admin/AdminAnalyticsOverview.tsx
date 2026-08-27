import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Briefcase,
  Globe,
  Bot,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Download,
  Filter,
  RefreshCw,
  Building2
} from 'lucide-react';
import { Job, JobPostingFeeLog, ScrapedJobAuditEntry, ScraperBatchRun, Subscriber, UserAccount } from '../../types/job';
import { CurrencyExchangeConfig } from '../../types/adminSuite';
import { INITIAL_CURRENCY_CONFIG } from '../../data/mockAdminSuiteData';

interface AdminAnalyticsOverviewProps {
  jobs?: Job[];
  pendingJobs?: Job[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  feeLogs?: JobPostingFeeLog[];
  auditLogs?: ScrapedJobAuditEntry[];
  batchRuns?: ScraperBatchRun[];
  currencyConfig?: CurrencyExchangeConfig;
  onNavigateTab?: (tabId: any) => void;
  ads?: any[];
}

export const AdminAnalyticsOverview: React.FC<AdminAnalyticsOverviewProps> = ({
  jobs = [],
  pendingJobs = [],
  users = [],
  subscribers = [],
  feeLogs = [],
  auditLogs = [],
  batchRuns = [],
  currencyConfig = INITIAL_CURRENCY_CONFIG,
  onNavigateTab = (_tabId: any) => {}
}) => {
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [selectedCurrencyView, setSelectedCurrencyView] = useState<'PKR' | 'USD' | 'AED' | 'SAR'>('PKR');

  // Revenue Calculations
  const safeFeeLogs = Array.isArray(feeLogs) ? feeLogs : [];
  const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safePendingJobs = Array.isArray(pendingJobs) ? pendingJobs : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const safeBatchRuns = Array.isArray(batchRuns) ? batchRuns : [];

  const totalFeeLogsPkr = safeFeeLogs.reduce((acc, log) => acc + (log?.amount || 0), 0);
  const totalSubscribersPkr = safeSubscribers.reduce((acc, s) => acc + (s?.amountPaid || 0), 0);
  const userTransactionsPkr = safeUsers.reduce((acc, u) => {
    return acc + (u?.transactions?.reduce((tAcc, t) => tAcc + (t?.status === 'Success' ? t.amount : 0), 0) || 0);
  }, 0);

  const totalGrossRevenuePkr = totalFeeLogsPkr + totalSubscribersPkr + Math.max(0, userTransactionsPkr - totalSubscribersPkr);

  // Convert to selected currency
  const convertPkr = (amountPkr: number) => {
    if (selectedCurrencyView === 'PKR') return amountPkr;
    const rate = currencyConfig?.rates?.[selectedCurrencyView] || 0.0036;
    return Math.round(amountPkr * rate);
  };

  // Geographic Breakdown
  const regionCounts = safeJobs.reduce((acc, job) => {
    const r = job?.region || 'Global';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Scraper Health
  const totalScrapedInAudit = safeAuditLogs.length;
  const approvedScraped = safeAuditLogs.filter(a => a?.status === 'Approved Live' || a?.status === 'Auto-Approved').length;
  const scraperSuccessRate = totalScrapedInAudit > 0 ? Math.round((approvedScraped / totalScrapedInAudit) * 100) : 98;

  // Employer vs Job Seeker ratio
  const employersCount = safeUsers.filter(u => u?.role?.toLowerCase()?.includes('employer') || u?.companyName).length;
  const seekersCount = Math.max(0, safeUsers.length - employersCount);

  return (
    <div className="space-y-6 text-white">
      {/* Top Banner & Fast Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 font-black text-[10px] tracking-wider uppercase border border-amber-500/30">
                Executive Command
              </span>
              <span className="text-xs text-slate-400 font-mono">
                System Status: <span className="text-emerald-400 font-bold">● Operational (All Clusters Active)</span>
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2">
              <span>Platform Intelligence & Global Metrics</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl mt-1">
              Real-time monitoring across international job ingestion engines, subscriber MRR, employer monetization, and government gazette feeds.
            </p>
          </div>

          {/* Quick Currency & Time Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
              {(['PKR', 'USD', 'AED', 'SAR'] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setSelectedCurrencyView(curr)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedCurrencyView === curr
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
              {(['today', '7days', '30days', 'all'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                    timeRange === t
                      ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'all' ? 'All Time' : t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PRIMARY 4-METRIC GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Gross Revenue */}
        <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Gross Platform Revenue</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {selectedCurrencyView} {convertPkr(totalGrossRevenuePkr).toLocaleString()}
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-emerald-400 mt-1 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+24.6% vs last month</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Per-Job Fees: {selectedCurrencyView} {convertPkr(totalFeeLogsPkr).toLocaleString()}</span>
            <button
              onClick={() => onNavigateTab('fee-logs')}
              className="text-amber-400 hover:underline font-bold"
            >
              View Logs →
            </button>
          </div>
        </div>

        {/* Metric 2: Live Active Jobs */}
        <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Active Listings</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {safeJobs.length.toLocaleString()}
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-amber-400 mt-1 font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>{safePendingJobs.length} in approval queue</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Govt / FPSC: {safeJobs.filter(j => j?.isGovtJob).length}</span>
            <button
              onClick={() => onNavigateTab('pending')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Review Queue →
            </button>
          </div>
        </div>

        {/* Metric 3: User Directory & Employers */}
        <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Registered Users</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {safeUsers.length.toLocaleString()}
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-indigo-400 mt-1 font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>{employersCount} Verified Employers</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Candidates: {seekersCount}</span>
            <button
              onClick={() => onNavigateTab('user-audit')}
              className="text-indigo-400 hover:underline font-bold cursor-pointer"
            >
              User Directory →
            </button>
          </div>
        </div>

        {/* Metric 4: Ingestion Scraper Throughput */}
        <div className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Scraper Throughput & Health</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Bot className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {scraperSuccessRate}%
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-cyan-400 mt-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{safeBatchRuns.length} automated runs executed</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Total Ingested: {safeAuditLogs.length}</span>
            <button
              onClick={() => onNavigateTab('scraped-history')}
              className="text-cyan-400 hover:underline font-bold cursor-pointer"
            >
              Audit Trail →
            </button>
          </div>
        </div>

      </div>

      {/* DETAILED SECONDARY SECTION: REGIONAL DISTRIBUTION & REVENUE STREAMS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Regional Distribution Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <span>International & Regional Vacancy Mix</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{safeJobs.length} Total</span>
          </div>

          <div className="space-y-3">
            {(Object.entries(regionCounts) as [string, number][]).map(([regionName, count]) => {
              const pct = Math.round((Number(count) / (safeJobs.length || 1)) * 100);
              return (
                <div key={regionName} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">{regionName}</span>
                    <span className="font-mono text-amber-400 font-bold">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Includes FPSC, WAPDA, UAE & Remote</span>
            <button
              onClick={() => onNavigateTab('currency-forex')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Exchange Rates & Regions →
            </button>
          </div>
        </div>

        {/* Revenue Streams Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Monetization & Channel Streams</span>
            </h3>
            <span className="text-xs font-mono text-emerald-400 font-bold">100% Retained</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Per-Job Posting Paywall</div>
                <div className="text-[10px] text-slate-400">{safeFeeLogs.length} Employer Transactions</div>
              </div>
              <div className="text-right font-mono font-bold text-emerald-400">
                {selectedCurrencyView} {convertPkr(totalFeeLogsPkr).toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Candidate Pro Alert Subscriptions</div>
                <div className="text-[10px] text-slate-400">{safeSubscribers.length} WhatsApp Subscribers</div>
              </div>
              <div className="text-right font-mono font-bold text-indigo-400">
                {selectedCurrencyView} {convertPkr(totalSubscribersPkr).toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Banner & Feed Ad Campaigns</div>
                <div className="text-[10px] text-slate-400">Targeted Employer Banners</div>
              </div>
              <div className="text-right font-mono font-bold text-amber-400">
                {selectedCurrencyView} {convertPkr(18500).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Instant payouts supported via JazzCash & Stripe</span>
            <button
              onClick={() => onNavigateTab('advertisements')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Ad Campaign Hub →
            </button>
          </div>
        </div>

        {/* Quick Admin Actions & System Triggers */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Admin Speed Actions</span>
            </h3>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded">Fast Lane</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <button
              onClick={() => onNavigateTab('add-job')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <div className="text-amber-400 font-black">+ Post Job</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Manual publication</div>
            </button>

            <button
              onClick={() => onNavigateTab('broadcast')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <div className="text-indigo-400 font-black">📢 Broadcast</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Email & WhatsApp blast</div>
            </button>

            <button
              onClick={() => onNavigateTab('ai-quality')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <div className="text-emerald-400 font-black">✨ AI Audit</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Quality & SEO score</div>
            </button>

            <button
              onClick={() => onNavigateTab('backup-hub')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <div className="text-cyan-400 font-black">💾 Backup</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">1-Click JSON export</div>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
            💡 <strong>Pro Tip:</strong> Use the <strong>AI Quality Auditor</strong> to automatically normalize scraped BPS scales and format salaries into international standards.
          </div>
        </div>

      </div>
    </div>
  );
};
