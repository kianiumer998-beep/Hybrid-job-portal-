import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Lock, 
  Building2, 
  Sparkles,
  Loader2
} from 'lucide-react';
import { Job, JobApplication, UserAccount } from '../types/job';
import { api } from '../services/api';

interface CandidateApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  currentUser: UserAccount | null;
  onApplicationSubmitted: (app: JobApplication) => void;
}

export const CandidateApplicationModal: React.FC<CandidateApplicationModalProps> = ({
  isOpen,
  onClose,
  job,
  currentUser,
  onApplicationSubmitted
}) => {
  const [settings, setSettings] = useState<any>({
    enableApplyButton: true,
    applyButtonText: 'Apply Now',
    applicationModalTitle: 'Submit Job Application',
    applicationInstructions: 'Complete the verified application details below. The hiring employer or department will review your credentials directly.',
    successMessage: 'Your application has been received successfully and forwarded to the hiring team!',
    loginRequiredMessage: 'Please sign in or register a free candidate account to track this application in your dashboard.',
    confirmationMessage: 'Are you sure you want to submit your verified application for this vacancy?',
    requireCv: true,
    requireCoverLetter: false,
    requirePhone: true,
    requireEmail: true,
    allowExternalApplication: true,
    externalApplicationWarning: 'Notice: You will be redirected to the official department/portal hiring page to submit your application directly.',
    expiredJobMessage: 'This employment opportunity has passed its application deadline and is no longer accepting new submissions.',
    customQuestions: []
  });

  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [cvFileName, setCvFileName] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      if (currentUser) {
        setApplicantName(currentUser.name || '');
        setApplicantEmail(currentUser.email || '');
        setApplicantPhone(currentUser.phone || '');
        if ((currentUser as any).cvDocument) {
          setCvFileName((currentUser as any).cvDocument.name || 'Profile_Resume.pdf');
        }
      }
      setIsSuccess(false);
      setErrorMessage('');
    }
  }, [isOpen, currentUser]);

  const loadSettings = async () => {
    try {
      const data = await api.applySettings.get();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch {}
  };

  if (!isOpen || !job) return null;

  // Check if job has expired
  const isExpired = job.deadlineDate && new Date(job.deadlineDate) < new Date();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCvFileName(file.name);
    }
  };

  const handleCustomAnswerChange = (questionId: string, value: any) => {
    setCustomAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (settings.requirePhone && !applicantPhone.trim()) {
      setErrorMessage('Phone number is required by employer.');
      return;
    }

    if (settings.requireEmail && !applicantEmail.trim()) {
      setErrorMessage('Email address is required.');
      return;
    }

    if (settings.requireCv && !cvFileName) {
      setErrorMessage('Please upload your CV / resume.');
      return;
    }

    // Check mandatory custom questions
    if (settings.customQuestions && Array.isArray(settings.customQuestions)) {
      for (const q of settings.customQuestions) {
        if (q.required && !customAnswers[q.id]) {
          setErrorMessage(`Please answer: "${q.question}"`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const appPayload = {
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.company,
        applicantId: currentUser ? currentUser.id : `guest-${Date.now().toString(36)}`,
        applicantName: applicantName.trim() || 'Candidate',
        applicantEmail: applicantEmail.trim(),
        applicantPhone: applicantPhone.trim(),
        coverLetter: coverLetter.trim(),
        cvFileName: cvFileName || 'Resume.pdf',
        answers: customAnswers
      };

      const result = await api.applications.submit(appPayload);

      if (result.success) {
        setIsSuccess(true);
        onApplicationSubmitted(result.application || {
          id: 'app-' + Date.now(),
          ...appPayload,
          appliedAt: new Date().toISOString(),
          status: 'Under Review',
          paymentStatus: 'Submitted'
        });
      } else {
        setErrorMessage(result.message || 'Error submitting application.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection error while submitting application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200 text-white">
        
        {/* Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{settings.applicationModalTitle || 'Submit Job Application'}</span>
            </div>
            <h3 className="text-xl font-black text-white">{job.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{job.company} • {job.city || job.region}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5 text-sm">
          
          {/* Expired Job Notice */}
          {isExpired ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h4 className="font-bold text-rose-300">Application Deadline Passed</h4>
              <p className="text-xs text-slate-400">{settings.expiredJobMessage}</p>
            </div>
          ) : isSuccess ? (
            /* Success State */
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-white">Application Received!</h4>
                <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                  {settings.successMessage}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all"
              >
                Close Window
              </button>
            </div>
          ) : (
            /* Standard Application Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Employer Instructions */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-400">
                {settings.applicationInstructions}
              </div>

              {/* External Redirect Warning if Scraped */}
              {job.sourceUrl && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-2.5 text-xs text-amber-200">
                  <ExternalLink className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-300">Official Portal Application Available:</span>
                    <span>{settings.externalApplicationWarning}</span>
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center space-x-1 text-sky-400 font-bold hover:underline"
                    >
                      <span>Open External Link Directly</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Candidate Info Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Candidate Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="e.g. Muhammad Ali"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address {settings.requireEmail && <span className="text-rose-400">*</span>}
                  </label>
                  <input
                    type="email"
                    required={settings.requireEmail}
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="e.g. ali@example.com"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mobile / WhatsApp Number {settings.requirePhone && <span className="text-rose-400">*</span>}
                </label>
                <input
                  type="tel"
                  required={settings.requirePhone}
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              {/* CV Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Resume / Curriculum Vitae (PDF or DOCX) {settings.requireCv && <span className="text-rose-400">*</span>}
                </label>
                <div className="p-4 bg-slate-950 border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl text-center transition-colors">
                  <input
                    type="file"
                    id="candidate-cv-upload"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="candidate-cv-upload" className="cursor-pointer block space-y-2">
                    <UploadCloud className="w-8 h-8 text-amber-400 mx-auto" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {cvFileName ? cvFileName : 'Click or Drag Resume File Here'}
                      </span>
                      <span className="text-[10px] text-slate-500">Supported formats: PDF, DOCX (Max 10MB)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Cover Letter (Optional or Required) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cover Letter / Introduction {settings.requireCoverLetter && <span className="text-rose-400">*</span>}
                </label>
                <textarea
                  rows={3}
                  required={settings.requireCoverLetter}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Summarize your key achievements, relevant projects, and readiness for this position..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              {/* Dynamic Admin-Configured Screening Questions */}
              {settings.customQuestions && settings.customQuestions.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Screening Questions
                  </h4>

                  {settings.customQuestions.map((q: any) => (
                    <div key={q.id}>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {q.question} {q.required && <span className="text-rose-400">*</span>}
                      </label>

                      {q.type === 'select' && q.options ? (
                        <select
                          required={q.required}
                          value={customAnswers[q.id] || ''}
                          onChange={(e) => handleCustomAnswerChange(q.id, e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        >
                          <option value="">Select an option...</option>
                          {q.options.map((opt: string, i: number) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : q.type === 'boolean' ? (
                        <div className="flex items-center space-x-4 text-xs">
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`custom-${q.id}`}
                              checked={customAnswers[q.id] === 'Yes'}
                              onChange={() => handleCustomAnswerChange(q.id, 'Yes')}
                              className="text-amber-500"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`custom-${q.id}`}
                              checked={customAnswers[q.id] === 'No'}
                              onChange={() => handleCustomAnswerChange(q.id, 'No')}
                              className="text-amber-500"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      ) : q.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          required={q.required}
                          value={customAnswers[q.id] || ''}
                          onChange={(e) => handleCustomAnswerChange(q.id, e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        />
                      ) : (
                        <input
                          type="text"
                          required={q.required}
                          value={customAnswers[q.id] || ''}
                          onChange={(e) => handleCustomAnswerChange(q.id, e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Error Display */}
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <Send className="w-4 h-4 text-slate-950" />
                )}
                <span>{settings.applyButtonText || 'Submit Job Application'}</span>
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
