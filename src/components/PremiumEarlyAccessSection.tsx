import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Crown, LockKeyhole, ArrowRight, Building2, ChevronDown } from 'lucide-react';
import { api } from '../services/api';

interface EarlyAccessJob {
  id: string;
  title?: string;
  company?: string;
  department?: string;
  city?: string;
  province?: string;
  sourceLabel?: string;
  earlyAccessEndsAt?: string | null;
}

interface Props {
  onUpgrade: () => void;
  onExplore: () => void;
}

function formatRemaining(endsAt?: string | null, now = Date.now()): string {
  if (!endsAt) return 'Access window';
  const remaining = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Available to everyone soon';
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const PremiumEarlyAccessSection: React.FC<Props> = ({ onUpgrade, onExplore }) => {
  const [payload, setPayload] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    const load = () => {
      api.jobs.getEarlyAccess().then((result: any) => {
        if (active && result?.success) setPayload(result);
      }).catch(() => {
        if (active) setPayload(null);
      });
    };
    load();
    const refreshTimer = window.setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', load);
    };
  }, []);

  useEffect(() => {
    if (!payload?.config?.showCountdown || (!payload?.nextReleaseAt && !payload?.jobs?.length)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [payload]);

  const jobs: EarlyAccessJob[] = useMemo(
    () => Array.isArray(payload?.jobs) ? payload.jobs : [],
    [payload]
  );

  if (!payload?.success || !payload.enabled || payload.config?.showOnLanding === false) return null;

  const config = payload.config || {};
  const isPremium = payload.isPremium === true;

  return (
    <section className="mx-auto w-full max-w-7xl px-3 sm:px-6">
      <div className="rounded-xl border border-emerald-500/25 bg-slate-950/95 px-3 py-2.5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Crown className="h-4 w-4 shrink-0 text-emerald-300" />
            <span className="truncate text-xs font-black uppercase tracking-wide text-emerald-200">Premium Access Only · Newest Jobs</span>
            {config.showJobCount !== false && <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">{Number(payload.count || 0)} jobs</span>}
          </div>
          {!isPremium && (
            <button onClick={onUpgrade} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-400 px-3 py-1.5 text-[11px] font-black text-slate-950 hover:bg-emerald-300">
              <LockKeyhole className="h-3 w-3" /> Unlock <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
        {config.showCountdown !== false && !isPremium && payload.nextReleaseAt && (
          <p className="mt-1 text-[10px] font-semibold text-slate-400">Public release: <span className="font-mono text-emerald-200">{formatRemaining(payload.nextReleaseAt, now)}</span></p>
        )}
        {isPremium && jobs.length > 0 && (
          <details className="mt-1.5 border-t border-white/10 pt-1.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-bold text-slate-300">
              <span>View newest jobs and individual release timers</span><ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </summary>
            <div className="mt-2 grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {jobs.map((job) => (
                <button key={job.id} onClick={onExplore} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-left hover:border-emerald-400/40">
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold text-white">{job.title || 'Job opportunity'}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">{[job.company, job.department, job.city || job.province].filter(Boolean).join(' · ')}</span>
                    {job.sourceLabel && <span className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-emerald-300"><Building2 className="h-2.5 w-2.5" />{job.sourceLabel}</span>}
                  </span>
                  {config.showCountdown !== false && (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-200"><Clock3 className="h-3 w-3" />{formatRemaining(job.earlyAccessEndsAt, now)}</span>
                  )}
                </button>
              ))}
            </div>
          </details>
        )}
        {isPremium && jobs.length === 0 && <p className="mt-1 text-[10px] text-slate-400">No active early-access jobs right now. This list refreshes automatically.</p>}
      </div>
    </section>
  );
};
