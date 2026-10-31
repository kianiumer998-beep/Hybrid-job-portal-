import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Settings, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Unlock, 
  EyeOff, 
  RefreshCw, 
  Search, 
  Filter,
  CheckSquare,
  Square,
  Sliders,
  Database,
  Check
} from 'lucide-react';
import { api } from '../../services/api';
import { Job, FieldVisibility, JobSourceType } from '../../types/job';

const ALL_REGISTRY_FIELDS = [
  { key: 'title', label: 'Job Title' },
  { key: 'company', label: 'Company Name' },
  { key: 'companyLogo', label: 'Company Logo' },
  { key: 'jobType', label: 'Job Type (Remote/On-site)' },
  { key: 'region', label: 'Region' },
  { key: 'country', label: 'Country' },
  { key: 'province', label: 'Province' },
  { key: 'city', label: 'City' },
  { key: 'district', label: 'District' },
  { key: 'salary', label: 'Salary Information' },
  { key: 'experienceLevel', label: 'Experience Level' },
  { key: 'department', label: 'Department' },
  { key: 'tags', label: 'Required Skills & Tags' },
  { key: 'description', label: 'Job Description' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'responsibilities', label: 'Responsibilities' },
  { key: 'benefits', label: 'Benefits & Perks' },
  { key: 'deadlineDate', label: 'Deadline Date' },
  { key: 'attachments', label: 'Official Documents & Attachments' },
  { key: 'applicationUrl', label: 'Application URL / Apply Link' },
  { key: 'contactEmail', label: 'Contact Email' }
];

export const JobVisibilityDefaultsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'defaults' | 'individual' | 'bulk'>('defaults');
  const [defaultSource, setDefaultSource] = useState<JobSourceType>('user_posted');
  const [policies, setPolicies] = useState<any[]>([]);
  const [currentFieldRules, setCurrentFieldRules] = useState<Record<string, FieldVisibility>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Management State
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [bulkFieldRules, setBulkFieldRules] = useState<Record<string, FieldVisibility>>({
    applicationUrl: 'Premium',
    contactEmail: 'Premium',
    attachments: 'Premium'
  });
  const [selectedBulkFields, setSelectedBulkFields] = useState<string[]>(['applicationUrl', 'contactEmail', 'attachments']);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Load Policies
  const fetchPolicies = async () => {
    try {
      const res = await api.jobsVisibility.getPolicies();
      if (res.success && Array.isArray(res.policies)) {
        setPolicies(res.policies);
        const match = res.policies.find((p: any) => p.source === defaultSource && !p.sourceKey);
        if (match && match.fieldRules) {
          setCurrentFieldRules(match.fieldRules);
        } else {
          // Initialize defaults
          const defs: Record<string, FieldVisibility> = {};
          ALL_REGISTRY_FIELDS.forEach(f => {
            defs[f.key] = ['applicationUrl', 'contactEmail', 'attachments'].includes(f.key) ? 'Premium' : 'Free';
          });
          setCurrentFieldRules(defs);
        }
      }
    } catch (err: any) {
      console.error('Failed to load visibility policies:', err);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [defaultSource]);

  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await api.jobs.getAll({ limit: '500' });
      if (res.success && Array.isArray(res.jobs)) {
        setJobsList(res.jobs);
      }
    } catch (err: any) {
      console.error('Failed to load jobs for visibility management:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bulk' || activeTab === 'individual') {
      loadJobs();
    }
  }, [activeTab]);

  const handleSaveDefaultPolicy = async () => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.jobsVisibility.savePolicy({
        source: defaultSource,
        fieldRules: currentFieldRules
      });
      if (res.success) {
        setSuccessMessage(`Successfully saved default visibility policy for ${defaultSource === 'user_posted' ? 'User-created' : defaultSource === 'scraped' ? 'Scraped' : 'Admin-created'} jobs!`);
        fetchPolicies();
      } else {
        throw new Error(res.message || 'Failed to save policy.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving default policy.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldRuleChange = (fieldKey: string, visibility: FieldVisibility) => {
    setCurrentFieldRules(prev => ({
      ...prev,
      [fieldKey]: visibility
    }));
  };

  const handleBulkFieldRuleChange = (fieldKey: string, visibility: FieldVisibility) => {
    setBulkFieldRules(prev => ({
      ...prev,
      [fieldKey]: visibility
    }));
  };

  const toggleBulkFieldSelection = (fieldKey: string) => {
    setSelectedBulkFields(prev => 
      prev.includes(fieldKey) ? prev.filter(k => k !== fieldKey) : [...prev, fieldKey]
    );
  };

  // Filtered jobs
  const filteredJobs = jobsList.filter(j => {
    if (sourceFilter !== 'All') {
      const src = j.sourceType === 'scraped' ? 'scraped' : j.sourceType === 'admin_created' ? 'admin_created' : 'user_posted';
      if (src !== sourceFilter) return false;
    }
    if (statusFilter !== 'All' && j.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = j.title?.toLowerCase().includes(q);
      const matchComp = j.company?.toLowerCase().includes(q);
      const matchId = j.id?.toLowerCase().includes(q);
      if (!matchTitle && !matchComp && !matchId) return false;
    }
    return true;
  });

  const handleSelectAllFiltered = () => {
    if (selectedJobIds.length === filteredJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(filteredJobs.map(j => j.id));
    }
  };

  const toggleJobSelection = (id: string) => {
    setSelectedJobIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const executeBulkUpdate = async () => {
    if (selectedJobIds.length === 0 || selectedBulkFields.length === 0) return;
    setIsBulkExecuting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payloadRules: Record<string, FieldVisibility> = {};
    for (const f of selectedBulkFields) {
      payloadRules[f] = bulkFieldRules[f] || 'Free';
    }

    try {
      const res = await api.jobsVisibility.bulkUpdateVisibility({
        jobIds: selectedJobIds,
        fieldVisibility: payloadRules,
        selectedFields: selectedBulkFields
      });

      if (res.success) {
        setSuccessMessage(`Successfully updated visibility for ${res.successCount} jobs!`);
        setSelectedJobIds([]);
        setPreviewModalOpen(false);
        loadJobs();
      } else {
        throw new Error(res.message || 'Bulk update completed with errors.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error executing bulk visibility update.');
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const updateSingleJobField = async (jobId: string, fieldKey: string, visibility: FieldVisibility) => {
    try {
      const job = jobsList.find(j => j.id === jobId);
      if (!job) return;
      const updatedRules = {
        ...(job.fieldVisibility || {}),
        [fieldKey]: visibility
      };

      const res = await api.jobsVisibility.updateJobVisibility(jobId, updatedRules);
      if (res.success) {
        setJobsList(prev => prev.map(j => j.id === jobId ? { ...j, fieldVisibility: updatedRules } : j));
        setSuccessMessage(`Updated "${fieldKey}" to ${visibility} for job "${job.title}".`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      alert(`Error updating job visibility: ${err?.message || 'Unexpected failure'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Central Administration</span>
          </div>
          <h2 className="text-xl font-black text-white mt-1">Universal Job Visibility & Approval Policies</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage future default policies for all job sources, individual overrides, and bulk field-level Free/Premium/Hidden controls.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('defaults')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'defaults' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Future Default Policies
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'bulk' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Bulk Visibility Manager
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'individual' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Individual Job Overrides
          </button>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: FUTURE DEFAULT POLICIES */}
      {activeTab === 'defaults' && (
        <div className="space-y-6">
          {/* Source Sub-tabs */}
          <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
            <button
              onClick={() => setDefaultSource('user_posted')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${defaultSource === 'user_posted' ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
            >
              1. User-Created Job Policy
            </button>
            <button
              onClick={() => setDefaultSource('scraped')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${defaultSource === 'scraped' ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
            >
              2. Scraped Job Policy
            </button>
            <button
              onClick={() => setDefaultSource('admin_created')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${defaultSource === 'admin_created' ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
            >
              3. Admin-Created Job Policy
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Configuring Default Policy for: <span className="text-indigo-400 capitalize">{defaultSource.replace('_', ' ')} Jobs</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  When future jobs of this source are approved or created, these visibility rules will automatically apply. Existing jobs remain unaffected unless edited.
                </p>
              </div>

              <button
                onClick={handleSaveDefaultPolicy}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Default Policy</span>
              </button>
            </div>

            {/* Field Registry Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-4">Job Field</th>
                    <th className="p-4">Description / Schema Property</th>
                    <th className="p-4 text-center">Free Access</th>
                    <th className="p-4 text-center">Premium Only</th>
                    <th className="p-4 text-center">Hidden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {ALL_REGISTRY_FIELDS.map(field => {
                    const currentVal = currentFieldRules[field.key] || 'Free';
                    return (
                      <tr key={field.key} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-4 font-bold text-white">{field.label}</td>
                        <td className="p-4 text-slate-400 font-mono text-[11px]">{field.key}</td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleFieldRuleChange(field.key, 'Free')}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${currentVal === 'Free' ? 'bg-emerald-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                          >
                            Free
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleFieldRuleChange(field.key, 'Premium')}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${currentVal === 'Premium' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                          >
                            Premium
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleFieldRuleChange(field.key, 'Hidden')}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${currentVal === 'Hidden' ? 'bg-rose-500 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                          >
                            Hidden
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

      {/* TAB 2: BULK VISIBILITY MANAGER */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Bulk Visibility Management</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Filter existing jobs across all sources and apply field-level visibility changes in bulk.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setPreviewModalOpen(true)}
                  disabled={selectedJobIds.length === 0 || selectedBulkFields.length === 0}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Preview & Apply to Selected ({selectedJobIds.length})</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Title, company, or ID..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Job Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Sources</option>
                  <option value="user_posted">User-Created</option>
                  <option value="scraped">Scraped</option>
                  <option value="admin_created">Admin-Created</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={loadJobs}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Jobs</span>
                </button>
              </div>
            </div>

            {/* Bulk Field Selection & Target Rules */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Select Fields & Target Visibility to Apply in Bulk</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['applicationUrl', 'contactEmail', 'attachments', 'salary', 'description', 'requirements'].map(fKey => {
                  const isSelected = selectedBulkFields.includes(fKey);
                  return (
                    <div key={fKey} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleBulkFieldSelection(fKey)}
                        className="flex items-center space-x-2 text-xs font-bold text-white text-left truncate cursor-pointer"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" /> : <Square className="w-4 h-4 text-slate-600 shrink-0" />}
                        <span className="truncate capitalize">{fKey}</span>
                      </button>

                      {isSelected && (
                        <select
                          value={bulkFieldRules[fKey] || 'Free'}
                          onChange={(e) => handleBulkFieldRuleChange(fKey, e.target.value as FieldVisibility)}
                          className="bg-slate-950 border border-slate-800 rounded text-[11px] text-indigo-300 px-1.5 py-1 focus:outline-none"
                        >
                          <option value="Free">Free</option>
                          <option value="Premium">Premium</option>
                          <option value="Hidden">Hidden</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Jobs Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSelectAllFiltered}
                    className="flex items-center space-x-2 text-white font-bold cursor-pointer"
                  >
                    {selectedJobIds.length === filteredJobs.length && filteredJobs.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                    <span>Select All Filtered ({filteredJobs.length})</span>
                  </button>
                </div>
                <span>Selected: <strong className="text-white">{selectedJobIds.length}</strong></span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-3 w-10"></th>
                    <th className="p-3">Job Title & Company</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Active Rules Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {loadingJobs ? 'Loading jobs...' : 'No jobs found matching criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map(job => {
                      const isSelected = selectedJobIds.includes(job.id);
                      const src = job.sourceType === 'scraped' ? 'Scraped' : job.sourceType === 'admin_created' ? 'Admin' : 'User';
                      const rulesCount = Object.keys(job.fieldVisibility || {}).length;

                      return (
                        <tr key={job.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleJobSelection(job.id)}
                              className="cursor-pointer"
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white truncate max-w-xs">{job.title}</div>
                            <div className="text-[11px] text-slate-400 truncate">{job.company} • {job.city || 'Remote'}</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {src}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${job.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}`}>
                              {job.status || 'Approved'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {rulesCount > 0 ? `${rulesCount} field overrides configured` : 'Using source default rules'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INDIVIDUAL JOB OVERRIDES */}
      {activeTab === 'individual' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Individual Job Visibility Editor</h3>
              <p className="text-xs text-slate-400 mt-1">
                Customize visibility rules for individual jobs independently of source defaults.
              </p>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-4">Job Title & Company</th>
                    <th className="p-4">Source</th>
                    <th className="p-4">Key Field Overrides</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {jobsList.slice(0, 30).map(job => (
                    <tr key={job.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white">{job.title}</div>
                        <div className="text-[11px] text-slate-400">{job.company}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {job.sourceType === 'scraped' ? 'Scraped' : 'User / Admin'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {['applicationUrl', 'contactEmail', 'attachments', 'salary'].map(fKey => {
                            const current = job.fieldVisibility?.[fKey] || 'Free';
                            return (
                              <div key={fKey} className="flex items-center space-x-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                                <span className="text-[10px] text-slate-400 capitalize">{fKey}:</span>
                                <select
                                  value={current}
                                  onChange={(e) => updateSingleJobField(job.id, fKey, e.target.value as FieldVisibility)}
                                  className="bg-transparent text-indigo-300 font-bold text-[11px] focus:outline-none cursor-pointer"
                                >
                                  <option value="Free">Free</option>
                                  <option value="Premium">Premium</option>
                                  <option value="Hidden">Hidden</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Confirm Bulk Visibility Update</h3>
            <p className="text-xs text-slate-300">
              You are about to update visibility rules for <strong className="text-indigo-400">{selectedJobIds.length}</strong> selected jobs.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-300">
              <div><strong>Target Fields:</strong> {selectedBulkFields.join(', ')}</div>
              <div><strong>New Visibility:</strong> {JSON.stringify(bulkFieldRules)}</div>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBulkUpdate}
                disabled={isBulkExecuting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer flex items-center space-x-2"
              >
                {isBulkExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Confirm & Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
