import React, { useMemo, useState } from 'react';
import { CvData } from '../types/job';

type AiAction = 'improve_summary' | 'rewrite_bullet';
interface CvToolsPanelProps {
  cvData: CvData;
  settings?: { atsCompatibilityEnabled?: boolean; aiWritingAssistantEnabled?: boolean; aiProviderConfigured?: boolean };
  onGenerateAiText?: (payload: { action: AiAction; text: string; jobTitle?: string }) => Promise<any>;
  onApplyAiSuggestion?: (action: AiAction, text: string) => void;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.\\s-]/g, ' ').split(/\\s+/).filter((word) => word.length > 2);
const STOP_WORDS = new Set(['and','the','for','with','you','your','our','are','was','were','this','that','from','have','has','will','can','who','what','when','where','how','job','role','work','team','about','into','their','they','them','his','her','its','not','but','all','any','per','etc']);

export const CvToolsPanel: React.FC<CvToolsPanelProps> = ({ cvData, settings = {}, onGenerateAiText, onApplyAiSuggestion }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [checked, setChecked] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction>('improve_summary');
  const [aiText, setAiText] = useState(cvData.personalInfo.summary || '');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiNotice, setAiNotice] = useState('');
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
  const showAts = settings.atsCompatibilityEnabled !== false;
  const showAi = settings.aiWritingAssistantEnabled === true && settings.aiProviderConfigured === true;
  if (!showAts && !showAi) return null;

  const generateAi = async () => {
    setAiLoading(true); setAiError(''); setAiNotice(''); setAiSuggestion('');
    try {
      if (!onGenerateAiText) throw new Error('AI writing service is not connected. Please contact the administrator.');
      const result = await onGenerateAiText({ action: aiAction, text: aiText, jobTitle: cvData.personalInfo.jobTitle });
      if (!result?.success || !result?.suggestion) throw new Error(result?.message || 'The AI provider could not generate a suggestion.');
      setAiSuggestion(String(result.suggestion));
    } catch (error: any) {
      setAiError(error?.message || 'Unable to generate a suggestion right now.');
    } finally {
      setAiLoading(false);
    }
  };

  return <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 space-y-5" aria-label="CV writing and ATS tools">
    {showAts && <div className="space-y-3">
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
    </div>}
    {showAi && <div className="space-y-3 border-t border-slate-800 pt-4">
      <div><h3 className="text-sm font-bold text-white">AI Writing Assistant</h3><p className="mt-1 text-xs text-slate-400">Improve your professional summary or an existing experience bullet. Review every suggestion before applying it to your CV.</p></div>
      <label className="block text-xs text-slate-400">Writing task<select value={aiAction} onChange={e=>{setAiAction(e.target.value as AiAction);setAiSuggestion('');setAiError('');setAiNotice('');}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option value="improve_summary">Improve professional summary</option><option value="rewrite_bullet">Rewrite experience bullet</option></select></label>
      <label className="block text-xs text-slate-400">Text to improve<textarea value={aiText} onChange={e=>{setAiText(e.target.value.slice(0,5000));setAiSuggestion('');setAiError('');}} rows={4} maxLength={5000} placeholder={aiAction === 'improve_summary' ? 'Paste your current professional summary…' : 'Paste one existing work-experience bullet…'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white"/></label>
      <p className="text-[11px] text-slate-500">Only the text you enter and your target job title are sent securely to the configured AI provider. Do not include sensitive personal information. AI usage may incur charges from your provider.</p>
      <button type="button" disabled={aiLoading || aiText.trim().length < 10} onClick={()=>void generateAi()} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">{aiLoading ? 'Generating…' : 'Generate suggestion'}</button>
      {aiError && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{aiError}</p>}
      {aiSuggestion && <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-slate-950 p-3"><p className="text-xs font-bold text-emerald-300">AI suggestion — review before using</p><textarea readOnly value={aiSuggestion} rows={4} className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white"/><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{onApplyAiSuggestion?.(aiAction,aiSuggestion);setAiNotice('Suggestion added to your CV draft. Save your CV to keep the change.');}} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950">{aiAction === 'improve_summary' ? 'Apply to professional summary' : 'Replace first experience bullet'}</button><button type="button" onClick={()=>{void navigator.clipboard?.writeText(aiSuggestion);setAiNotice('Suggestion copied.');}} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200">Copy text</button></div></div>}
      {aiNotice && <p role="status" className="text-xs text-emerald-300">{aiNotice}</p>}
    </div>}
  </section>;
};
