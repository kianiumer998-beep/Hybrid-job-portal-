import React, { useMemo, useState } from 'react';
import { CvData } from '../types/job';

interface CvToolsPanelProps {
  cvData: CvData;
  settings?: { atsCompatibilityEnabled?: boolean; aiWritingAssistantEnabled?: boolean };
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').split(/\s+/).filter((word) => word.length > 2);
const STOP_WORDS = new Set(['and','the','for','with','you','your','our','are','was','were','this','that','from','have','has','will','can','who','what','when','where','how','job','role','work','team','about','into','their','they','them','his','her','its','not','but','all','any','per','etc']);

export const CvToolsPanel: React.FC<CvToolsPanelProps> = ({ cvData, settings = {} }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [checked, setChecked] = useState(false);
  const cvText = useMemo(() => [
    cvData.personalInfo.jobTitle, cvData.personalInfo.summary,
    ...cvData.experience.flatMap((item) => [item.position, item.company, ...(item.bullets || [])]),
    ...cvData.education.flatMap((item) => [item.degree, item.fieldOfStudy, item.institution]),
    ...cvData.skills.technical, ...cvData.skills.soft, ...cvData.skills.languages,
    ...cvData.certifications.map((item) => item.name),
    ...(cvData.additionalSections?.projects || [])
  ].join(' '), [cvData]);
  const analysis = useMemo(() => {
    const jobWords = [...new Set(normalize(jobDescription).filter((word) => !STOP_WORDS.has(word)))];
    const cvWords = new Set(normalize(cvText));
    const matched = jobWords.filter((word) => cvWords.has(word));
    const missing = jobWords.filter((word) => !cvWords.has(word));
    const percent = jobWords.length ? Math.round((matched.length / jobWords.length) * 100) : 0;
    return { matched, missing, percent, total: jobWords.length };
  }, [cvText, jobDescription]);

  if (settings.atsCompatibilityEnabled === false) return null;
  return <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 space-y-3" aria-label="ATS compatibility checker">
    <div>
      <h3 className="text-sm font-bold text-white">ATS Compatibility Checker (offline)</h3>
      <p className="mt-1 text-xs text-slate-400">Paste a job description to compare its important words with your CV. Analysis runs in this browser; your CV and job description are not sent to an AI service.</p>
    </div>
    <textarea value={jobDescription} onChange={(event) => { setJobDescription(event.target.value.slice(0, 20000)); setChecked(false); }} rows={4} maxLength={20000} placeholder="Paste the job description here (up to 20,000 characters)…" className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
    <button type="button" disabled={normalize(jobDescription).length === 0} onClick={() => setChecked(true)} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Check CV against job</button>
    {checked && <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
      {analysis.total === 0 ? <p className="text-xs text-amber-300">Please paste a job description containing meaningful text.</p> : <>
        <div className="flex items-center justify-between"><span className="text-xs text-slate-300">Keyword coverage</span><strong className="text-xl text-emerald-300">{analysis.percent}%</strong></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-500" style={{ width: analysis.percent + '%' }} /></div>
        <p className="text-[11px] text-slate-500">This is a simple keyword comparison, not an employer ATS score, ranking prediction, or guarantee.</p>
        <div><p className="text-xs font-bold text-emerald-300">Found in your CV ({analysis.matched.length})</p><p className="mt-1 text-xs text-slate-300">{analysis.matched.slice(0, 40).join(', ') || 'No matching keywords found.'}</p></div>
        <div><p className="text-xs font-bold text-amber-300">Not found ({analysis.missing.length})</p><p className="mt-1 text-xs text-slate-300">{analysis.missing.slice(0, 40).join(', ') || 'No missing keywords in this comparison.'}</p><p className="mt-1 text-[11px] text-slate-500">Only add missing skills or terms if they truthfully describe your experience.</p></div>
      </>}
    </div>}
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs font-bold text-white">AI Writing Assistant</p>
      <p className="mt-1 text-xs text-slate-400">{settings.aiWritingAssistantEnabled === true ? 'Admin has enabled the future AI option, but no AI provider/API key is configured. AI writing is unavailable until a secure server-side provider is connected.' : 'Currently disabled by the administrator. A real AI provider and server-side API key are required; no fake AI-generated content is shown.'}</p>
    </div>
  </section>;
};
