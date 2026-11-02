import React, { useEffect, useState } from 'react';
import { 
  X, 
  MapPin, 
  Building2, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  Send, 
  ShieldCheck, 
  Share2, 
  Bookmark,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Paperclip,
  FileText,
  Eye,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Image as ImageIcon
} from 'lucide-react';
import { Job, JobAttachment } from '../types/job';
import { sanitizeJob } from '../utils/jobSanitizer';
import { injectJobJsonLd } from '../utils/seoHelper';
import { api } from '../services/api';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onApply: (job: Job) => void;
  isSaved: boolean;
  onToggleSave: (jobId: string) => void;
  onUpgrade?: () => void;
}

const isRedactedUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const str = url.trim();
  return str.startsWith('🔒') || str.includes('Unlock with Premium') || str.includes('Premium Content');
};

const isValidUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const str = url.trim();
  if (isRedactedUrl(str)) return false;
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/') || str.startsWith('mailto:');
};

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job: rawJob,
  onClose,
  onApply,
  isSaved,
  onToggleSave,
  onUpgrade
}) => {
  const [applySettings, setApplySettings] = useState<any>({
    applyButtonText: 'Apply Now',
    expiredJobMessage: 'This employment opportunity has passed its application deadline.'
  });

  useEffect(() => {
    if (rawJob) {
      injectJobJsonLd(rawJob);
      loadApplySettings();
    }
    return () => {
      const script = document.getElementById('google-job-schema');
      if (script) script.remove();
    };
  }, [rawJob]);

  const loadApplySettings = async () => {
    try {
      const data = await api.applySettings.get();
      if (data.success && data.settings) {
        setApplySettings(data.settings);
      }
    } catch {}
  };

  const [copiedText, setCopiedText] = useState(false);
  const [showFullExtracted, setShowFullExtracted] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<JobAttachment | { name: string; fileUrl: string; fileType: string } | null>(null);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  if (!rawJob) return null;

  const job = sanitizeJob(rawJob);
  const isExpired = job.deadlineDate && new Date(job.deadlineDate) < new Date();

  // Premium URL & Application Evaluation
  const rawExternalUrl = job.externalApplyUrl || job.applicationUrl || (job.sourceUrl && (job.isGovtJob || job.isNewspaperAd || job.applicationType === 'external') ? job.sourceUrl : undefined);
  const isExternal = job.applicationType === 'external' || (!!rawExternalUrl && (job.isGovtJob || job.isNewspaperAd || job.applicationType !== 'internal'));

  const hints = (job as any)._visibilityHints || {};
  const hasRedactedExternal = isRedactedUrl(job.externalApplyUrl) || isRedactedUrl(job.applicationUrl) || (isExternal && isRedactedUrl(job.sourceUrl));
  const validExternalUrl = isValidUrl(rawExternalUrl) ? rawExternalUrl : undefined;

  const isApplyRestricted = 
    isRedactedUrl(job.applicationUrl) || 
    isRedactedUrl(job.externalApplyUrl) || 
    (isExternal && isRedactedUrl(job.sourceUrl)) ||
    hints.applicationUrl?.requiresUpgrade ||
    hints.externalApplyUrl?.requiresUpgrade;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        
        {/* Sticky Modal Header */}
        <div className="sticky top-0 z-20 shrink-0 p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                {job.jobType}
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                {job.experienceLevel} Level
              </span>
              {job.priorityTier === 'vip_bundle' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  👑 VIP Vacancy
                </span>
              )}
              {job.urgent && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  🔥 Urgent
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white truncate">{job.title}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-400 mt-1">
              <span className="text-slate-200 font-bold">{job.company}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{job.salary}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label="Close Job Details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6 text-sm text-slate-300 break-words">
          
          {/* Expired Job Alert */}
          {isExpired && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{applySettings.expiredJobMessage}</span>
            </div>
          )}

          {/* Government Job Banner */}
          {job.isGovtJob && (
            <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-2 text-amber-200">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Government / Public Sector Position</span>
              </div>
              <div className="text-xs space-y-1">
                <div><strong>Department:</strong> {job.govtDepartment || 'Federal Public Service'}</div>
                <div><strong>Grade / Pay Scale:</strong> {job.govtScale || 'BPS Scale'}</div>
                <div><strong>Sector Classification:</strong> {job.govtCategory || 'Federal'} Sector</div>
              </div>
            </div>
          )}

          {/* Newspaper Clipping Image Preview */}
          {job.isNewspaperAd && job.clippingImageUrl && (
            <div className="p-4 bg-slate-950/90 border border-teal-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-teal-300">
                <span>📰 Official Newspaper Classified Ad Clipping</span>
                <span>{job.newspaperName} ({job.newspaperDate || 'Recent Edition'})</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-slate-800 bg-black max-h-64 flex justify-center">
                <img
                  src={job.clippingImageUrl}
                  alt="Newspaper Classified Ad Clipping"
                  className="object-cover max-h-64 w-full hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          )}

          {/* Detailed Location Breakdown */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Exact Location Details</h4>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-emerald-400">
                Region: {job.region}
              </span>
              {job.province && <span className="text-slate-400">• Province: {job.province}</span>}
              {job.city && <span className="text-slate-400">• City: {job.city}</span>}
              {job.district && <span className="text-slate-400">• District/Area: {job.district}</span>}
              
              {hints.salary?.requiresUpgrade && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUpgrade) {
                      onClose();
                      onUpgrade();
                    }
                  }}
                  className="ml-auto flex items-center space-x-1.5 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                >
                  <Lock className="w-3 h-3" />
                  <span>Upgrade to View Salary</span>
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-base font-bold text-white mb-2">Job Description</h3>
            <p className="leading-relaxed text-slate-300 whitespace-pre-line">{job.description}</p>
          </div>

          {/* Key Tags */}
          {job.tags && job.tags.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-2">Required Skills & Stack</h3>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-2">Requirements & Qualifications</h3>
              <ul className="space-y-2">
                {job.requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && job.benefits.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-2">Perks & Compensation</h3>
              <ul className="space-y-2">
                {job.benefits.map((ben, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{ben}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Official Supporting Documents & Gazette Attachments (Public Only) */}
          {(() => {
            const publicAttachments = (job.attachments || []).filter((att) => att && att.isPublic === true);
            const hasPremiumAttachments = hints.attachments?.requiresUpgrade || (job.attachments && job.attachments.length === 0 && rawJob?.attachments && rawJob.attachments.length > 0);
            
            if (publicAttachments.length === 0 && !hasPremiumAttachments) return null;

            return (
              <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Official Supporting Documents
                    </h3>
                  </div>
                  {hasPremiumAttachments && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpgrade) {
                          onClose();
                          onUpgrade();
                        }
                      }}
                      className="flex items-center space-x-1.5 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Unlock {rawJob?.attachments?.length || 'Premium'} Docs</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {publicAttachments.map((att) => {
                    const attName = att.name || att.fileName || '';
                    const isPdf = att.fileType === 'application/pdf' || attName.toLowerCase().endsWith('.pdf');
                    const isImage = att.fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(attName);

                    return (
                      <div
                        key={att.id}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-lg shrink-0 ${isPdf ? 'bg-rose-500/20 text-rose-400' : 'bg-teal-500/20 text-teal-400'}`}>
                            {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-xs text-white truncate block" title={att.name}>
                              {att.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatBytes(att.sizeBytes)} • {isPdf ? 'Official PDF Circular' : isImage ? 'Image Document' : 'Attachment'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(att)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Preview</span>
                          </button>

                          <a
                            href={`${att.fileUrl}${att.fileUrl.includes('?') ? '&' : '?'}download=1`}
                            download={att.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center space-x-1 transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Original Document Sources (Source PDF or Newspaper Clipping) */}
          {(job.pdfSourceUrl || (job.sourceUrl && isValidUrl(job.sourceUrl) && job.sourceUrl.toLowerCase().endsWith('.pdf')) || job.clippingImageUrl || hints.pdfSourceUrl?.requiresUpgrade || hints.sourceUrl?.requiresUpgrade) && (
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Original Source Documents</h4>
                <p className="text-[11px] text-slate-400">Access the original gazette advertisement directly from the issuing authority.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(job.pdfSourceUrl || (job.sourceUrl && isValidUrl(job.sourceUrl) && job.sourceUrl.toLowerCase().endsWith('.pdf'))) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const url = job.pdfSourceUrl || job.sourceUrl;
                      if (url && isValidUrl(url)) {
                        setPreviewDoc({
                          name: job.pdfFileName || `${job.title}_Advertisement.pdf`,
                          fileUrl: url,
                          fileType: 'application/pdf'
                        });
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold border border-rose-500/40 flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Official PDF</span>
                  </button>
                ) : (hints.pdfSourceUrl?.requiresUpgrade || (isExternal && hints.sourceUrl?.requiresUpgrade)) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpgrade) {
                        onClose();
                        onUpgrade();
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Unlock Source PDF</span>
                  </button>
                )}

                {job.clippingImageUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (job.clippingImageUrl) {
                        setPreviewDoc({
                          name: `${job.newspaperName || 'Newspaper'}_Clipping.jpg`,
                          fileUrl: job.clippingImageUrl,
                          fileType: 'image/jpeg'
                        });
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-white text-xs font-bold border border-teal-500/40 flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>View Clipping Image</span>
                  </button>
                ) : hints.clippingImageUrl?.requiresUpgrade && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpgrade) {
                        onClose();
                        onUpgrade();
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Unlock Ad Clipping</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Complete Extracted Document & Gazette Text */}
          {job.extractedText && job.extractedText.trim().length > 0 && (
            <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Official Advertisement / Complete Gazette Text
                  </h3>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(job.extractedText || '')}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-emerald-400 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFullExtracted(!showFullExtracted)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                    title={showFullExtracted ? 'Collapse' : 'Expand full height'}
                  >
                    {showFullExtracted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Complete verbatim vacancy notification including multi-column tables, qualifications, quota allocations, age relaxation, and examination rules.
              </p>

              <div className={`rounded-xl border border-slate-800 bg-slate-900/90 p-4 overflow-y-auto ${showFullExtracted ? 'max-h-[60vh]' : 'max-h-60'}`}>
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                  {job.extractedText}
                </pre>
              </div>
            </div>
          )}

          {/* External Application Notice & Warning */}
          {isExternal && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                {validExternalUrl ? <ExternalLink className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
                <span>
                  {validExternalUrl ? 'External Department / Official Portal Application (سرکاری و دفتری پورٹل)' : 'Premium Feature — External Application Link'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {validExternalUrl 
                  ? (applySettings.externalApplicationWarning || 'Notice: You can submit your application directly on the official employer/department recruitment website.')
                  : 'Notice: The external portal link for this vacancy is restricted to Premium Subscribers. Upgrade your account to unlock direct application URLs.'}
              </p>
              {validExternalUrl && (
                <div className="pt-1">
                  <a
                    href={validExternalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all"
                  >
                    <span>سرکاری پورٹل پر جائیں (Visit Official Portal)</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Sticky Modal Footer Actions */}
        <div className="sticky bottom-0 z-20 shrink-0 p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center space-x-1.5 shrink-0"
              aria-label="Close Modal"
            >
              <X className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Close</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleSave(job.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1.5 shrink-0 ${
                isSaved
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Bookmark className="w-4 h-4 fill-current shrink-0" />
              <span>{isSaved ? 'Saved' : 'Save Job'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* External Portal link button (renders ONLY if valid URL exists, or shows locked Premium badge) */}
            {validExternalUrl ? (
              <a
                href={validExternalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>External Portal (باہر کا لنک)</span>
              </a>
            ) : hasRedactedExternal ? (
              <div
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-800/80 text-amber-400/90 border border-amber-500/30 flex items-center space-x-1.5 cursor-not-allowed shrink-0"
                title="Premium Feature — External Link Locked"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Premium Feature — External Link</span>
              </div>
            ) : null}

            {/* Apply Button */}
            {isApplyRestricted ? (
              <button
                type="button"
                onClick={() => {
                  if (onUpgrade) {
                    onClose();
                    onUpgrade();
                  }
                }}
                className="px-5 py-2.5 rounded-xl font-extrabold text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 flex items-center space-x-2 shadow-lg shrink-0 cursor-pointer transition-all active:scale-95"
                title="Upgrade to Premium Subscription to unlock application destination"
              >
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>🔒 Premium Feature (Upgrade to Apply)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onApply(job);
                }}
                disabled={isExpired || applySettings.enableApplyButton === false}
                className={`px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm shadow-xl transition-all flex items-center space-x-2 shrink-0 ${
                  isExpired || applySettings.enableApplyButton === false
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 hover:scale-105 active:scale-95'
                }`}
              >
                <Send className="w-4 h-4 text-slate-950 shrink-0" />
                <span>{applySettings.applyButtonText || 'Apply Directly (پورٹل پر اپلائی کریں)'}</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Candidate Document Preview Lightbox Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center space-x-2 min-w-0">
                {previewDoc.fileType === 'application/pdf' || previewDoc.name.toLowerCase().endsWith('.pdf') ? (
                  <FileText className="w-5 h-5 text-rose-400 shrink-0" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-teal-400 shrink-0" />
                )}
                <div className="truncate">
                  <h4 className="font-bold text-sm text-white truncate" title={previewDoc.name}>
                    {previewDoc.name}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Official recruitment document / verified circular
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={`${previewDoc.fileUrl}${previewDoc.fileUrl.includes('?') ? '&' : '?'}download=1`}
                  download={previewDoc.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <a
                  href={previewDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center space-x-1 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close Document Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-950/80 flex items-center justify-center min-h-[50vh]">
              {previewDoc.fileType === 'application/pdf' || previewDoc.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.fileUrl}
                  title={previewDoc.name}
                  className="w-full h-[70vh] rounded-lg border border-slate-800 bg-white"
                />
              ) : (
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.name}
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

