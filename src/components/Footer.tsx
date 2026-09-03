import React, { useState, useRef } from 'react';
import { Briefcase, ShieldCheck, Heart, Sparkles, MessageSquare, Mail, Phone, Lock, AlertTriangle, ShieldAlert } from 'lucide-react';

interface FooterProps {
  onTriggerAdminClickTrick: () => void;
  onOpenSubscriptionModal: () => void;
  onOpenLegalModal?: (tab: 'disclaimer' | 'privacy' | 'terms' | 'contact') => void;
}

export const Footer: React.FC<FooterProps> = ({
  onTriggerAdminClickTrick,
  onOpenSubscriptionModal,
  onOpenLegalModal
}) => {
  const [clickCount, setClickCount] = useState<number>(0);
  const clickTimeoutRef = useRef<any>(null);

  const handleSecretClick = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    if (nextCount >= 5) {
      setClickCount(0);
      onTriggerAdminClickTrick();
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        setClickCount(0);
      }, 3000);
    }
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-xs py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Brand Info */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base text-white">HybridJobs<span className="text-emerald-400">.pk</span></span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Automated Hybrid & Remote Jobs Portal for Pakistan & Global Talent. Multi-level province, city, and district level sorting.
            </p>
          </div>

          {/* Col 2: Top Locations */}
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Popular Regions</h4>
            <ul className="space-y-2 text-slate-400">
              <li>Lahore (Gulberg & Model Town)</li>
              <li>Karachi (Clifton & DHA)</li>
              <li>Islamabad (Blue Area Zone 1)</li>
              <li>Rawalpindi (Saddar Area)</li>
              <li>Global US/UK International Remote</li>
            </ul>
          </div>

          {/* Col 3: Legal & Trust Center */}
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Legal & Trust</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal?.('disclaimer')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer flex items-center space-x-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400/80" />
                  <span>Public Disclaimer</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal?.('privacy')}
                  className="hover:text-emerald-400 transition-colors text-left cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal?.('terms')}
                  className="hover:text-emerald-400 transition-colors text-left cursor-pointer"
                >
                  Terms & Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal?.('contact')}
                  className="hover:text-indigo-400 transition-colors text-left cursor-pointer flex items-center space-x-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-400/80" />
                  <span>Contact Us & Fraud Report</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Newsletter */}
          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Get Instant Job Alerts</h4>
            <p className="text-slate-400 text-xs">Join 12,000+ jobseekers receiving daily WhatsApp job digests.</p>
            <button
              onClick={onOpenSubscriptionModal}
              className="w-full py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Subscribe to Alerts (PKR 300)</span>
            </button>
          </div>

        </div>

        {/* Public Disclaimer Banner */}
        <div className="p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong className="text-amber-300 font-semibold">Important Disclaimer:</strong> All jobs and advertisements listed are independent of the websites and should be pursued at your own risk. We are not responsible for any investments or applications made. While our customers post these jobs and advertisements, and we strive to ensure their validity, we cannot guarantee 100% accuracy. These listings have no direct affiliation with the websites mentioned.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenLegalModal?.('disclaimer')}
            className="shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 cursor-pointer"
          >
            Read Full Legal Notice
          </button>
        </div>

        {/* Bottom Bar & Hidden Admin Trigger */}
        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-slate-500 text-[11px] gap-2">
          
          <div className="flex items-center space-x-2">
            <span>© 2026 HybridJobs Portal. All rights reserved.</span>
            
            {/* HIDDEN SECRET CLICK TRIGGER (Click 5 times on copyright symbol or lock) */}
            <span
              onClick={handleSecretClick}
              className="inline-flex items-center cursor-pointer select-none p-1 rounded hover:bg-slate-900 hover:text-amber-400 transition-colors"
              title="Portal Core"
            >
              <Lock className="w-3.5 h-3.5 text-slate-600 hover:text-amber-400" />
              {clickCount > 0 && (
                <span className="ml-1 text-[10px] text-amber-400 font-bold animate-pulse">
                  [{clickCount}/5 clicks]
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => onOpenLegalModal?.('privacy')}
              className="hover:text-slate-300 cursor-pointer bg-transparent border-0 p-0 text-[11px] text-slate-500"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              onClick={() => onOpenLegalModal?.('terms')}
              className="hover:text-slate-300 cursor-pointer bg-transparent border-0 p-0 text-[11px] text-slate-500"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              onClick={() => onOpenLegalModal?.('contact')}
              className="hover:text-slate-300 cursor-pointer bg-transparent border-0 p-0 text-[11px] text-slate-500"
            >
              Contact Us
            </button>
            <span>•</span>
            <span className="text-slate-600">Pakistan & Global Job Index</span>
          </div>

        </div>

      </div>
    </footer>
  );
};
