import React, { useState, useEffect, useMemo } from 'react';
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
  Check,
  User,
  Globe,
  Terminal,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api';
import { Job, FieldVisibility, JobSourceType } from '../../types/job';

const ALL_REGISTRY_FIELDS = [
  { key: 'title', label: 'Job Title' },
  { key: 'company', label: 'Company Name' },
  { key: 'companyLogo', label: 'Company Logo' },
  { key: 'jobType', label: 'Job Type' },
  { key: 'region', label: 'Region' },
  { key: 'country', label: 'Country' },
  { key: 'province', label: 'Province' },
  { key: 'city', label: 'City' },
  { key: 'district', label: 'District' },
  { key: 'salary', label: 'Salary Information' },
  { key: 'salaryNumericMin', label: 'Numeric Min Salary' },
  { key: 'currency', label: 'Currency' },
  { key: 'experienceLevel', label: 'Experience Level' },
  { key: 'department', label: 'Department' },
  { key: 'tags', label: 'Tags' },
  { key: 'description', label: 'Description' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'responsibilities', label: 'Responsibilities' },
  { key: 'benefits', label: 'Benefits' },
  { key: 'postedAt', label: 'Posted At' },
  { key: 'featured', label: 'Featured Status' },
  { key: 'urgent', label: 'Urgent Status' },
  { key: 'isPinnedTop', label: 'Pinned Top' },
  { key: 'isFutureJob', label: 'Future Job' },
  { key: 'futureIntakeDate', label: 'Future Intake Date' },
  { key: 'priorityTier', label: 'Priority Tier' },
  { key: 'applicationsCount', label: 'Applications Count' },
  { key: 'status', label: 'Job Status' },
  { key: 'rejectionReason', label: 'Rejection Reason' },
  { key: 'suspensionReason', label: 'Suspension Reason' },
  { key: 'isSuspended', label: 'Is Suspended' },
  { key: 'submittedByUserId', label: 'Submitter / Owner ID' },
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'jobCategory', label: 'Job Category' },
  { key: 'sourceUrl', label: 'Source URL' },
  { key: 'scraperSourceId', label: 'Scraper ID' },
  { key: 'scraperSourceName', label: 'Scraper Name' },
  { key: 'scrapedSourceDomain', label: 'Scraped Domain' },
  { key: 'scrapedAt', label: 'Scraped At' },
  { key: 'applicationUrl', label: 'Application URL' },
  { key: 'contactEmail', label: 'Contact Email' },
  { key: 'contactEmailOrPhone', label: 'Contact Info' },
  { key: 'deadlineDate', label: 'Deadline' },
  { key: 'scraperBatchId', label: 'Scraper Batch' },
  { key: 'scraperRunType', label: 'Scraper Type' },
  { key: 'isGovtJob', label: 'Govt Job' },
  { key: 'govtDepartment', label: 'Govt Department' },
  { key: 'govtScale', label: 'Govt Scale' },
  { key: 'govtCategory', label: 'Govt Category' },
  { key: 'isNewspaperAd', label: 'Newspaper Ad' },
  { key: 'newspaperName', label: 'Newspaper' },
  { key: 'clippingImageUrl', label: 'Clipping Image' },
  { key: 'mediaUrl', label: 'Media URL' },
  { key: 'newspaperDate', label: 'Newspaper Date' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'externalApplyUrl', label: 'External Apply URL' },
  { key: 'pdfSourceUrl', label: 'PDF Source URL' },
  { key: 'pdfFileName', label: 'PDF Filename' },
  { key: 'pdfCaseNumber', label: 'PDF Case Number' },
  { key: 'domicileQuota', label: 'Domicile Quota' },
  { key: 'challanFee', label: 'Challan Fee' },
  { key: 'extractedText', label: 'Extracted Text' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'updatedAt', label: 'Updated At' }
];

export const JobVisibilityDefaultsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'defaults' | 'individual' | 'bulk'>('defaults');
  const [defaultSource, setDefaultSource] = useState<JobSourceType>('user_posted');
  const [policies, setPolicies] = useState<any[]>([]);
  const [currentFieldRules, setCurrentFieldRules] = useState<Record<string, FieldVisibility>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Universal Management State (Live + Pending)
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [scraperFilter, setScraperFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  
  // Bulk Management State
  const [bulkFieldRules, setBulkFieldRules] = useState<Record<string, FieldVisibility>>({
    applicationUrl: 'Premium',
    contactEmail: 'Premium',
    attachments: 'Premium',
    externalApplyUrl: 'Premium'
  });
  const [selectedBulkFields, setSelectedBulkFields] = useState<string[]>(['applicationUrl', 'contactEmail', 'attachments', 'externalApplyUrl']);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failure: number; errors: any[] } | null>(null);

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
          // Initialize defaults from registry
          const defs: Record<string, FieldVisibility> = {};
          ALL_REGISTRY_FIELDS.forEach(f => {
            const premiumFields = ['applicationUrl', 'contactEmail', 'contactEmailOrPhone', 'attachments', 'externalApplyUrl', 'sourceUrl', 'pdfSourceUrl'];
            defs[f.key] = premiumFields.includes(f.key) ? 'Premium' : 'Free';
          });
          setCurrentFieldRules(defs);
        }
      }
    } catch (err: any) {
      console.error('Failed to load visibility policies:', err);
      setErrorMessage('Failed to connect to authoritative policy source.');
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [defaultSource]);

  const loadJobs = async () => {
    setLoadingJobs(true);
    setErrorMessage(null);
    try {
      // Use Admin Universal endpoint to get Live + Pending
      const res = await api.jobs.getAdminAll();
      if (res.success && Array.isArray(res.jobs)) {
        setJobsList(res.jobs);
      } else {
        throw new Error(res.message || 'Failed to fetch universal job list.');
      }
    } catch (err: any) {
      console.error('Failed to load jobs for visibility management:', err);
      setErrorMessage('Access Denied or Connection Error: Could not fetch universal job list.');
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
        setSuccessMessage(`Authoritative default policy updated for ${defaultSource.replace('_', ' ')} source.`);
        fetchPolicies();
      } else {
        throw new Error(res.message || 'Validation failed on backend.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Security Error: Could not persist policy.');
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

  // Filtered jobs with Owner and Scraper Support
  const filteredJobs = useMemo(() => {
    return jobsList.filter(j => {
      if (sourceFilter !== 'All') {
        const src = j.sourceType || (j.isScraped ? 'scraped' : j.isAdminCreated ? 'admin_created' : 'user_posted');
        if (src !== sourceFilter) return false;
      }
      if (statusFilter !== 'All' && (j.status || 'Pending') !== statusFilter) return false;
      
      if (ownerFilter.trim()) {
        const owner = (j.submittedByUserId || '').toLowerCase();
        if (!owner.includes(ownerFilter.toLowerCase())) return false;
      }
      
      if (scraperFilter.trim()) {
        const scraper = (j.scraperSourceId || '').toLowerCase();
        if (!scraper.includes(scraperFilter.toLowerCase())) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (j.title || '').toLowerCase().includes(q);
        const matchComp = (j.company || '').toLowerCase().includes(q);
        const matchId = (j.id || '').toLowerCase().includes(q);
        if (!matchTitle && !matchComp && !matchId) return false;
      }
      return true;
    });
  }, [jobsList, sourceFilter, statusFilter, ownerFilter, scraperFilter, searchQuery]);

  const handleSelectAllFiltered = () => {
    if (selectedJobIds.length === filteredJobs.length && filteredJobs.length > 0) {
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
    setBulkResult(null);

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

      if (res.success || res.successCount > 0) {
        setBulkResult({
          success: res.successCount,
          failure: res.failureCount,
          errors: res.errors || []
        });
        if (res.success) {
          setSuccessMessage(`Successfully updated visibility for ${res.successCount} jobs.`);
        } else {
          setErrorMessage(`Bulk update finished with ${res.failureCount} errors.`);
        }
        setSelectedJobIds([]);
        loadJobs();
      } else {
        throw new Error(res.message || 'Bulk operation rejected by server.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Critical error during bulk operation.');
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
        setSuccessMessage(`Field "${fieldKey}" restricted to ${visibility} for job "${job.title}".`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      alert(`Backend Validation Error: ${err?.message || 'Update rejected.'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Authoritative Visibility Engine</span>
          </div>
          <h2 className="text-xl font-black text-white mt-1">Universal Job Visibility & Approval Policies</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Backend-enforced redaction for Free/Premium/Hidden fields across all production job sources.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('defaults')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'defaults' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Default Source Policies
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'bulk' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Universal Bulk Editor
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'individual' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Individual Overrides
          </button>
        </div>
      </div>

      {/* Message Banners */}
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

      {/* TAB 1: DEFAULT SOURCE POLICIES */}
      {activeTab === 'defaults' && (
        <div className="space-y-6">
          <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
            {(['user_posted', 'scraped', 'admin_created'] as JobSourceType[]).map(src => (
              <button
                key={src}
                onClick={() => setDefaultSource(src)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${defaultSource === src ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
              >
                {src.replace('_', ' ').toUpperCase()} Policy
              </button>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Source Defaults: <span className="text-indigo-400 capitalize">{defaultSource.replace('_', ' ')}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Policies apply automatically during approval. Existing overrides are preserved.
                </p>
              </div>

              <button
                onClick={handleSaveDefaultPolicy}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg transition-all cursor-pointer"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Authorize & Save</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-4">Schema Property</th>
                    <th className="p-4 text-center">Free</th>
                    <th className="p-4 text-center">Premium</th>
                    <th className="p-4 text-center">Hidden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {ALL_REGISTRY_FIELDS.map(field => {
                    const currentVal = currentFieldRules[field.key] || 'Free';
                    return (
                      <tr key={field.key} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white">{field.label}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{field.key}</div>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleFieldRuleChange(field.key, 'Free')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentVal === 'Free' ? 'bg-emerald-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-500'}`}
                          >
                            FREE
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleFieldRuleChange(field.key, 'Premium')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentVal === 'Premium' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-500'}`}
                          >
                            PREMIUM
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleFieldRuleChange(field.key, 'Hidden')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentVal === 'Hidden' ? 'bg-rose-500 text-white shadow' : 'bg-slate-800 text-slate-500'}`}
                          >
                            HIDDEN
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

      {/* TAB 2: UNIVERSAL BULK EDITOR */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Universal Bulk Visibility Editor</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Target Live or Pending records with authoritative field-level overrides.
                </p>
              </div>

              <button
                onClick={() => setPreviewModalOpen(true)}
                disabled={selectedJobIds.length === 0 || selectedBulkFields.length === 0}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-indigo-500/20"
              >
                <Sliders className="w-4 h-4" />
                <span>Apply to {selectedJobIds.length} Selected</span>
              </button>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                  <Search className="w-3 h-3" />
                  <span>Search Content</span>
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Title, company..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                  <Globe className="w-3 h-3" />
                  <span>Source Type</span>
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                >
                  <option value="All">All Sources</option>
                  <option value="user_posted">User Created</option>
                  <option value="scraped">Scraped</option>
                  <option value="admin_created">Admin Created</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span>Owner ID / Submitter</span>
                </label>
                <input
                  type="text"
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  placeholder="user-..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                  <Terminal className="w-3 h-3" />
                  <span>Scraper Source ID</span>
                </label>
                <input
                  type="text"
                  value={scraperFilter}
                  onChange={(e) => setScraperFilter(e.target.value)}
                  placeholder="sc-..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={loadJobs}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingJobs ? 'animate-spin' : ''}`} />
                  <span>Sync Authoritative List</span>
                </button>
              </div>
            </div>

            {/* Bulk Field Selection Grid */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Select Target Fields & Rule</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {ALL_REGISTRY_FIELDS.map(f => {
                  const isSelected = selectedBulkFields.includes(f.key);
                  return (
                    <div key={f.key} className={`p-2 rounded-lg border transition-all ${isSelected ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <button
                          onClick={() => toggleBulkFieldSelection(f.key)}
                          className="flex items-center space-x-2 text-[10px] font-bold text-white truncate cursor-pointer"
                        >
                          {isSelected ? <CheckSquare className="w-3 h-3 text-indigo-400" /> : <Square className="w-3 h-3 text-slate-600" />}
                          <span className="truncate">{f.label}</span>
                        </button>
                      </div>
                      {isSelected && (
                        <select
                          value={bulkFieldRules[f.key] || 'Free'}
                          onChange={(e) => handleBulkFieldRuleChange(f.key, e.target.value as FieldVisibility)}
                          className="w-full bg-slate-950 border border-slate-800 rounded text-[9px] text-indigo-300 px-1 py-1 outline-none"
                        >
                          <option value="Free">FREE</option>
                          <option value="Premium">PREMIUM</option>
                          <option value="Hidden">HIDDEN</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Jobs Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <button
                  onClick={handleSelectAllFiltered}
                  className="flex items-center space-x-2 text-white font-bold cursor-pointer"
                >
                  {selectedJobIds.length === filteredJobs.length && filteredJobs.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span>Select All Filtered ({filteredJobs.length})</span>
                </button>
                <span>Selection Count: <strong className="text-white text-xs">{selectedJobIds.length}</strong></span>
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-500 uppercase font-black text-[10px] sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Identity & Status</th>
                      <th className="p-3">Source & Owner</th>
                      <th className="p-3">Rules Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-slate-500">
                          {loadingJobs ? 'Authorizing sync...' : 'No authoritative records match current filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map(job => {
                        const isSelected = selectedJobIds.includes(job.id);
                        const src = job.sourceType || (job.isScraped ? 'scraped' : job.isAdminCreated ? 'admin_created' : 'user_posted');
                        const status = job.status || 'Pending';
                        const rulesCount = Object.keys(job.fieldVisibility || {}).length;

                        return (
                          <tr key={job.id} className={`hover:bg-slate-900/50 transition-colors ${isSelected ? 'bg-indigo-600/5' : ''}`}>
                            <td className="p-3 text-center">
                              <button onClick={() => toggleJobSelection(job.id)} className="cursor-pointer">
                                {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                              </button>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-white truncate max-w-xs">{job.title}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-rose-500/10 text-rose-400'}`}>
                                  {status.toUpperCase()}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">{job.id}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] font-bold text-slate-300 capitalize">{src.replace('_', ' ')}</span>
                                {job.scraperSourceId && <span className="text-[9px] text-slate-500 font-mono">({job.scraperSourceId})</span>}
                              </div>
                              <div className="text-[9px] text-slate-500 truncate mt-0.5">
                                {job.submittedByUserId ? `Owner: ${job.submittedByUserId}` : 'System/Admin Managed'}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] font-bold ${rulesCount > 0 ? 'text-indigo-400' : 'text-slate-500'}`}>
                                {rulesCount} field overrides
                              </span>
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
        </div>
      )}

      {/* TAB 3: INDIVIDUAL OVERRIDES */}
      {activeTab === 'individual' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Granular Field Override Console</h3>
            <div className="text-[10px] text-slate-500 font-bold uppercase">Showing latest 50 records</div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-500 font-black uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-4">Identity</th>
                  <th className="p-4">Key Access Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {jobsList.slice(0, 50).map(job => (
                  <tr key={job.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-4 min-w-[200px]">
                      <div className="font-bold text-white truncate">{job.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{job.company}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[9px] font-mono text-slate-600">{job.id}</span>
                        <span className={`text-[9px] font-bold ${job.status === 'Approved' ? 'text-emerald-500' : 'text-amber-500'}`}>{job.status || 'Pending'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {['applicationUrl', 'contactEmail', 'attachments', 'salary', 'externalApplyUrl'].map(fKey => {
                          const current = job.fieldVisibility?.[fKey] || 'Source Default';
                          return (
                            <div key={fKey} className="flex items-center space-x-1.5 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                              <span className="text-[9px] font-bold text-slate-500 capitalize">{fKey.replace('Url', '')}:</span>
                              <select
                                value={job.fieldVisibility?.[fKey] || ''}
                                onChange={(e) => updateSingleJobField(job.id, fKey, e.target.value as FieldVisibility)}
                                className="bg-transparent text-indigo-400 font-black text-[9px] outline-none cursor-pointer"
                              >
                                <option value="">DEFAULT</option>
                                <option value="Free">FREE</option>
                                <option value="Premium">PREMIUM</option>
                                <option value="Hidden">HIDDEN</option>
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
      )}

      {/* Confirmation Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-8 space-y-6 shadow-2xl">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Authorize Bulk Update</h3>
                <p className="text-sm text-slate-400">Reviewing security changes for {selectedJobIds.length} records.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Fields</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedBulkFields.map(f => (
                    <span key={f} className="px-2 py-0.5 bg-slate-900 rounded text-[10px] text-white border border-slate-800 font-mono">{f}</span>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visibility Rule</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedBulkFields.slice(0, 3).map(f => (
                    <div key={f} className="flex items-center space-x-1 text-[10px]">
                      <span className="text-slate-400">{f}:</span>
                      <span className={`font-black ${bulkFieldRules[f] === 'Free' ? 'text-emerald-400' : bulkFieldRules[f] === 'Premium' ? 'text-amber-400' : 'text-rose-400'}`}>
                        {bulkFieldRules[f] || 'Free'}
                      </span>
                    </div>
                  ))}
                  {selectedBulkFields.length > 3 && <span className="text-[10px] text-slate-600">...and {selectedBulkFields.length - 3} more</span>}
                </div>
              </div>
            </div>

            {bulkResult && (
              <div className={`p-4 rounded-2xl border ${bulkResult.failure === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white">Universal Operation Log</span>
                  <div className="flex items-center space-x-3">
                    <span className="text-emerald-400">Success: {bulkResult.success}</span>
                    <span className="text-rose-400">Failed: {bulkResult.failure}</span>
                  </div>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="max-h-24 overflow-y-auto text-[9px] text-rose-300 font-mono space-y-1">
                    {bulkResult.errors.map((err, i) => (
                      <div key={i}>ID {err.id}: {err.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => { setPreviewModalOpen(false); setBulkResult(null); }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Close Console
              </button>
              {!bulkResult && (
                <button
                  onClick={executeBulkUpdate}
                  disabled={isBulkExecuting}
                  className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-xl shadow-indigo-500/20 cursor-pointer flex items-center space-x-2"
                >
                  {isBulkExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Authorize & Commit Change</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
