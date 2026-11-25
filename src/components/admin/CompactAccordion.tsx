import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CompactAccordionProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeTone?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (nextOpen: boolean) => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const BADGE_CLASSES: Record<NonNullable<CompactAccordionProps['badgeTone']>, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  slate: 'bg-slate-800 text-slate-300 border-slate-700'
};

export const CompactAccordion: React.FC<CompactAccordionProps> = ({
  title,
  subtitle,
  badgeText,
  badgeTone = 'slate',
  defaultOpen = false,
  isOpen: controlledOpen,
  onToggle,
  headerRight,
  children,
  className = ''
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const handleToggle = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) {
      setUncontrolledOpen(next);
    }
    onToggle?.(next);
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5 bg-slate-950/60 border-b border-slate-800/70">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer group"
        >
          <span className="w-6 h-6 rounded-lg bg-slate-800 group-hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 transition-colors">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-white truncate">{title}</span>
              {badgeText && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${BADGE_CLASSES[badgeTone]}`}>
                  {badgeText}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </button>
        {headerRight && (
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
          </div>
        )}
      </div>
      {isOpen && (
        <div className="p-3 sm:p-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};
