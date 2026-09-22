import React, { useState } from 'react';
import { Job, JobType, Region, Currency, JobStatus } from '../../types/job';
import { X, Save, Edit3, Briefcase, Building2, MapPin, DollarSign, Calendar, Tag, FileText, CheckCircle2, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { PAKISTAN_LOCATIONS } from '../../data/pakistanLocations';

interface AdminQuickEditJobModalProps {
  job: Job | null;
  selectedJobs?: Job[]; // For bulk edit mode
  isOpen: boolean;
  onClose: () => void;
  onSaveJob: (updatedJob: Job) => void;
  onBulkSaveJobs?: (updatedJobs: Job[]) => void;
}

export const AdminQuickEditJobModal: React.FC<AdminQuickEditJobModalProps> = ({
  job,
  selectedJobs = [],
  isOpen,
  onClose,
  onSaveJob,
  onBulkSaveJobs
}) => {
  const isBulkMode = selectedJobs.length > 1;

  // Single job state
  const [formData, setFormData] = useState<Job>(() => {
    if (job) return { ...job };
    return {
      id: 'job-' + Date.now(),
      title: '',
      company: '',
      jobType: 'On-site',
      region: 'Pakistan',
      province: 'Punjab',
      city: 'Lahore',
      salary: 'PKR 80,000 - 120,000 / month',
      currency: 'PKR',
      experienceLevel: 'Mid',
      department: 'General Operations',
      tags: ['Urgent', 'Full-time'],
      description: '',
      requirements: ['Relevant Bachelor degree', '2+ years experience'],
      benefits: ['Medical coverage', 'Paid leaves'],
      postedAt: new Date().toISOString().split('T')[0],
      applicationsCount: 0,
      status: 'Approved',
      featured: false,
      urgent: false,
      isPinnedTop: false,
      isFutureJob: false,
      futureIntakeDate: '',
      priorityTier: 'standard',
      jobCategory: 'Private Corporate',
      govtScale: 'BPS-17',
      isGovtJob: false,
      deadlineDate: '2026-11-30'
    };
  });

  // Bulk edit state
  const [bulkFields, setBulkFields] = useState({
    applyCategory: false,
    jobCategory: 'Government Sector',
    applyGovtScale: false,
    govtScale: 'BPS-17',
    applyStatus: false,
    status: 'Approved' as JobStatus,
    applyRegion: false,
    region: 'Pakistan' as Region,
    applyProvince: false,
    province: 'Punjab',
    applyCity: false,
    city: 'Islamabad',
    applyJobType: false,
    jobType: 'On-site' as JobType,
    applyDeadline: false,
    deadlineDate: '2026-12-31',
    applyFeatured: false,
    featured: true,
    applyUrgent: false,
    urgent: true,
    applyTags: false,
    tagsToAdd: 'Verified, Recommended'
  });

  const [tagInput, setTagInput] = useState('');

  if (!isOpen || (!job && selectedJobs.length === 0)) return null;

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveJob(formData);
    onClose();
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onBulkSaveJobs) {
      onClose();
      return;
    }

    const updated = selectedJobs.map(j => {
      const updatedJob = { ...j };
      if (bulkFields.applyCategory) updatedJob.jobCategory = bulkFields.jobCategory;
      if (bulkFields.applyGovtScale) {
        updatedJob.govtScale = bulkFields.govtScale;
        updatedJob.isGovtJob = true;
      }
      if (bulkFields.applyStatus) updatedJob.status = bulkFields.status;
      if (bulkFields.applyRegion) updatedJob.region = bulkFields.region;
      if (bulkFields.applyProvince) updatedJob.province = bulkFields.province;
      if (bulkFields.applyCity) updatedJob.city = bulkFields.city;
      if (bulkFields.applyJobType) updatedJob.jobType = bulkFields.jobType;
      if (bulkFields.applyDeadline) updatedJob.deadlineDate = bulkFields.deadlineDate;
      if (bulkFields.applyFeatured) updatedJob.featured = bulkFields.featured;
      if (bulkFields.applyUrgent) updatedJob.urgent = bulkFields.urgent;
      if (bulkFields.applyTags && bulkFields.tagsToAdd.trim()) {
        const extraTags = bulkFields.tagsToAdd.split(',').map(t => t.trim()).filter(Boolean);
        updatedJob.tags = Array.from(new Set([...(updatedJob.tags || []), ...extraTags]));
      }
      return updatedJob;
    });

    onBulkSaveJobs(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-white animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                {isBulkMode ? `Bulk Edit ${selectedJobs.length} Selected Jobs` : `Quick Edit Job: ${formData.title || 'Untitled'}`}
              </h3>
              <p className="text-xs text-slate-400">
                {isBulkMode
                  ? 'Apply standardized updates to all selected job postings at once.'
                  : 'Modify title, department, scale, salary, deadlines, and live visibility status.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BULK EDIT FORM */}
        {isBulkMode ? (
          <form onSubmit={handleBulkSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center space-x-3 text-amber-300">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <div>
                <strong className="block text-sm font-black">Bulk Attribute Batch Editor</strong>
                <span>Check the boxes below to apply specific attributes across all {selectedJobs.length} selected postings. Unchecked fields will remain untouched.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div className={`p-4 rounded-xl border transition-all ${bulkFields.applyCategory ? 'bg-slate-950 border-amber-500/60' : 'bg-slate-950/50 border-slate-800'}`}>
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.applyCategory}
                    onChange={(e) => setBulkFields(p => ({ ...p, applyCategory: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="font-bold text-slate-200">Update Job Category</span>
                </label>
                <select
                  disabled={!bulkFields.applyCategory}
                  value={bulkFields.jobCategory}
                  onChange={(e) => setBulkFields(p => ({ ...p, jobCategory: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold disabled:opacity-40"
                >
                  <option value="Government Sector">Government Sector</option>
                  <option value="Private Corporate">Private Corporate</option>
                  <option value="Newspaper Classified">Newspaper Classified</option>
                  <option value="Tech / IT & Software">Tech / IT & Software</option>
                  <option value="Banking & Finance">Banking & Finance</option>
                  <option value="Healthcare & Medical">Healthcare & Medical</option>
                  <option value="Education & Academic">Education & Academic</option>
                  <option value="Engineering & Construction">Engineering & Construction</option>
                  <option value="International Remote">International Remote</option>
                </select>
              </div>

              {/* Status */}
              <div className={`p-4 rounded-xl border transition-all ${bulkFields.applyStatus ? 'bg-slate-950 border-amber-500/60' : 'bg-slate-950/50 border-slate-800'}`}>
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.applyStatus}
                    onChange={(e) => setBulkFields(p => ({ ...p, applyStatus: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="font-bold text-slate-200">Update Visibility Status</span>
                </label>
                <select
                  disabled={!bulkFields.applyStatus}
                  value={bulkFields.status}
                  onChange={(e) => setBulkFields(p => ({ ...p, status: e.target.value as JobStatus }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold disabled:opacity-40"
                >
                  <option value="Approved">Approved (Live on Site)</option>
                  <option value="Pending">Pending (Moderation Queue)</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Expired">Expired</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Scale */}
              <div className={`p-4 rounded-xl border transition-all ${bulkFields.applyGovtScale ? 'bg-slate-950 border-amber-500/60' : 'bg-slate-950/50 border-slate-800'}`}>
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.applyGovtScale}
                    onChange={(e) => setBulkFields(p => ({ ...p, applyGovtScale: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="font-bold text-slate-200">Set Govt BPS Scale / Grade</span>
                </label>
                <select
                  disabled={!bulkFields.applyGovtScale}
                  value={bulkFields.govtScale}
                  onChange={(e) => setBulkFields(p => ({ ...p, govtScale: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold disabled:opacity-40"
                >
                  {['BPS-01', 'BPS-05', 'BPS-07', 'BPS-09', 'BPS-11', 'BPS-14', 'BPS-16', 'BPS-17', 'BPS-18', 'BPS-19', 'BPS-20', 'BPS-21', 'BPS-22'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Deadline */}
              <div className={`p-4 rounded-xl border transition-all ${bulkFields.applyDeadline ? 'bg-slate-950 border-amber-500/60' : 'bg-slate-950/50 border-slate-800'}`}>
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.applyDeadline}
                    onChange={(e) => setBulkFields(p => ({ ...p, applyDeadline: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="font-bold text-slate-200">Set Common Application Deadline</span>
                </label>
                <input
                  type="date"
                  disabled={!bulkFields.applyDeadline}
                  value={bulkFields.deadlineDate}
                  onChange={(e) => setBulkFields(p => ({ ...p, deadlineDate: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-40"
                />
              </div>

              {/* Province / Region */}
              <div className={`p-4 rounded-xl border transition-all ${bulkFields.applyProvince ? 'bg-slate-950 border-amber-500/60' : 'bg-slate-950/50 border-slate-800'}`}>
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.applyProvince}
                    onChange={(e) => setBulkFields(p => ({ ...p, applyProvince: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="font-bold text-slate-200">Set Province / Region</span>
                </label>
                <select
                  disabled={!bulkFields.applyProvince}
                  value={bulkFields.province}
                  onChange={(e) => setBulkFields(p => ({ ...p, province: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold disabled:opacity-40"
                >
                  {PAKISTAN_LOCATIONS.map(p => (
                    <option key={p.province} value={p.province}>{p.province}</option>
                  ))}
                  <option value="Islamabad Capital Territory">Islamabad Capital Territory</option>
                  <option value="Gulf / Middle East">Gulf / Middle East</option>
                </select>
              </div>

              {/* Featured & Urgent Badges */}
              <div className="p-4 rounded-xl border bg-slate-950/50 border-slate-800 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkFields.applyFeatured}
                    onChange={(e) => setBulkFields(p => ({ ...p, applyFeatured: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="font-bold text-amber-400">✨ Mark all as Featured</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkFields.applyUrgent}
                    onChange={(e) => setBulkFields(p => ({ ...p, applyUrgent: e.target.checked }))}
                    className="w-4 h-4 rounded text-rose-500"
                  />
                  <span className="font-bold text-rose-400">🔥 Mark all as Urgent Hiring</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes to {selectedJobs.length} Jobs</span>
              </button>
            </div>
          </form>
        ) : (
          /* SINGLE JOB EDIT FORM */
          <form onSubmit={handleSingleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-300">Job Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:border-amber-400 outline-none text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Company / Organization *</label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Job Category *</label>
                <select
                  value={formData.jobCategory || 'Private Corporate'}
                  onChange={(e) => setFormData(p => ({ ...p, jobCategory: e.target.value, isGovtJob: e.target.value === 'Government Sector' }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"
                >
                  <option value="Government Sector">Government Sector</option>
                  <option value="Private Corporate">Private Corporate</option>
                  <option value="Newspaper Classified">Newspaper Classified</option>
                  <option value="Tech / IT & Software">Tech / IT & Software</option>
                  <option value="Banking & Finance">Banking & Finance</option>
                  <option value="Healthcare & Medical">Healthcare & Medical</option>
                  <option value="Education & Academic">Education & Academic</option>
                  <option value="Engineering & Construction">Engineering & Construction</option>
                  <option value="International Remote">International Remote</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Govt BPS Scale (If Govt Job)</label>
                <select
                  value={formData.govtScale || 'BPS-17'}
                  onChange={(e) => setFormData(p => ({ ...p, govtScale: e.target.value, isGovtJob: true }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"
                >
                  {['N/A (Private)', 'BPS-01', 'BPS-05', 'BPS-07', 'BPS-09', 'BPS-11', 'BPS-14', 'BPS-16', 'BPS-17', 'BPS-18', 'BPS-19', 'BPS-20', 'BPS-21', 'BPS-22'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Salary / Pay Scale *</label>
                <input
                  type="text"
                  required
                  value={formData.salary}
                  onChange={(e) => setFormData(p => ({ ...p, salary: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">City / Location</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                  placeholder="e.g. Islamabad, Lahore, Karachi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Province / Region</label>
                <select
                  value={formData.province || 'Punjab'}
                  onChange={(e) => setFormData(p => ({ ...p, province: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"
                >
                  {PAKISTAN_LOCATIONS.map(p => (
                    <option key={p.province} value={p.province}>{p.province}</option>
                  ))}
                  <option value="Islamabad Capital Territory">Islamabad Capital Territory</option>
                  <option value="Gulf / Middle East">Gulf / Middle East</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Job Type</label>
                <select
                  value={formData.jobType}
                  onChange={(e) => setFormData(p => ({ ...p, jobType: e.target.value as JobType }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"
                >
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Application Deadline</label>
                <input
                  type="date"
                  value={formData.deadlineDate || ''}
                  onChange={(e) => setFormData(p => ({ ...p, deadlineDate: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Live Status *</label>
                <select
                  value={formData.status || 'Approved'}
                  onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as JobStatus }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"
                >
                  <option value="Approved">Approved (Live on Site)</option>
                  <option value="Pending">Pending (Moderation Queue)</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Expired">Expired</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Official Case Number / Ref</label>
                <input
                  type="text"
                  value={formData.pdfCaseNumber || ''}
                  onChange={(e) => setFormData(p => ({ ...p, pdfCaseNumber: e.target.value }))}
                  placeholder="e.g. Case No. F.4-142/2026-R"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-400 outline-none"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-300">Official Online Application URL / Portal Link</label>
                <input
                  type="url"
                  value={formData.applicationUrl || formData.sourceUrl || ''}
                  onChange={(e) => setFormData(p => ({ ...p, applicationUrl: e.target.value, sourceUrl: e.target.value }))}
                  placeholder="https://fpsc.gov.pk or https://company.com/apply"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-400 outline-none"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-300">Job Description & Details</label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-amber-400 outline-none leading-relaxed"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="font-bold text-slate-300">Tags & Badges</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    placeholder="Type tag and press Add..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl font-bold"
                  >
                    Add Tag
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(formData.tags || []).map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1">
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-rose-400 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* PRIORITY & PLACEMENT BADGES */}
              <div className="md:col-span-2 p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-black text-amber-400 uppercase tracking-wider text-xs">
                    📌 Job Priority & Top-of-List Placement
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Priority listings appear at the very top of all jobs
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40">
                    <input
                      type="checkbox"
                      checked={formData.isPinnedTop || false}
                      onChange={(e) => setFormData(p => ({ 
                        ...p, 
                        isPinnedTop: e.target.checked,
                        priorityTier: e.target.checked ? (p.priorityTier === 'standard' ? 'featured_top' : p.priorityTier) : 'standard'
                      }))}
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <span className="font-bold text-amber-300">📌 Pin to Top of All Jobs</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40">
                    <input
                      type="checkbox"
                      checked={formData.featured || false}
                      onChange={(e) => setFormData(p => ({ ...p, featured: e.target.checked }))}
                      className="w-4 h-4 rounded text-purple-500"
                    />
                    <span className="font-bold text-purple-300">⭐ Featured Badge</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/40">
                    <input
                      type="checkbox"
                      checked={formData.urgent || false}
                      onChange={(e) => setFormData(p => ({ ...p, urgent: e.target.checked }))}
                      className="w-4 h-4 rounded text-rose-500"
                    />
                    <span className="font-bold text-rose-300">🔥 Urgent Hiring Badge</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40">
                    <input
                      type="checkbox"
                      checked={formData.isFutureJob || false}
                      onChange={(e) => setFormData(p => ({ ...p, isFutureJob: e.target.checked }))}
                      className="w-4 h-4 rounded text-cyan-500"
                    />
                    <span className="font-bold text-cyan-300">📅 Future Opportunity</span>
                  </label>
                </div>

                {formData.isFutureJob && (
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/90 p-3 rounded-xl border border-cyan-500/30">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-cyan-300">Future Intake / Batch Date Label</label>
                      <input
                        type="text"
                        value={formData.futureIntakeDate || ''}
                        onChange={(e) => setFormData(p => ({ ...p, futureIntakeDate: e.target.value }))}
                        placeholder="e.g. Oct 2026 Batch or 2026-11-15"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-medium text-xs focus:border-cyan-400 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-cyan-300">Priority Tier Level</label>
                      <select
                        value={formData.priorityTier || 'standard'}
                        onChange={(e) => setFormData(p => ({ ...p, priorityTier: e.target.value as any }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-bold text-xs focus:border-cyan-400 outline-none"
                      >
                        <option value="standard">Standard Placement</option>
                        <option value="urgent">Urgent Hiring Priority</option>
                        <option value="featured_top">Featured & Top Pinned Priority</option>
                        <option value="vip_bundle">🚀 VIP Top Priority Bundle</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Job Changes</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
