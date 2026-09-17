import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileCheck,
  Building,
  UserCheck,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { NotificationItem } from '../../types/notification';
import { UserAccount } from '../../types/job';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

interface MandatoryActionModalProps {
  notification: NotificationItem | null;
  currentUser: UserAccount | null;
  onComplete: (notificationId: string, metadata?: any) => Promise<void>;
  onClose?: () => void;
}

export const MandatoryActionModal: React.FC<MandatoryActionModalProps> = ({
  notification,
  currentUser,
  onComplete,
  onClose
}) => {
  const [agreed, setAgreed] = useState(false);
  const [fullName, setFullName] = useState(currentUser?.name || '');
  const [ntnNumber, setNtnNumber] = useState(currentUser?.companyName ? 'NTN-9821734-1' : '');
  const [secpReg, setSecpReg] = useState(currentUser?.companyName ? 'SECP-0091823' : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!notification) return null;

  const actionType = notification.mandatoryActionType || 'terms_acceptance';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (actionType === 'terms_acceptance' && !agreed) {
      setErrorMsg('You must review and check the agreement box to proceed.');
      return;
    }

    if (actionType === 'kyc') {
      if (!fullName.trim() || !ntnNumber.trim()) {
        setErrorMsg('Please enter your full legal name and official NTN/CNIC/Tax registration number.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onComplete(notification.id, {
        actionType,
        policyVersion: notification.policyVersion || 'v1.0',
        fullName: fullName.trim(),
        ntnNumber: ntnNumber.trim(),
        secpReg: secpReg.trim(),
        agreedAt: new Date().toISOString(),
        userId: currentUser?.id || 'guest'
      });
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete mandatory action. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border-2 border-rose-500/50 rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-rose-950/80 via-slate-900 to-slate-950 border-b border-rose-500/30">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider">
                  Mandatory Action Required
                </span>
                {notification.policyVersion && (
                  <span className="text-xs text-rose-300 font-mono font-bold">
                    [{notification.policyVersion}]
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-white mt-1">{notification.title}</h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            This verification is mandatory for compliance before accessing posting or candidate features on HybridJobs.
          </p>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sanitized Policy/Body */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto prose prose-invert max-w-none shadow-inner">
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(notification.body) }} />
          </div>

          {/* Action-Specific Inputs */}
          {actionType === 'kyc' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
                <Building className="w-4 h-4" />
                <span>Verified Entity / Employer Identity Details</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Full Legal Name / Authorized Representative <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Muhammad Farooq"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    NTN / CNIC / Tax Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ntnNumber}
                    onChange={e => setNtnNumber(e.target.value)}
                    placeholder="e.g. 1234567-8"
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    SECP Registration (Optional)
                  </label>
                  <input
                    type="text"
                    value={secpReg}
                    onChange={e => setSecpReg(e.target.value)}
                    placeholder="e.g. SECP-0019283"
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Acknowledgement Checkbox */}
          <label className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-rose-500 border-slate-700 bg-slate-900 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-medium leading-relaxed">
              I acknowledge, verify, and agree to the compliance requirements stated above for policy version{' '}
              <strong className="text-white font-mono">{notification.policyVersion || 'v1.0'}</strong>.
            </span>
          </label>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !agreed}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-rose-600/30 cursor-pointer transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Verifying & Saving...' : 'Accept & Unlock Portal Access'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
