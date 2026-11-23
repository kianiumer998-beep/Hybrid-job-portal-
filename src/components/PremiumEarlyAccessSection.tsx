import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Crown, LockKeyhole, ArrowRight, Building2 } from 'lucide-react';
import { api } from '../services/api';

interface EarlyAccessJob {
  id: string;
  title?: string;
  company?: string;
  department?: string;
  city?: string;
  province?: string;
  jobType?: string;
  deadlineDate?: string;
  salary?: string;
  totalVacancies?: number;
  experienceLevel?: string;
  jobCategory?: string;
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
    api.jobs.getEarlyAccess().then((result: any) => {
      if (active && result?.success) setPayload(result);
    }).catch(() => {
      if (active) setPayload(null);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!payload?.config?.showCountdown || !payload?.isPremium || !payload?.jobs?.length) return;
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
    <section className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-5 sm:py-8">
      <div className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-slate-950 via-emerald-950/70 to-slate-900 shadow-xl">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-300">
              <Crown className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-[.16em]">Premium Early Access</span>
            </div>
            {config.showJobCount !== false && (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                {Number(payload.count || 0).toLocaleString()} early-access jobs
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-xl font-black text-white sm:text-2xl">{config.heading || 'Premium Early Access'}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{config.description || 'Explore selected jobs before they become available to other members.'}</p>
            </div>
            {!isPremium && (
              <button onClick={onUpgrade} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300">
                <LockKeyhole className="h-4 w-4" /> Get Early Access <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {!isPremium ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
              <LockKeyhole className="h-5 w-5 shrink-0 text-emerald-300" />
              <span>These jobs are reserved for active Premium members during the early-access period. Other users can view them after the configured release time.</span>
            </div>
          ) : jobs.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {jobs.map((job) => (
                <button key={job.id} onClick={onExplore} className="group flex min-w-0 items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/65 p-3 text-left transition hover:border-emerald-400/40 hover:bg-slate-900">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-white">{job.title || 'Job opportunity'}</span>
                    {(job.company || job.department) && <span className="mt-1 block truncate text-xs text-slate-300">{[job.company, job.department].filter(Boolean).join(' · ')}</span>}
                    {(job.city || job.province) && <span className="mt-1 block truncate text-[11px] text-slate-400">{[job.city, job.province].filter(Boolean).join(', ')}</span>}
                    {job.sourceLabel && <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300"><Building2 className="h-3 w-3" />{job.sourceLabel}</span>}
                  </span>
                  {config.showCountdown !== false && (
                    <span className="flex shrink-0 flex-col items-end gap-1 text-[10px] font-semibold text-emerald-200">
                      <Clock3 className="h-4 w-4" />
                      {formatRemaining(job.earlyAccessEndsAt, now)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              There are no active early-access jobs at the moment. New eligible jobs will appear here automatically.
            </div>
          )}
          {isPremium && <button onClick={onExplore} className="self-start text-xs font-bold text-emerald-300 hover:text-emerald-200">Browse all jobs <span aria-hidden>→</span></button>}
        </div>
      </div>
    </section>
  );
};
