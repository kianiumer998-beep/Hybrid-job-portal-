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
  const [lowestPricePkr, setLowestPricePkr] = useState<number | null>(null);
  const [adminCtaText, setAdminCtaText] = useState<string>('');

  useEffect(() => {
    // Reset state whenever modal is closed or reopening
    if (!isOpen) {
      setLowestPricePkr(null);
      setAdminCtaText('');
      return;
    }

    let isMounted = true;
    setLowestPricePkr(null);

    // Load pricing packages using strictly pricePkr and enabled === true
    api.pricing.get().then((res) => {
      if (!isMounted) return;
      if (res && res.success && res.pricing && Array.isArray(res.pricing.subscriptionPackages)) {
        const validPrices: number[] = [];

        for (const pkg of res.pricing.subscriptionPackages) {
          // Strictly require enabled === true
          if (!pkg || pkg.enabled !== true) continue;

          const raw = pkg.pricePkr;
          if (raw === null || raw === undefined || raw === '') continue;

          const parsed = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
          if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) {
            validPrices.push(parsed);
          }
        }

        if (validPrices.length > 0) {
          const minPrice = Math.min(...validPrices);
          setLowestPricePkr(minPrice);
        } else {
          setLowestPricePkr(null);
        }
      } else {
        setLowestPricePkr(null);
      }
    }).catch(() => {
      if (isMounted) setLowestPricePkr(null);
    });

    // Load apply settings for Admin-editable CTA label
    api.applySettings.get().then((res) => {
      if (!isMounted) return;
      if (res && res.success && res.settings && typeof res.settings.premiumCtaText === 'string') {
        const trimmed = res.settings.premiumCtaText.trim();
        if (trimmed.length > 0) {
          setAdminCtaText(trimmed.slice(0, 80));
        } else {
          setAdminCtaText('');
        }
      }
    }).catch(() => {
      if (isMounted) setAdminCtaText('');
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const baseCtaLabel = adminCtaText || 'Upgrade to Premium';
  const ctaButtonText = lowestPricePkr !== null
    ? `${baseCtaLabel} — From Rs. ${lowestPricePkr}`
    : 'View Available Premium Plans';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85dvh] bg-[#05130e] border border-emerald-500/30 rounded-2xl sm:rounded-3xl shadow-[0_0_35px_rgba(16,185,129,0.18)] overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in duration-200">
        
        {/* Ambient top glow bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shrink-0 motion-reduce:animate-none" />

        {/* Top Header - Fixed & Accessible */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-[#081f17] to-[#05130e] border-b border-emerald-500/20 relative text-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-emerald-500/20 transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center z-10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-2.5 sm:mb-4 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-1.5 tracking-tight">
            {customTitle || 'Unlock Premium Access'}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/70 max-w-md mx-auto leading-relaxed">
            {customMessage || (jobTitle ? (
              <>Upgrade your account to apply for <span className="text-emerald-300 font-bold">{jobTitle}</span> and unlock all premium portal features.</>
            ) : (
              'Upgrade to unlock direct application links, official department gazette PDFs, and priority member features.'
            ))}
          </p>
        </div>

        {/* Benefits List - Internally Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#05130e]">
          {[
            { icon: Zap, title: 'Direct Application URLs', desc: 'Instant 1-click access to official department & portal application links.' },
            { icon: ShieldCheck, title: 'Official Gazette & Source PDFs', desc: 'Download original recruitment circulars and newspaper ads.' },
            { icon: Sparkles, title: 'Priority Member Access', desc: 'Unlock full department details and priority vacancy listings.' }
          ].map((benefit, i) => (
            <div key={i} className="flex items-start space-x-3.5 p-3 sm:p-3.5 bg-[#081a14] rounded-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
              <div className="p-2 sm:p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shrink-0 mt-0.5">
                <benefit.icon className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white mb-0.5">{benefit.title}</h4>
                <p className="text-[11px] text-emerald-100/60 leading-normal">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Footer - Fixed & Reachable */}
        <div className="p-4 sm:p-6 bg-[#040f0b] border-t border-emerald-500/20 flex flex-col space-y-2.5 shrink-0">
          <button
            type="button"
            onClick={onUpgradeClick}
            className="w-full py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>{ctaButtonText}</span>
            <ArrowRight className="w-4 h-4 text-slate-950 shrink-0" />
          </button>

          <p className="text-[10px] sm:text-[11px] text-emerald-100/50 text-center flex items-center justify-center space-x-1">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Instant Access Upon Admin Verification • Easy Online Subscriptions</span>
          </p>
        </div>

      </div>
    </div>
  );
};
