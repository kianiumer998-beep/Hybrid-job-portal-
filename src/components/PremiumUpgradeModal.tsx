import React, { useEffect, useState } from 'react';
import { X, Lock, Sparkles, Zap, ArrowRight, ShieldCheck, Crown } from 'lucide-react';
import { api } from '../services/api';

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
  const [lowestPriceText, setLowestPriceText] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    api.pricing.get().then((res) => {
      if (!isMounted) return;
      if (res && res.success && res.pricing && Array.isArray(res.pricing.subscriptionPackages)) {
        const enabledPkgs = res.pricing.subscriptionPackages.filter((p: any) => p && p.enabled && Number(p.price) > 0);
        if (enabledPkgs.length > 0) {
          const sorted = [...enabledPkgs].sort((a, b) => Number(a.price) - Number(b.price));
          const lowest = sorted[0];
          setLowestPriceText(`Rs. ${lowest.price}`);
        } else {
          setLowestPriceText(null);
        }
      } else {
        setLowestPriceText(null);
      }
    }).catch(() => {
      if (isMounted) setLowestPriceText(null);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#05130e] border border-emerald-500/30 rounded-3xl shadow-[0_0_35px_rgba(16,185,129,0.18)] overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        
        {/* Subtle top ambient glow bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 motion-reduce:animate-none" />

        {/* Top Header */}
        <div className="p-6 bg-gradient-to-b from-[#081f17] to-[#05130e] border-b border-emerald-500/20 relative text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-emerald-500/20 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Crown className="w-8 h-8 text-emerald-400" />
          </div>

          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
            {customTitle || 'Unlock Premium Access'}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/70 max-w-md mx-auto leading-relaxed">
            {customMessage || (jobTitle ? (
              <>Upgrade your account to apply for <span className="text-emerald-300 font-bold">{jobTitle}</span> and unlock all premium portal features.</>
            ) : (
              'Upgrade to unlock direct application links, official department gazette PDFs, and priority alerts.'
            ))}
          </p>
        </div>

        {/* Benefits List */}
        <div className="p-6 space-y-3 bg-[#05130e]">
          {[
            { icon: Zap, title: 'Direct Application URLs', desc: 'Instant 1-click access to official department & portal application links.' },
            { icon: ShieldCheck, title: 'Official Gazette & Source PDFs', desc: 'Download original recruitment circulars and newspaper ads.' },
            { icon: Sparkles, title: 'Priority WhatsApp Alerts', desc: 'Get instant notifications for newly posted verified vacancies.' }
          ].map((benefit, i) => (
            <div key={i} className="flex items-start space-x-3.5 p-3.5 bg-[#081a14] rounded-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shrink-0 mt-0.5">
                <benefit.icon className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white mb-0.5">{benefit.title}</h4>
                <p className="text-[11px] text-emerald-100/60 leading-normal">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Footer */}
        <div className="p-6 bg-[#040f0b] border-t border-emerald-500/20 flex flex-col space-y-3">
          <button
            type="button"
            onClick={onUpgradeClick}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 text-slate-950 font-black text-sm shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>
              {lowestPriceText ? `Upgrade to Premium — From ${lowestPriceText}` : 'View Available Premium Plans'}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-950 shrink-0" />
          </button>

          <p className="text-[11px] text-emerald-100/50 text-center flex items-center justify-center space-x-1">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Instant Access Upon Admin Verification • Easy Online Subscriptions</span>
          </p>
        </div>

      </div>
    </div>
  );
};
