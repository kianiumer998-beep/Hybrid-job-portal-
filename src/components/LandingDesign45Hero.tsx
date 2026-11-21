import React from 'react';
import { LandingHeroConfig, LandingDesignId } from '../types/landing';

interface Props {
  designId: LandingDesignId;
  config: LandingHeroConfig;
  totalJobsCount: number;
  onExplore: () => void;
  onCv: () => void;
  onPostJob: () => void;
}

const safeImage = (value: string | undefined, fallback: string) =>
  value && (/^https:\/\//i.test(value) || (/^\/(?!\/)/.test(value))) ? value : fallback;

export const LandingDesign45Hero: React.FC<Props> = ({ designId, config, totalJobsCount, onExplore, onCv, onPostJob }) => {
  const seekerImage = safeImage(config.design5SeekerImageUrl, 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1400&q=85');
  const employerImage = safeImage(config.design5EmployerImageUrl, 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1400&q=85');
  if (designId === 'design-5') {
    return (
      <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-[28px] border border-slate-200 shadow-2xl">
          <article className="relative min-h-[430px] sm:min-h-[500px] flex items-end bg-slate-900">
            <img src={seekerImage} alt="Professional candidate" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-900/10" />
            <div className="relative z-10 p-7 sm:p-10 text-white max-w-xl">
              <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider">For Job Seekers</span>
              <h1 className="mt-5 text-4xl sm:text-5xl font-black leading-tight">Find your next <span className="text-emerald-300">opportunity.</span></h1>
              <p className="mt-4 max-w-md text-sm sm:text-base text-white/85">Discover verified jobs, explore career paths and build a professional CV with tools made for your next move.</p>
              <button onClick={onExplore} className="mt-7 rounded-xl bg-emerald-400 px-6 py-3 font-extrabold text-slate-950 hover:bg-emerald-300">Explore Jobs <span aria-hidden>→</span></button>
              <button onClick={onCv} className="ml-3 mt-7 rounded-xl border border-white/50 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20">Build CV</button>
            </div>
          </article>
          <article className="relative min-h-[430px] sm:min-h-[500px] flex items-end bg-slate-900">
            <img src={employerImage} alt="Employer and hiring professional" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-900/10" />
            <div className="relative z-10 p-7 sm:p-10 text-white max-w-xl">
              <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider">For Employers</span>
              <h2 className="mt-5 text-4xl sm:text-5xl font-black leading-tight">Build your team with <span className="text-amber-300">confidence.</span></h2>
              <p className="mt-4 max-w-md text-sm sm:text-base text-white/85">Reach skilled talent, publish vacancies and manage your hiring journey from one platform.</p>
              <button onClick={onPostJob} className="mt-7 rounded-xl bg-white px-6 py-3 font-extrabold text-slate-950 hover:bg-slate-100">Post a Job <span aria-hidden>→</span></button>
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
  const heroImage = safeImage(config.design4HeroImageUrl, 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=2000&q=85');
  const overlay = Math.max(35, Math.min(90, Number(config.design45HeroOverlay ?? 68)));
  return (
    <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-6 pt-3 sm:pt-6">
      <div className="relative isolate min-h-[520px] sm:min-h-[590px] overflow-hidden rounded-[28px] bg-slate-950 shadow-2xl">
        <img src={heroImage} alt="Professionals collaborating in a modern workplace" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-slate-950" style={{ opacity: overlay / 100 }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/80 to-emerald-950/30" />
        <div className="flex min-h-[520px] sm:min-h-[590px] items-center px-6 py-12 sm:px-14">
          <div className="max-w-3xl text-white">
            <span className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-200">{config.eyebrowBadgeText || 'Pakistan’s Career & Hiring Platform'}</span>
            <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">{config.mainHeadingPrefix} <span className="text-emerald-300">{config.gradientWord}</span> {config.mainHeadingSuffix}</h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">{config.subHeading}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onExplore} className="rounded-xl bg-emerald-400 px-6 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30 hover:bg-emerald-300">{config.primaryBtnText || 'Explore Latest Jobs'} <span aria-hidden>→</span></button>
              <button onClick={onCv} className="rounded-xl border border-white/45 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur hover:bg-white/20">{config.secondaryBtnText || 'Build Your CV'}</button>
              <button onClick={onPostJob} className="rounded-xl border border-amber-300/60 bg-amber-300/10 px-6 py-3.5 text-sm font-bold text-amber-100 hover:bg-amber-300/20">Post a Job</button>
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
