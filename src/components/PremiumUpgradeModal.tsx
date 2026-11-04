import React from 'react';
import { X, Lock, Sparkles, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle?: string;
  onUpgradeClick: () => void;
  customTitle?: string;
  customMessage?: string;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  isOpen,
  onClose,
  jobTitle,
  onUpgradeClick,
  customTitle,
  customMessage
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Top Header */}
        <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-800 relative text-center">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>

          <h2 className="text-2xl font-black text-white mb-2">
            {customTitle || 'Unlock Premium Access'}
          </h2>
          <p className="text-sm text-slate-400">
            {customMessage || (jobTitle ? (
              <>Upgrade to apply for <span className="text-white font-bold">{jobTitle}</span> and unlock all premium job features.</>
            ) : (
              'Upgrade to unlock direct application links, official PDFs, and priority alerts.'
            ))}
          </p>
        </div>

        {/* Benefits */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {[
              { icon: Zap, text: 'Unlock Direct Application Links' },
              { icon: ShieldCheck, text: 'Access Official Gazette & Source Documents' },
              { icon: Sparkles, text: 'Priority WhatsApp Job Alerts' }
            ].map((benefit, i) => (
              <div key={i} className="flex items-center space-x-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <benefit.icon className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-slate-200">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        <div className="p-6 bg-slate-950/50 border-t border-slate-800">
          <button
            onClick={onUpgradeClick}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Upgrade to Premium</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
