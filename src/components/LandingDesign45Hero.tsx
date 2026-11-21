import React from 'react';
import { LandingHeroConfig, LandingDesignId, SUPPORTED_COUNTRIES } from '../types/landing';
import { JobFilters } from '../types/job';

interface Props {
  designId: LandingDesignId;
  config: LandingHeroConfig;
  totalJobsCount: number;
  onExplore: () => void;
  onCv: () => void;
  onPostJob: () => void;
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
}

const DEFAULT_SEEKER_IMAGE = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1400&q=85';
const DEFAULT_EMPLOYER_IMAGE = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1400&q=85';
const DEFAULT_DESIGN4_IMAGE = 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=2000&q=85';
const safeImage = (value: string | undefined, fallback: string) =>
  value && (/^https:\/\//i.test(value.trim()) || (/^\/(?!\/)/.test(value.trim()))) ? value.trim() : fallback;

export const LandingDesign45Hero: React.FC<Props> = ({ designId, config, totalJobsCount, onExplore, onCv, onPostJob, filters, onFiltersChange }) => {
  const seekerImage = safeImage(config.design5SeekerImageUrl, DEFAULT_SEEKER_IMAGE);
  const employerImage = safeImage(config.design5EmployerImageUrl, DEFAULT_EMPLOYER_IMAGE);
  if (designId === 'design-5') {
    return (
      <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-[28px] border border-slate-200 shadow-2xl">
          <article className="relative min-h-[430px] sm:min-h-[500px] flex items-end bg-slate-900">
            <img src={seekerImage} alt="Professional candidate" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_SEEKER_IMAGE; }} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-900/10" />
            <div className="relative z-10 p-7 sm:p-10 text-white max-w-xl">
              <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider">{config.design5SeekerEyebrow || 'For Job Seekers'}</span>
              <h1 className="mt-5 text-4xl sm:text-5xl font-black leading-tight">{config.design5SeekerHeading || 'Find your next opportunity.'}</h1>
              <p className="mt-4 max-w-md text-sm sm:text-base text-white/85">{config.design5SeekerDescription || 'Discover verified jobs, explore career paths and build a professional CV with tools made for your next move.'}</p>
              <button onClick={onExplore} className="mt-7 rounded-xl bg-emerald-400 px-6 py-3 font-extrabold text-slate-950 hover:bg-emerald-300">{config.design5SeekerPrimaryBtnText || 'Explore Jobs'} <span aria-hidden>→</span></button>
              <button onClick={onCv} className="ml-3 mt-7 rounded-xl border border-white/50 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20">{config.design5SeekerSecondaryBtnText || 'Build CV'}</button>
            </div>
          </article>
          <article className="relative min-h-[430px] sm:min-h-[500px] flex items-end bg-slate-900">
            <img src={employerImage} alt="Employer and hiring professional" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_EMPLOYER_IMAGE; }} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-900/10" />
            <div className="relative z-10 p-7 sm:p-10 text-white max-w-xl">
              <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider">{config.design5EmployerEyebrow || 'For Employers'}</span>
              <h2 className="mt-5 text-4xl sm:text-5xl font-black leading-tight">{config.design5EmployerHeading || 'Build your team with confidence.'}</h2>
              <p className="mt-4 max-w-md text-sm sm:text-base text-white/85">{config.design5EmployerDescription || 'Reach skilled talent, publish vacancies and manage your hiring journey from one platform.'}</p>
              <button onClick={onPostJob} className="mt-7 rounded-xl bg-white px-6 py-3 font-extrabold text-slate-950 hover:bg-slate-100">{config.design5EmployerBtnText || 'Post a Job'} <span aria-hidden>→</span></button>
            </div>
          </article>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-800 shadow-sm">
          <span className="text-sm font-semibold">A smarter way to connect talent and opportunity across Pakistan.</span>
          <span className="text-sm font-black text-emerald-700">{totalJobsCount.toLocaleString()}+ opportunities on the platform</span>
        </div>
      </section>
    );
  }
  const heroImage = safeImage(config.design4HeroImageUrl, DEFAULT_DESIGN4_IMAGE);
  const overlay = Math.max(35, Math.min(90, Number(config.design45HeroOverlay ?? 68)));
  return (
    <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-6 pt-3 sm:pt-6">
      <div className="relative isolate min-h-[520px] sm:min-h-[590px] overflow-hidden rounded-[28px] bg-slate-950 shadow-2xl">
        <img src={heroImage} alt="Professionals collaborating in a modern workplace" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_DESIGN4_IMAGE; }} className="absolute inset-0 z-0 h-full w-full object-cover" />
        <div className="absolute inset-0 z-0 bg-slate-950" style={{ opacity: overlay / 100 }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-emerald-950/30" />
        <div className="relative z-10 flex min-h-[520px] sm:min-h-[590px] items-center px-6 py-12 sm:px-14">
          <div className="max-w-3xl text-white">
            <span className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-200">{config.eyebrowBadgeText || 'Pakistan’s Career & Hiring Platform'}</span>
            <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">{config.mainHeadingPrefix} <span style={{ color: config.design45AccentColor || '#0f9f78' }}>{config.gradientWord}</span> {config.mainHeadingSuffix}</h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">{config.subHeading}</p>
            <div className="mt-8 grid grid-cols-1 gap-2 rounded-2xl border border-white/15 bg-slate-950/65 p-3 backdrop-blur sm:grid-cols-[minmax(0,1fr)_190px_auto]">
              <input aria-label="Search jobs" value={filters.searchQuery} onChange={(event) => onFiltersChange({ ...filters, searchQuery: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') onExplore(); }} placeholder={config.searchPlaceholder || 'Search jobs, skills or company'} className="min-w-0 rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              <select aria-label="Filter by region" value={filters.region} onChange={(event) => onFiltersChange({ ...filters, region: event.target.value, province: '', city: '', district: '' })} className="rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="All">All Regions</option><option value="Global">Global Remote</option>
                {SUPPORTED_COUNTRIES.filter((country) => country.code !== 'GL').map((country) => <option key={country.code} value={country.region || country.name}>{country.name}</option>)}
              </select>
              <button onClick={onExplore} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300">Search Jobs</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={onExplore} style={{ backgroundColor: config.design45AccentColor || '#0f9f78' }} className="rounded-xl px-6 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30 hover:brightness-110">{config.primaryBtnText || 'Explore Latest Jobs'} <span aria-hidden>→</span></button>
              <button onClick={onCv} className="rounded-xl border border-white/45 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur hover:bg-white/20">{config.secondaryBtnText || 'Build Your CV'}</button>
              <button onClick={onPostJob} className="rounded-xl border border-amber-300/60 bg-amber-300/10 px-6 py-3.5 text-sm font-bold text-amber-100 hover:bg-amber-300/20">{config.design4PostJobBtnText || 'Post a Job'}</button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-200">
              <span><strong className="text-white">{totalJobsCount.toLocaleString()}+</strong> live opportunities</span>
              <span>Pakistan-wide job discovery</span><span>Career tools for every step</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
