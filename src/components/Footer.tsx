import React, { useState, useRef } from 'react';
import { Briefcase, ShieldCheck, Heart, Sparkles, MessageSquare, Mail, Phone, Lock } from 'lucide-react';

interface FooterProps {
  onTriggerAdminClickTrick: () => void;
  onOpenSubscriptionModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onTriggerAdminClickTrick,
  onOpenSubscriptionModal
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

          {/* Col 3: Services */}
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Features</h4>
            <ul className="space-y-2 text-slate-400">
              <li>ATS Automated CV Builder</li>
              <li>WhatsApp Job Alert Stream</li>
              <li>Direct HR Application Route</li>
              <li>Verified Remote Listings</li>
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

        {/* Bottom Bar & Hidden Admin Trigger */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-slate-500 text-[11px] gap-2">
          
          <div className="flex items-center space-x-2">
            <span>© 2026 HybridJobs Portal. All rights reserved.</span>
            
            {/* HIDDEN SECRET CLICK TRIGGER (Click 5 times on copyright symbol or shield) */}
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

          <div className="flex space-x-4">
            <span className="hover:text-slate-300 cursor-pointer">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-slate-300 cursor-pointer">Terms of Service</span>
            <span>•</span>
            <span className="hover:text-slate-300 cursor-pointer">Pakistan Job Index</span>
          </div>

        </div>

      </div>
    </footer>
  );
};
