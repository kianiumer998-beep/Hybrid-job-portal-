import React, { useEffect, useState } from 'react';
import { X, Sparkles, CheckCircle2, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

interface CvPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: () => void;
}

export const CvPaywallModal: React.FC<CvPaywallModalProps> = ({
  isOpen,
  onClose,
  onUnlock
}) => {
  const [customs, setCustoms] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    api.applySettings.get().then((res) => {
      if (!isMounted) return;
      if (res && res.success && res.settings && res.settings.modalSettings?.cvPaywall) {
        setCustoms(res.settings.modalSettings.cvPaywall);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-white animate-in fade-in zoom-in duration-200">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
            <Lock className="w-7 h-7" />
          </div>

          <h3 className="text-xl font-black">{customs.title || 'Unlock Premium PDF Download'}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {customs.subtitle || 'Download your watermark-free vector PDF resume formatted for employment applications.'}
          </p>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">{customs.packageTitle || 'Premium CV Export'}</span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                {customs.priceDisplay || 'Price confirmed during payment'}
              </span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1">
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{customs.bullet1 || 'Clean Vector Print Layout'}</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{customs.bullet2 || 'Standard ATS Compatible Structure'}</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{customs.bullet3 || 'Included with Pro Job Alerts Subscription'}</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => {
              onUnlock();
              onClose();
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>{customs.ctaText || 'Upgrade to Pro / Export Resume'}</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>

          <p className="text-[11px] text-slate-500">
            {customs.footerNote || 'Payment verification via Easypaisa, JazzCash & Bank Transfer'}
          </p>
        </div>

      </div>
    </div>
  );
};
