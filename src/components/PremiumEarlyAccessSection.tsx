import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Crown, LockKeyhole, ArrowRight, Building2, ChevronDown, Sparkles } from 'lucide-react';
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

interface EarlyAccessPreview {
  slot: number;
  earlyAccessEndsAt?: string | null;
}

interface Props {
  onUpgrade: () => void;
  onExplore: () => void;
}

function formatRemaining(endsAt?: string | null, now = Date.now()): string {
  if (!endsAt) return 'Release time unavailable';
  const remaining = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(remaining)) return 'Release time unavailable';
  if (remaining <= 0) return 'Available to everyone';
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return days > 0
    ? `${days}d ${hours}h ${minutes}m`
    : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

  const jobs: EarlyAccessJob[] = useMemo(
    () => Array.isArray(payload?.jobs) ? payload.jobs : [],
    [payload]
  );
  const previews: EarlyAccessPreview[] = useMemo(
    () => Array.isArray(payload?.previewJobs) ? payload.previewJobs : [],
    [payload]
  );
  const hasEarlyAccess = payload?.hasEarlyAccess === true || (payload?.hasEarlyAccess === undefined && payload?.isPremium === true);
  const hasTimers = payload?.config?.showCountdown !== false && (jobs.length > 0 || previews.length > 0 || Boolean(payload?.nextReleaseAt));

  useEffect(() => {
    if (!hasTimers) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasTimers]);

  if (!payload?.success || !payload.enabled || payload.config?.showOnLanding === false) return null;

  const config = payload.config || {};
  const count = Number(payload.count || 0);
  const earlyHours = Math.max(1, Number(config.durationHours) || 24);

  return (
    <section aria-label="Premium early access jobs" className="mx-auto w-full max-w-7xl">
      <div className="overflow-hidden rounded-xl border border-emerald-500/25 bg-slate-950/95 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
              <Crown className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs font-black text-white">Get selected new jobs {earlyHours} hours early</span>
                {config.showJobCount !== false && (
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                    {count} early-access jobs
                  </span>
                )}
              </div>
              <p className="text-[10px] leading-tight text-slate-400">Premium members can view and apply before public release.</p>
            </div>
          </div>
          {!hasEarlyAccess ? (
            <button type="button" onClick={onUpgrade} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-400 px-3 py-1.5 text-[11px] font-black text-slate-950 hover:bg-emerald-300">
              <LockKeyhole className="h-3 w-3" /> Buy Now <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-200">
              <Sparkles className="h-3 w-3" /> Early access active
            </span>
          )}
        </div>

        <details className="group border-t border-white/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.03] sm:px-4">
            <span>{hasEarlyAccess ? 'View available early-access jobs and release timers' : 'See how early access works and job release timers'}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-emerald-300 transition-transform group-open:rotate-180" />
          </summary>

          {hasEarlyAccess ? (
            jobs.length > 0 ? (
              <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto border-t border-white/5 p-2 sm:grid-cols-2">
                {jobs.map((job) => (
                  <button key={job.id} type="button" onClick={onExplore} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-left hover:border-emerald-400/40">
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-bold text-white">{job.title || 'Job opportunity'}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-400">{[job.company, job.department, job.city || job.province].filter(Boolean).join(' · ')}</span>
                      {job.sourceLabel && <span className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-emerald-300"><Building2 className="h-2.5 w-2.5" />{job.sourceLabel}</span>}
                    </span>
                    {config.showCountdown !== false && (
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-200">
                        <Clock3 className="h-3 w-3" />{formatRemaining(job.earlyAccessEndsAt, now)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="border-t border-white/5 px-3 py-3 text-[11px] text-slate-400">There are no active early-access jobs right now. This list refreshes automatically.</p>
            )
          ) : (
            <div className="border-t border-white/5 p-3">
              <p className="mb-2 text-[10px] leading-relaxed text-slate-400">Each selected job has its own {earlyHours}-hour early-access period. Its timer starts when approved or published; a new job never resets another job's timer.</p>
              {previews.length > 0 ? (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {previews.map((item) => (
                    <div key={item.slot} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-slate-300">
                        <LockKeyhole className="h-3 w-3 shrink-0 text-emerald-300" />
                        <span>Premium job #{item.slot}</span>
                      </span>
                      {config.showCountdown !== false && (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-200">
                          <Clock3 className="h-3 w-3" />{formatRemaining(item.earlyAccessEndsAt, now)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">{count > 0 ? 'Unlock Premium to view the available jobs and their individual release times.' : 'New early-access jobs will appear here when available.'}</p>
              )}
              <button type="button" onClick={onUpgrade} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-3 py-2 text-[11px] font-black text-slate-950 hover:bg-emerald-300">
                Buy Now to unlock jobs <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </details>
      </div>
    </section>
  );
};
