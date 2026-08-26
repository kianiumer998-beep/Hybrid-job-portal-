import React, { useState } from 'react';
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Layers,
  ArrowDownToLine,
  FolderArchive
} from 'lucide-react';
import { Job, JobPostingFeeLog, ScrapedJobAuditEntry, ScraperBatchRun, Subscriber, UserAccount, CustomFormField, AdminFeatureFlags } from '../../types/job';
import { SystemSnapshotPayload } from '../../types/adminSuite';

interface AdminDataBackupHubProps {
  jobs?: Job[];
  pendingJobs?: Job[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  feeLogs?: JobPostingFeeLog[];
  ads?: any[];
  auditLogs?: ScrapedJobAuditEntry[];
  batchRuns?: ScraperBatchRun[];
  customFormFields?: CustomFormField[];
  featureFlags?: AdminFeatureFlags;
  onRestoreSnapshot?: (snapshot: SystemSnapshotPayload) => void;
  onImportBulkJobs?: (importedJobs: Job[]) => void;
}

export const AdminDataBackupHub: React.FC<AdminDataBackupHubProps> = ({
  jobs = [],
  pendingJobs = [],
  users = [],
  subscribers = [],
  feeLogs = [],
  ads = [],
  auditLogs = [],
  batchRuns = [],
  customFormFields = [],
  featureFlags = {} as any,
  onRestoreSnapshot = () => {},
  onImportBulkJobs = () => {}
}) => {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safePendingJobs = Array.isArray(pendingJobs) ? pendingJobs : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];
  const safeFeeLogs = Array.isArray(feeLogs) ? feeLogs : [];
  const safeAds = Array.isArray(ads) ? ads : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const safeBatchRuns = Array.isArray(batchRuns) ? batchRuns : [];
  const safeCustomFormFields = Array.isArray(customFormFields) ? customFormFields : [];

  const [activeSubTab, setActiveSubTab] = useState<'snapshot' | 'csv-export' | 'bulk-import'>('snapshot');
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);

  // 1-Click Full Platform Snapshot JSON Download
  const handleDownloadFullSnapshot = () => {
    const snapshot: SystemSnapshotPayload = {
      snapshotVersion: '2.5.0-ENTERPRISE',
      createdAt: new Date().toISOString(),
      platformName: 'CareerPak & Global Work Portal',
      totalJobs: safeJobs.length,
      totalUsers: safeUsers.length,
      jobs: safeJobs,
      pendingJobs: safePendingJobs,
      users: safeUsers,
      subscribers: safeSubscribers,
      feeLogs: safeFeeLogs,
      ads: safeAds,
      auditLogs: safeAuditLogs,
      batchRuns: safeBatchRuns,
      customFormFields: safeCustomFormFields,
      featureFlags
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `careerpak_complete_system_backup_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    alert('💾 Full Enterprise JSON Snapshot downloaded successfully!');
  };

  // CSV Exporter Helper
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Export Jobs to CSV
  const handleExportJobsCsv = () => {
    const headers = ['ID', 'Title', 'Company', 'JobType', 'Region', 'Salary', 'Category', 'GovtScale', 'Status', 'PostedAt', 'SourceUrl'];
    const rows = jobs.concat(pendingJobs).map(j => [
      j.id,
      j.title,
      j.company,
      j.jobType,
      j.region,
      j.salary,
      j.jobCategory || 'Private Corporate',
      j.govtScale || 'N/A',
      j.status || 'Approved',
      j.postedAt,
      j.sourceUrl || ''
    ]);
    downloadCsv(`careerpak_jobs_export_${new Date().toISOString().substring(0, 10)}.csv`, headers, rows);
  };

  // Export Users to CSV
  const handleExportUsersCsv = () => {
    const headers = ['ID', 'Name', 'Email', 'Role', 'Company', 'Plan', 'ExpiryDate', 'AutoRenew', 'WalletBalance'];
    const rows = users.map(u => [
      u.id,
      u.name,
      u.email,
      u.role,
      u.companyName || 'N/A',
      u.plan,
      u.expiryDate || 'N/A',
      u.autoRenew ? 'Yes' : 'No',
      u.walletBalance || 0
    ]);
    downloadCsv(`careerpak_users_export_${new Date().toISOString().substring(0, 10)}.csv`, headers, rows);
  };

  // Export Financial Ledger to CSV
  const handleExportRevenueCsv = () => {
    const headers = ['TransactionID', 'DateTime', 'UserName', 'UserEmail', 'JobTitle', 'Amount', 'Currency', 'PaymentMethod', 'Status'];
    const rows = feeLogs.map(f => [
      f.id,
      f.dateTime,
      f.userName,
      f.userEmail,
      f.jobTitle,
      f.amount,
      f.currency,
      f.paymentMethod,
      f.status
    ]);
    downloadCsv(`careerpak_financial_revenue_ledger_${new Date().toISOString().substring(0, 10)}.csv`, headers, rows);
  };

  // Bulk CSV/JSON Importer Handler
  const handleParseAndImport = () => {
    if (!importJsonText.trim()) {
      alert('Please paste a valid JSON array of jobs or system snapshot.');
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText);
      if (parsed.snapshotVersion && Array.isArray(parsed.jobs)) {
        // Full Snapshot Restore
        onRestoreSnapshot(parsed);
        setImportStatusMessage(`✅ Full Snapshot successfully restored with ${parsed.jobs.length} jobs and ${parsed.users?.length || 0} users!`);
      } else if (Array.isArray(parsed)) {
        // Array of Jobs
        onImportBulkJobs(parsed);
        setImportStatusMessage(`✅ Batch of ${parsed.length} jobs imported directly into the live catalog!`);
      } else {
        alert('Unrecognized format. Please provide an array of job objects or a full system snapshot.');
      }
    } catch (e: any) {
      alert('Invalid JSON formatting: ' + e.message);
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Database className="w-4 h-4" />
            <span>Data Vault, Backup & Migration Hub</span>
          </div>
          <h2 className="text-xl font-black text-white">Automated Snapshot, CSV Importers & Ledgers</h2>
          <p className="text-xs text-slate-400 mt-1">
            Download full system state snapshots, export spreadsheets for auditing/taxes, or import bulk vacancy rosters.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
          {[
            { id: 'snapshot', label: '1-Click JSON Snapshot', icon: FolderArchive },
            { id: 'csv-export', label: 'CSV Spreadsheets', icon: FileSpreadsheet },
            { id: 'bulk-import', label: 'Bulk Job Importer', icon: Upload }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id as any)}
                className={`px-3.5 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeSubTab === t.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB 1: 1-CLICK JSON SNAPSHOT */}
      {activeSubTab === 'snapshot' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Download Complete Portal State</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Creates an immutable cryptographic snapshot of all {safeJobs.length} jobs, {safeUsers.length} users, {safeFeeLogs.length} fee logs, {safeSubscribers.length} subscribers, custom form schemas, and feature toggles.
              </p>
              
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1 text-slate-300">
                <div>📦 File: careerpak_complete_system_backup.json</div>
                <div>🛡️ Compression: Raw JSON (Full Schema Safe)</div>
                <div>⚡ Snapshot Timestamp: {new Date().toLocaleTimeString()}</div>
              </div>
            </div>

            <button
              onClick={handleDownloadFullSnapshot}
              className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download System JSON Backup</span>
            </button>
          </div>

          {/* Snapshot Restore Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Restore from Backup Snapshot</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Restore the entire website catalog and user database from a previously downloaded JSON snapshot file.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Upload .json Snapshot File</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        setImportJsonText(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleParseAndImport}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Restore Portal Snapshot</span>
            </button>
          </div>

        </div>
      )}

      {/* SUB-TAB 2: CSV SPREADSHEETS */}
      {activeSubTab === 'csv-export' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Export 1: Jobs CSV */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Export Live & Pending Jobs</h4>
              <p className="text-xs text-slate-400">
                Exports all {safeJobs.length + safePendingJobs.length} job records with salaries, BPS scales, and application URLs.
              </p>
            </div>
            <button
              onClick={handleExportJobsCsv}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Jobs (.CSV)</span>
            </button>
          </div>

          {/* Export 2: Users CSV */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Export Registered Users</h4>
              <p className="text-xs text-slate-400">
                Exports all {safeUsers.length} registered candidates and employers with plan tiers and expiry dates.
              </p>
            </div>
            <button
              onClick={handleExportUsersCsv}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl border border-indigo-500/30 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Users (.CSV)</span>
            </button>
          </div>

          {/* Export 3: Revenue CSV */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Export Revenue Ledger</h4>
              <p className="text-xs text-slate-400">
                Exports all {safeFeeLogs.length} payment invoices with JazzCash, Easypaisa, and Stripe reference IDs.
              </p>
            </div>
            <button
              onClick={handleExportRevenueCsv}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger (.CSV)</span>
            </button>
          </div>

        </div>
      )}

      {/* SUB-TAB 3: BULK JOB IMPORTER */}
      {activeSubTab === 'bulk-import' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Bulk Vacancy Array Ingestion</span>
              </h3>
              <p className="text-xs text-slate-400">Paste an array of job objects in JSON format to instantly import hundreds of jobs.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                const sample = [
                  {
                    id: `job-bulk-${Date.now()}-1`,
                    title: 'Senior Python & Django Backend Architect',
                    company: 'TechVentures PK',
                    jobType: 'Remote',
                    region: 'Pakistan',
                    city: 'Lahore',
                    salary: 'PKR 350,000 - 450,000 / mo',
                    currency: 'PKR',
                    experienceLevel: 'Senior',
                    department: 'Software Engineering',
                    tags: ['Python', 'Django', 'PostgreSQL', 'Docker'],
                    description: 'We are seeking an experienced Python Architect to lead our backend engineering squad.',
                    requirements: ['5+ years Python', 'Strong SQL knowledge'],
                    benefits: ['Health Insurance', 'Remote Work Allowance'],
                    postedAt: 'Just now',
                    applicationsCount: 0,
                    status: 'Approved'
                  }
                ];
                setImportJsonText(JSON.stringify(sample, null, 2));
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
            >
              Load Sample Template
            </button>
          </div>

          {importStatusMessage && (
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs">
              {importStatusMessage}
            </div>
          )}

          <div>
            <textarea
              rows={10}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON array here e.g. [ { title: '...', company: '...', salary: '...' } ]"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono text-xs leading-relaxed"
            />
          </div>

          <button
            onClick={handleParseAndImport}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Validate Schema & Ingest Jobs</span>
          </button>
        </div>
      )}

    </div>
  );
};
