import React, { useState, useRef, useEffect } from 'react';
import { Job, UserAccount, JobPostingFeeLog, JobAttachment } from '../types/job';
import { 
  X, 
  Building2, 
  MapPin, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  User, 
  ShieldCheck, 
  Tag, 
  FileText, 
  Check, 
  Ban, 
  Edit3, 
  AlertTriangle,
  Paperclip,
  Upload,
  Eye,
  Download,
  Trash2,
  Copy,
  ExternalLink,
  RefreshCw,
  Image as ImageIcon,
  FileCheck,
  Lock,
  Globe,
  EyeOff
} from 'lucide-react';
import { isScrapedJob } from '../utils/jobValidation';
import { suggestJobMetadata, JobSuggestionResult } from '../utils/jobSuggestionEngine';
import { api } from '../services/api';

interface AdminJobDetailModalProps {
  job: Job | null;
  users: UserAccount[];
  feeLogs?: JobPostingFeeLog[];
  onClose: () => void;
  onApproveJob?: (jobId: string) => Promise<any> | void;
  onRejectJob?: (jobId: string, reason: string) => void;
  onSuspendJob?: (jobId: string, reason?: string) => void;
  onViewUserProfile?: (user: UserAccount) => void;
  onEditJob?: (job: Job) => void;
}

export const AdminJobDetailModal: React.FC<AdminJobDetailModalProps> = ({
  job,
  users,
  feeLogs = [],
  onClose,
  onApproveJob,
  onRejectJob,
  onSuspendJob,
  onViewUserProfile,
  onEditJob
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isConfirmingLocation, setIsConfirmingLocation] = useState(false);
  const [confirmedNotice, setConfirmedNotice] = useState<string | null>(null);

  // Supporting Document Attachments & Extracted Text State
  const [attachments, setAttachments] = useState<JobAttachment[]>(job?.attachments || []);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadIsPublic, setUploadIsPublic] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<JobAttachment | null>(null);
  const [replacingAttachmentId, setReplacingAttachmentId] = useState<string | null>(null);
  const [copiedExtractedText, setCopiedExtractedText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (job?.attachments) {
      setAttachments(job.attachments);
    }
  }, [job?.attachments]);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isReplace: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file || !job) return;

    // Reset input
    e.target.value = '';

    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExts.includes(fileExt)) {
      setUploadError(`Invalid file format "${fileExt}". Please select a PDF, JPG, PNG, or WebP document.`);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`File size exceeds 15 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller file.`);
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const uploadRes = await api.jobs.uploadAttachment({
        fileName: file.name,
        fileType: file.type || (fileExt === '.pdf' ? 'application/pdf' : 'image/jpeg'),
        fileBase64: base64
      });

      if (!uploadRes.success || !uploadRes.attachment) {
        throw new Error(uploadRes.message || 'Failed to upload document.');
      }

      const newAtt = {
        ...uploadRes.attachment,
        isPublic: uploadIsPublic
      };

      // If replacing, remove previous attachment
      if (isReplace && replacingAttachmentId) {
        await api.jobs.deleteAttachment(job.id, replacingAttachmentId);
      }

      // Attach new document to job
      const attachRes = await api.jobs.attachDocument(job.id, newAtt);
      if (!attachRes.success) {
        throw new Error(attachRes.message || 'Failed to associate document with job.');
      }

      const updatedList: JobAttachment[] = attachRes.attachments || [...attachments.filter(a => a.id !== replacingAttachmentId), newAtt];
      setAttachments(updatedList);
      if (job) {
        job.attachments = updatedList;
      }
      setUploadSuccess(isReplace ? `Attachment replaced with "${file.name}"!` : `"${file.name}" attached successfully as ${uploadIsPublic ? 'Public' : 'Private'}!`);
      setReplacingAttachmentId(null);
    } catch (err: any) {
      console.error('Error attaching file:', err);
      setUploadError(err?.message || 'Error uploading and attaching document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleAttachmentVisibility = async (attId: string, currentPublic: boolean) => {
    if (!job) return;
    const nextPublic = !currentPublic;
    try {
      const res = await api.jobs.updateAttachmentVisibility(job.id, attId, nextPublic);
      if (res.success) {
        const updatedList = attachments.map(a => a.id === attId ? { ...a, isPublic: nextPublic } : a);
        setAttachments(updatedList);
        if (job) job.attachments = updatedList;
        setUploadSuccess(`Attachment visibility changed to ${nextPublic ? 'Public (Visible to Candidates)' : 'Private (Admin Only)'}.`);
      } else {
        alert(res.message || 'Failed to update visibility.');
      }
    } catch (err: any) {
      console.error('Error toggling attachment visibility:', err);
      alert(`Error toggling visibility: ${err?.message || 'Unexpected failure'}`);
    }
  };

  const handleDeleteAttachment = async (attId: string, attName: string) => {
    if (!job) return;
    const confirmed = window.confirm(`Are you sure you want to remove the supporting document "${attName}" from this job?`);
    if (!confirmed) return;

    try {
      const res = await api.jobs.deleteAttachment(job.id, attId);
      if (res.success) {
        const remaining = attachments.filter(a => a.id !== attId);
        setAttachments(remaining);
        job.attachments = remaining;
        setUploadSuccess(`Attachment "${attName}" removed.`);
      } else {
        alert(res.message || 'Failed to delete attachment.');
      }
    } catch (err: any) {
      console.error('Error deleting attachment:', err);
      alert(`Error deleting attachment: ${err?.message || 'Unexpected failure'}`);
    }
  };

  const handleCopyExtractedText = () => {
    const textToCopy = job?.extractedText || job?.description || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedExtractedText(true);
    setTimeout(() => setCopiedExtractedText(false), 2000);
  };

  if (!job) return null;

  const isLocationConfirmed = Boolean(
    job.isLocationConfirmed || job.isManuallyCorrected || job.metadata?.isLocationConfirmed || job.metadata?.isManuallyCorrected
  );

  // Safely compute auto-detection suggestions for scraped jobs (read-only display & optional confirm)
  let suggestion: JobSuggestionResult | null = null;
  const isScraped = isScrapedJob(job);
  if (isScraped) {
    try {
      suggestion = suggestJobMetadata(job);
    } catch (err) {
      console.error('Error calculating job suggestion metadata:', err);
      suggestion = null;
    }
  }

  const handleConfirmLocation = async () => {
    if (!job || !suggestion) return;
    setIsConfirmingLocation(true);
    const now = new Date().toISOString();

    const updatedJob: Job = {
      ...job,
      region: suggestion.suggestedRegion || job.region,
      province: suggestion.suggestedProvince !== undefined ? suggestion.suggestedProvince : job.province,
      city: suggestion.suggestedCity !== undefined ? suggestion.suggestedCity : job.city,
      district: suggestion.suggestedDistrict !== undefined ? suggestion.suggestedDistrict : job.district,
      isLocationConfirmed: true,
      locationConfirmedAt: now,
      isManuallyCorrected: true,
      manuallyCorrectedAt: now,
      metadata: {
        ...(job.metadata || {}),
        isLocationConfirmed: true,
        locationConfirmedAt: now,
        isManuallyCorrected: true,
        manuallyCorrectedAt: now,
        confirmedBy: 'Admin User'
      }
    };

    try {
      if (onEditJob) {
        onEditJob(updatedJob);
      } else {
        await api.jobs.update(job.id, updatedJob);
      }
      setConfirmedNotice('Location confirmed & protected from scraper overwrites!');
    } catch (err: any) {
      console.error('Failed to confirm location:', err);
    } finally {
      setIsConfirmingLocation(false);
    }
  };

  const handleKeepExistingLocation = async () => {
    if (!job) return;
    setIsConfirmingLocation(true);
    const now = new Date().toISOString();

    const updatedJob: Job = {
      ...job,
      isLocationConfirmed: true,
      locationConfirmedAt: now,
      isManuallyCorrected: true,
      manuallyCorrectedAt: now,
      metadata: {
        ...(job.metadata || {}),
        isLocationConfirmed: true,
        locationConfirmedAt: now,
        isManuallyCorrected: true,
        manuallyCorrectedAt: now,
        confirmedBy: 'Admin User',
        locationConflictResolved: true
      }
    };

    try {
      if (onEditJob) {
        onEditJob(updatedJob);
      } else {
        await api.jobs.update(job.id, updatedJob);
      }
      setConfirmedNotice('Existing location kept & confirmed as permanent!');
    } catch (err: any) {
      console.error('Failed to keep existing location:', err);
    } finally {
      setIsConfirmingLocation(false);
    }
  };

  const handleUseNewScrapedLocation = async () => {
    if (!job || !suggestion) return;
    setIsConfirmingLocation(true);
    const now = new Date().toISOString();

    const updatedJob: Job = {
      ...job,
      region: suggestion.suggestedRegion || job.region,
      province: suggestion.suggestedProvince !== undefined ? suggestion.suggestedProvince : job.province,
      city: suggestion.suggestedCity !== undefined ? suggestion.suggestedCity : job.city,
      district: suggestion.suggestedDistrict !== undefined ? suggestion.suggestedDistrict : job.district,
      isLocationConfirmed: true,
      locationConfirmedAt: now,
      isManuallyCorrected: true,
      manuallyCorrectedAt: now,
      metadata: {
        ...(job.metadata || {}),
        isLocationConfirmed: true,
        locationConfirmedAt: now,
        isManuallyCorrected: true,
        manuallyCorrectedAt: now,
        confirmedBy: 'Admin User',
        locationConflictResolved: true
      }
    };

    try {
      if (onEditJob) {
        onEditJob(updatedJob);
      } else {
        await api.jobs.update(job.id, updatedJob);
      }
      setConfirmedNotice('New scraped location applied & confirmed!');
    } catch (err: any) {
      console.error('Failed to apply new scraped location:', err);
    } finally {
      setIsConfirmingLocation(false);
    }
  };

  // Find user who posted the job
  const posterUser = (users || []).find(u => u && u.id === job.submittedByUserId) || {
    id: job.submittedByUserId || 'user-unknown',
    name: job.company || 'Job Poster',
    email: 'poster@jobportal.com',
    role: 'Employer / Unified Member',
    plan: 'Premium',
    paymentStatus: 'Paid',
    membershipStatus: 'Active',
    autoRenew: true,
    createdAt: new Date().toISOString()
  } as UserAccount;

  const isEmployerUnpaid = posterUser.paymentStatus === 'Unpaid' || posterUser.membershipStatus === 'Unpaid' || posterUser.membershipStatus === 'Revoked';
  const isJobSuspended = job.status === 'Suspended' || job.isSuspended;

  // Find fee log associated with this job title/user
  const feeLog = (feeLogs || []).find(
    f => f && f.jobTitle && (f.jobTitle.toLowerCase() === (job.title || '').toLowerCase() || f.userId === posterUser.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 text-white animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 rounded border text-xs font-bold uppercase ${
                isJobSuspended
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : job.status === 'Approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : job.status === 'Rejected'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                Status: {isJobSuspended ? 'Suspended (Unpaid Employer)' : job.status || 'Pending Verification'}
              </span>

              <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold">
                Category: {job.jobCategory || 'Private Corporate'}
              </span>

              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                {job.jobType}
              </span>

              <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
                {job.region}
              </span>
            </div>

            <h2 className="text-2xl font-black text-white">{job.title}</h2>
            <div className="flex items-center space-x-3 text-sm text-slate-400 mt-1">
              <span className="text-emerald-400 font-bold">{job.company}</span>
              <span>•</span>
              <span className="text-white font-bold">{job.salary}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-sm text-slate-300">
          
          {/* SCRAPED SOURCE & HARVEST TIMESTAMP BANNER */}
          {(job.sourceUrl || job.scrapedSourceDomain || job.scrapedAt) && (
            <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-indigo-300">
                  <Tag className="w-4 h-4 text-indigo-400" />
                  <span>Scraper Source Intelligence & Origin Website</span>
                </div>
                {job.scrapedAt && (
                  <div className="text-xs font-mono text-indigo-200 bg-indigo-900/60 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                    🕒 Scraped Date & Time: <strong>{job.scrapedAt}</strong> {job.scrapedTime ? `(${job.scrapedTime})` : ''}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1 border-t border-indigo-500/20">
                <div className="space-y-0.5">
                  <p className="text-slate-300">
                    <span className="text-slate-400">Harvest Source:</span> <strong>{job.scraperSourceName || job.scrapedSourceDomain || 'Automated Web Scraper'}</strong>
                  </p>
                  {job.sourceUrl && (
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline font-mono text-[11px] break-all block"
                    >
                      🔗 {job.sourceUrl}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCRAPED JOB AUTO-DETECTION INTELLIGENCE (READ-ONLY) */}
          {isScraped && suggestion && (
            <div className="p-4 bg-slate-950 border border-purple-500/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex items-center space-x-2 text-xs font-bold text-purple-300">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Auto-Detection Intelligence (Read-Only)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-semibold">Confidence:</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                    suggestion.confidence === 'HIGH'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : suggestion.confidence === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {suggestion.confidence}
                  </span>
                </div>
              </div>

              {/* Grid of Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[11px] uppercase font-bold tracking-wider">Suggested Location</span>
                  <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-200">
                    <span className="text-purple-300">Region: {suggestion.suggestedRegion}</span>
                    {suggestion.suggestedProvince && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span className="text-indigo-300">Province: {suggestion.suggestedProvince}</span>
                      </>
                    )}
                    {suggestion.suggestedCity && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span className="text-emerald-300">City: {suggestion.suggestedCity}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[11px] uppercase font-bold tracking-wider">Suggested Category</span>
                  <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-200">
                    <span className="text-emerald-300">{suggestion.suggestedCategory}</span>
                    {suggestion.suggestedGovtCategory && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                        Govt Category: {suggestion.suggestedGovtCategory}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Conflict Alert Box with Direct Resolution Actions */}
              {suggestion.hasConflict && (
                <div className="p-3.5 bg-rose-950/60 border border-rose-500/50 rounded-2xl text-xs space-y-3 shadow-lg">
                  <div className="flex items-center space-x-2 text-rose-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="uppercase tracking-wider font-mono">⚠️ Location Conflict Review</span>
                  </div>

                  {suggestion.conflictDetails && (
                    <p className="text-rose-200/90 text-xs leading-relaxed">
                      {suggestion.conflictDetails}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Existing Location:</span>
                      <span className="text-emerald-300 font-bold font-mono">
                        {suggestion.existingLocationStr || `${job.region}${job.province ? ` / ${job.province}` : ''}${job.city ? ` / ${job.city}` : ''}`}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">New Scraped Location:</span>
                      <span className="text-amber-300 font-bold font-mono">
                        {suggestion.suggestedLocationStr || `${suggestion.suggestedRegion}${suggestion.suggestedProvince ? ` / ${suggestion.suggestedProvince}` : ''}${suggestion.suggestedCity ? ` / ${suggestion.suggestedCity}` : ''}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-900/50">
                    <button
                      type="button"
                      disabled={isConfirmingLocation}
                      onClick={handleKeepExistingLocation}
                      className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold transition-all cursor-pointer text-xs disabled:opacity-50"
                    >
                      🛡️ KEEP EXISTING
                    </button>

                    <button
                      type="button"
                      disabled={isConfirmingLocation}
                      onClick={handleUseNewScrapedLocation}
                      className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 rounded-xl font-bold transition-all cursor-pointer text-xs disabled:opacity-50"
                    >
                      🎯 USE NEW SCRAPED LOCATION
                    </button>

                    {onEditJob && (
                      <button
                        type="button"
                        onClick={() => onEditJob(job)}
                        className="px-3.5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl font-bold transition-all cursor-pointer text-xs"
                      >
                        ✏️ REVIEW / EDIT
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Missing Fields List */}
              {suggestion.missingFields && suggestion.missingFields.length > 0 && (
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-amber-300 font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Missing Data Signals ({suggestion.missingFields.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.missingFields.map((field, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium">
                        ⚠️ {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Location Confirmation Action / Protected Status Badge */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                {isLocationConfirmed ? (
                  <div className="w-full p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Location Confirmed & Protected from Scraper Overwrites</span>
                    </div>
                    <span className="text-[11px] text-emerald-300 font-mono">
                      {job.region}{job.province ? ` → ${job.province}` : ''}{job.city ? ` → ${job.city}` : ''}
                    </span>
                  </div>
                ) : !suggestion.hasConflict ? (
                  <div className="w-full flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Review detected location metadata for confirmation:
                    </span>
                    <button
                      type="button"
                      disabled={isConfirmingLocation}
                      onClick={handleConfirmLocation}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center space-x-1.5 cursor-pointer transition-all disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isConfirmingLocation ? 'Saving Confirmation...' : 'Confirm Suggested Location'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full text-xs text-rose-300 italic flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Location conflict present. Please use "Edit Job Details" below to manually review and set the correct location.</span>
                  </div>
                )}

                {confirmedNotice && (
                  <div className="w-full text-xs text-emerald-400 font-bold font-mono">
                    ✅ {confirmedNotice}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* POSTER & USER DETAIL LINK CARD WITH PAYMENT STATUS */}
          <div className="p-4 bg-slate-950/90 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-amber-400">
                  {posterUser.name.charAt(0).toUpperCase()}
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Submitted By User</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isEmployerUnpaid
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {isEmployerUnpaid ? '⚠️ Unpaid Employer' : '💳 Paid Employer'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onViewUserProfile && onViewUserProfile(posterUser)}
                  className="font-bold text-white hover:text-amber-400 text-sm hover:underline cursor-pointer flex items-center space-x-1"
                >
                  <span>{posterUser.name}</span>
                  <User className="w-3.5 h-3.5 text-amber-400" />
                </button>
                <p className="text-xs text-slate-400 font-mono">{posterUser.email} • {posterUser.role || 'Unified Account'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onViewUserProfile && (
                <button
                  type="button"
                  onClick={() => onViewUserProfile(posterUser)}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
                >
                  🔍 Inspect User Profile
                </button>
              )}
            </div>
          </div>

          {/* PER-JOB FEE STATUS */}
          {feeLog ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-emerald-300">Per-Job Posting Fee Paid:</span>
                <span className="font-mono text-white font-bold">{feeLog.currency} {feeLog.amount.toLocaleString()} via {feeLog.paymentMethod}</span>
              </div>
              <span className="text-slate-400 font-mono">{feeLog.dateTime}</span>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
              <span>Posting Fee Requirement: Standard Subscription / Free Queue</span>
              <span className="font-mono font-semibold text-slate-300">No Extra Fee Logged</span>
            </div>
          )}

          {/* Exact Location Breakdown */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs">
            <h4 className="font-bold uppercase text-slate-400">Location Breakdown</h4>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-emerald-400">Region: {job.region}</span>
              {job.province && <span className="text-slate-300">• Province: {job.province}</span>}
              {job.city && <span className="text-slate-300">• City: {job.city}</span>}
              {job.district && <span className="text-slate-300">• Area/District: {job.district}</span>}
            </div>
          </div>

          {/* Job Description */}
          <div>
            <h3 className="text-base font-bold text-white mb-2">Job Description</h3>
            <p className="leading-relaxed text-slate-300 whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800">
              {job.description}
            </p>
          </div>

          {/* Skills & Tags */}
          {job.tags && job.tags.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-2">Required Skills & Stack</h3>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-bold"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-2">Requirements</h3>
              <ul className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {job.requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {job.rejectionReason && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              <strong className="block font-bold mb-1">Rejection Reason Note:</strong>
              <p>{job.rejectionReason}</p>
            </div>
          )}

          {/* Hidden File Inputs for Document Upload & Replacement */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileChange(e, false)}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
          />
          <input
            type="file"
            ref={replaceInputRef}
            onChange={(e) => handleFileChange(e, true)}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
          />

          {/* Section: Supporting Documents & Official Attachments */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Paperclip className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Supporting Documents & Official Attachments
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {attachments.length}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <label className="inline-flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={uploadIsPublic}
                    onChange={(e) => setUploadIsPublic(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Show to Users (Public)</span>
                </label>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-xs border border-emerald-500/40 flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Attach Document</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Attach official recruitment circulars, gazettes, newspaper clippings, or eligibility criteria schedules (PDF, JPG, PNG, WebP up to 15 MB). New attachments default to Private unless "Show to Users" is checked.
            </p>

            {/* Upload notifications */}
            {uploadError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            {uploadSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* List of Attachments */}
            {attachments.length === 0 ? (
              <div className="p-4 bg-slate-900/60 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
                No supporting documents attached yet. Click <strong className="text-slate-400">"Attach Document"</strong> to upload official circulars or ads.
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => {
                  const attName = att.name || att.fileName || '';
                  const isPdf = att.fileType === 'application/pdf' || attName.toLowerCase().endsWith('.pdf');
                  const isImage = att.fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(attName);
                  const isPublic = att.isPublic === true;

                  return (
                    <div
                      key={att.id}
                      className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg ${isPdf ? 'bg-rose-500/20 text-rose-400' : 'bg-teal-500/20 text-teal-400'}`}>
                          {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-1">
                            <span className="font-semibold text-xs text-white truncate" title={att.name}>
                              {att.name}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPdf ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-teal-500/15 text-teal-300 border border-teal-500/30'}`}>
                              {isPdf ? 'PDF' : isImage ? 'IMAGE' : 'DOC'}
                            </span>
                            {/* Visibility Badge */}
                            {isPublic ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                                <Globe className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Public (Visible)</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center space-x-1">
                                <Lock className="w-2.5 h-2.5 text-amber-400" />
                                <span>Private (Admin Only)</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                            <span>{formatBytes(att.sizeBytes)}</span>
                            <span>•</span>
                            <span>{att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString() : 'Recent'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1.5 shrink-0 flex-wrap">
                        {/* Visibility Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleAttachmentVisibility(att.id, isPublic)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors ${
                            isPublic
                              ? 'bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30'
                              : 'bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30'
                          }`}
                          title={isPublic ? 'Hide from public candidate visitors' : 'Make visible to public candidate visitors'}
                        >
                          {isPublic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{isPublic ? 'Hide from Users' : 'Show to Users'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                          title="Preview Document"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Preview</span>
                        </button>

                        <a
                          href={`${att.fileUrl}${att.fileUrl.includes('?') ? '&' : '?'}download=1`}
                          download={att.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                          title="Download Document"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Download</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setReplacingAttachmentId(att.id);
                            replaceInputRef.current?.click();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                          title="Replace with new file"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                          <span>Replace</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id, att.name)}
                          className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                          title="Remove Attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Complete Document Extracted Text */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Complete Document / Extracted Gazette Text
                </h3>
                {job.extractedText && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {job.extractedText.length.toLocaleString()} characters
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {job.pdfSourceUrl && (
                  <a
                    href={job.pdfSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-slate-950 text-xs font-bold border border-rose-500/30 flex items-center space-x-1 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Source PDF</span>
                  </a>
                )}
                {job.clippingImageUrl && (
                  <a
                    href={job.clippingImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-slate-950 text-xs font-bold border border-teal-500/30 flex items-center space-x-1 transition-colors"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Source Image</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleCopyExtractedText}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  {copiedExtractedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Full Text</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Factual content extracted from the original recruitment advertisement. Complete paragraphs, tables, eligibility, quotas, and deadlines are preserved without truncation.
            </p>

            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 max-h-96 overflow-y-auto">
              <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                {job.extractedText || job.description || 'No raw extracted text recorded for this listing.'}
              </pre>
            </div>
          </div>

        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close Detail
          </button>

          <div className="flex items-center space-x-2">
            {onEditJob && (
              <button
                type="button"
                onClick={() => {
                  onEditJob(job);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-xs border border-amber-500/30 cursor-pointer flex items-center space-x-1 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Job Details</span>
              </button>
            )}

            {onSuspendJob && !isJobSuspended && (
              <button
                onClick={() => {
                  if (confirm(`Suspend / End job "${job.title}" for unpaid employer?`)) {
                    onSuspendJob(job.id, 'Job ended by Admin (Unpaid employer/membership)');
                    onClose();
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/30 cursor-pointer flex items-center space-x-1"
              >
                <Ban className="w-4 h-4" />
                <span>End Job (Unpaid)</span>
              </button>
            )}

            {onApproveJob && job.status !== 'Approved' && (
              <button
                onClick={async () => {
                  try {
                    const res = await onApproveJob(job.id);
                    if (res && typeof res === 'object' && res.success === true) {
                      onClose();
                    } else {
                      const msg = (res && typeof res === 'object' && 'message' in res && res.message) || 'Approval could not be confirmed. Please check required fields or duplicates.';
                      alert(`Approval notice: ${msg}`);
                    }
                  } catch (err: any) {
                    console.error('Error approving job from modal:', err);
                    alert(`Approval error: ${err?.message || 'Failed to approve job due to an unexpected error.'}`);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Approve Job Now</span>
              </button>
            )}

            {onRejectJob && job.status !== 'Rejected' && (
              <div>
                {!showRejectInput ? (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/30 cursor-pointer flex items-center space-x-1"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Reject Job</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-medium"
                    />
                    <button
                      onClick={() => {
                        if (!rejectionReason.trim()) {
                          alert('Please specify a rejection reason.');
                          return;
                        }
                        onRejectJob(job.id, rejectionReason.trim());
                        onClose();
                      }}
                      className="px-3 py-2 bg-rose-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Confirm Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Attachment Preview Lightbox Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center space-x-2 min-w-0">
                {previewAttachment.fileType === 'application/pdf' || previewAttachment.name.toLowerCase().endsWith('.pdf') ? (
                  <FileText className="w-5 h-5 text-rose-400 shrink-0" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-teal-400 shrink-0" />
                )}
                <div className="truncate">
                  <h4 className="font-bold text-sm text-white truncate" title={previewAttachment.name}>
                    {previewAttachment.name}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {formatBytes(previewAttachment.sizeBytes)} • Uploaded {previewAttachment.uploadedAt ? new Date(previewAttachment.uploadedAt).toLocaleString() : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={`${previewAttachment.fileUrl}${previewAttachment.fileUrl.includes('?') ? '&' : '?'}download=1`}
                  download={previewAttachment.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <a
                  href={previewAttachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center space-x-1 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-950/80 flex items-center justify-center min-h-[50vh]">
              {previewAttachment.fileType === 'application/pdf' || previewAttachment.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewAttachment.fileUrl}
                  title={previewAttachment.name}
                  className="w-full h-[70vh] rounded-lg border border-slate-800 bg-white"
                />
              ) : (
                <img
                  src={previewAttachment.fileUrl}
                  alt={previewAttachment.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
