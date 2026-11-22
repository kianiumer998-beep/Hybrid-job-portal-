import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { CvData, CvReviewMetadata, CvReviewStatus } from '../../types/job';
import { BadgeCheck, ClipboardList, Download, Eye, FileText, RefreshCw, Search, ShieldCheck } from 'lucide-react';

interface QueueItem { id: string; name: string; email: string; jobTitle: string; location: string; cvReview: CvReviewMetadata; }
interface SelectedCandidate { id: string; name: string; email: string; cvData: CvData; cvReview: CvReviewMetadata; }
const FILTERS = ['All', 'Submitted', 'Reviewed', 'Verified', 'Needs Changes'] as const;

export const AdminCvReviewHub: React.FC = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<SelectedCandidate | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await api.users.getCvReviewQueue(filter === 'All' ? undefined : filter);
      if (!result?.success || !Array.isArray(result.candidates)) { setError(result?.message || 'CV queue could not be loaded.'); return; }
      setItems(result.candidates);
    } catch (err: any) { setError(err?.message || 'CV queue could not be loaded.'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((item) => [item.name, item.email, item.jobTitle, item.location].some((v) => String(v || '').toLowerCase().includes(q))) : items;
  }, [items, search]);

  const openCandidate = async (item: QueueItem) => {
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await api.users.getCvForReview(item.id);
      if (!result?.success || !result.user?.cvData) { setError(result?.message || 'Candidate CV could not be opened.'); return; }
      setSelected(result.user); setNote(result.user.cvReview?.reviewerNote || '');
    } catch (err: any) { setError(err?.message || 'Candidate CV could not be opened.'); }
    finally { setLoading(false); }
  };

  const updateStatus = async (status: Exclude<CvReviewStatus, 'Draft' | 'Submitted'>) => {
    if (!selected || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await api.users.updateCvReview(selected.id, status, note);
      if (!result?.success) { setError(result?.message || 'Review update failed.'); return; }
      setSelected({ ...selected, cvReview: result.cvReview });
      setMessage(result.message || 'Review status updated.');
      await loadQueue();
    } catch (err: any) { setError(err?.message || 'Review update failed.'); }
    finally { setSaving(false); }
  };

  const printCandidateCv = () => {
    if (!selected) return;
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char] || char));
    const cv = selected.cvData;
    const p = cv.personalInfo;
    const extra: NonNullable<CvData['additionalSections']> = cv.additionalSections || {};
    const section = (title: string, body: string) => body ? `<section><h2>${escapeHtml(title)}</h2>${body}</section>` : '';
    const list = (title: string, values?: string[]) => values?.length ? section(title, `<ul>${values.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>`) : '';
    const experience = cv.experience.map((e) => section('Work Experience', `<h3>${escapeHtml(e.position)} — ${escapeHtml(e.company)}</h3><p>${escapeHtml(e.location)} · ${escapeHtml(e.startDate)} – ${escapeHtml(e.current ? 'Present' : e.endDate)}</p><ul>${e.bullets.filter(Boolean).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`)).join('');
    const education = cv.education.map((e) => `<p><strong>${escapeHtml(e.degree)} ${escapeHtml(e.fieldOfStudy)}</strong> — ${escapeHtml(e.institution)} · ${escapeHtml(e.startDate)} – ${escapeHtml(e.endDate)} ${escapeHtml(e.gpa || '')}</p>`).join('');
    const skills = [...cv.skills.technical, ...cv.skills.soft, ...cv.skills.languages].map(escapeHtml).join(' · ');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>CV - ${escapeHtml(p.fullName)}</title><style>body{font:11pt Arial,sans-serif;color:#172033;max-width:800px;margin:36px auto;line-height:1.45}h1{font-size:22pt;margin:0}h2{font-size:12pt;border-bottom:1px solid #9ca3af;padding-bottom:4px;margin:20px 0 8px;text-transform:uppercase}h3{font-size:11pt;margin:8px 0 2px}p{margin:4px 0;color:#374151}ul{margin:5px 0;padding-left:20px}li{margin:2px 0}@media print{body{margin:15mm;max-width:none}}</style></head><body><h1>${escapeHtml(p.fullName)}</h1><p><strong>${escapeHtml(p.jobTitle)}</strong></p><p>${[p.email,p.phone,p.location,p.website,p.linkedin,p.github].filter(Boolean).map(escapeHtml).join(' · ')}</p>${section('Professional Summary', `<p>${escapeHtml(p.summary)}</p>`)}${section('Career Objective', `<p>${escapeHtml(extra.objective)}</p>`)}${experience}${section('Education', education)}${section('Skills & Languages', `<p>${skills}</p>`)}${list('Certifications',cv.certifications.map((c)=>[c.name,c.issuer,c.year].filter(Boolean).join(' · ')))}${list('Projects',extra.projects)}${list('Internships',extra.internships)}${list('Volunteer Work',extra.volunteerWork)}${list('Achievements & Awards',extra.achievements)}${list('Professional Training',extra.professionalTraining)}${list('Relevant Coursework',extra.relevantCoursework)}${list('Research & Publications',extra.publications)}${list('References',extra.references)}${section('Additional Information',[extra.careerGapExplanation,extra.preferredEmploymentType,extra.noticePeriod,extra.domicile,extra.professionalRegistration].filter(Boolean).map(escapeHtml).join('<br>'))}</body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError('Please allow pop-ups to print or save the CV as PDF.'); return; }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadReviewData = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify({ candidate: { id: selected.id, name: selected.name, email: selected.email }, cvData: selected.cvData, cvReview: selected.cvReview }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `candidate-cv-${selected.id}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  const extra: NonNullable<CvData['additionalSections']> = selected?.cvData.additionalSections || {};
  const completeness = useMemo(() => {
    if (!selected) return { percent: 0, missing: [] as string[] };
    const p = selected.cvData.personalInfo;
    const checks: Array<[string, boolean]> = [
      ['Full name', Boolean(p.fullName.trim())], ['Professional title', Boolean(p.jobTitle.trim())],
      ['Email', Boolean(p.email.trim())], ['Phone', Boolean(p.phone.trim())],
      ['Location', Boolean(p.location.trim())], ['Professional summary', Boolean(p.summary.trim())],
      ['Work experience or education', selected.cvData.experience.length > 0 || selected.cvData.education.length > 0],
      ['At least one skill or language', [...selected.cvData.skills.technical, ...selected.cvData.skills.soft, ...selected.cvData.skills.languages].length > 0]
    ];
    const complete = checks.filter(([, ok]) => ok).length;
    return { percent: Math.round((complete / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
  }, [selected]);
  const lists: Array<[string, string[] | undefined]> = [
    ['Projects', extra.projects], ['Internships', extra.internships], ['Volunteer Work', extra.volunteerWork],
    ['Achievements & Awards', extra.achievements], ['Professional Training', extra.professionalTraining],
    ['Relevant Coursework', extra.relevantCoursework], ['Research & Publications', extra.publications], ['References', extra.references]
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 text-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-emerald-400" /> CV & Career Profile Review</h2><p className="text-xs text-slate-400 mt-1">Only submitted CVs appear here. Full CV data is fetched individually, not exposed in the general user directory.</p></div>
        <button type="button" onClick={() => void loadQueue()} disabled={loading} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold flex items-center gap-2 disabled:opacity-50"><RefreshCw className="w-4 h-4" /> Refresh Queue</button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
      {message && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{message}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidate..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white" /></div><select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="max-w-[130px] px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white">{FILTERS.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="text-[11px] text-slate-500">{filtered.length} candidate(s)</div>
          <div className="space-y-2 max-h-[65vh] overflow-y-auto">
            {filtered.map((item) => <button type="button" key={item.id} onClick={() => void openCandidate(item)} className={`w-full text-left p-3 rounded-xl border ${selected?.id === item.id ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}>
              <div className="flex items-start justify-between gap-2"><strong className="text-sm text-white">{item.name || 'Unnamed candidate'}</strong><span className="text-[10px] rounded-full px-2 py-1 bg-slate-800 text-slate-300">{item.cvReview?.status}</span></div>
              <p className="text-[11px] text-slate-400 mt-1">{item.jobTitle || 'No job title supplied'}</p><p className="text-[10px] text-slate-500 mt-1">{item.email} · {item.location || 'Location not supplied'}</p>
            </button>)}
            {!loading && filtered.length === 0 && <p className="text-xs text-slate-500 py-8 text-center">No submitted CVs found.</p>}
          </div>
        </section>
        <section className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          {!selected ? <div className="min-h-[300px] flex flex-col items-center justify-center text-center text-slate-500"><Eye className="w-9 h-9 mb-3" /><p className="text-sm font-bold">Select a candidate to review their CV</p><p className="text-xs mt-1">The complete CV opens here after selection.</p></div> : <>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div><h3 className="text-lg font-black text-white">{selected.cvData.personalInfo.fullName || selected.name}</h3><p className="text-xs text-slate-400">{selected.cvData.personalInfo.jobTitle} · {selected.cvData.personalInfo.location}</p><p className="text-xs text-slate-500 mt-1">{selected.cvData.personalInfo.email} · {selected.cvData.personalInfo.phone}</p></div>
              <div className="flex gap-2 flex-wrap"><span className="text-[11px] px-2 py-1 rounded bg-slate-800">{selected.cvReview.status}</span><button type="button" onClick={printCandidateCv} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Print / Save PDF</button><button type="button" onClick={downloadReviewData} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Export Data</button></div>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
              <div className="flex items-center justify-between text-xs"><strong className="text-white">Profile completeness</strong><span className="text-emerald-300 font-bold">{completeness.percent}%</span></div>
              <div className="h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${completeness.percent}%` }} /></div>
              {completeness.missing.length > 0 && <p className="text-[10px] text-slate-400 mt-2">Missing: {completeness.missing.join(', ')}</p>}
            </div>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              {selected.cvData.personalInfo.summary && <div><h4 className="text-xs font-black uppercase text-emerald-300 mb-1">Professional Summary</h4><p className="text-xs whitespace-pre-wrap">{selected.cvData.personalInfo.summary}</p></div>}
              {extra.objective && <div><h4 className="text-xs font-black uppercase text-emerald-300 mb-1">Career Objective</h4><p className="text-xs whitespace-pre-wrap">{extra.objective}</p></div>}
              <div><h4 className="text-xs font-black uppercase text-emerald-300 mb-2">Work Experience</h4>{selected.cvData.experience.length ? selected.cvData.experience.map((e) => <div key={e.id} className="border-l-2 border-slate-700 pl-3 mb-3"><strong className="text-sm text-white">{e.position} · {e.company}</strong><p className="text-[11px] text-slate-500">{e.location} · {e.startDate} – {e.current ? 'Present' : e.endDate}</p><ul className="list-disc pl-4 mt-1 text-xs space-y-1">{e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul></div>) : <p className="text-xs text-slate-500">No experience entries.</p>}</div>
              <div><h4 className="text-xs font-black uppercase text-emerald-300 mb-2">Education</h4>{selected.cvData.education.length ? selected.cvData.education.map((e) => <div key={e.id} className="mb-2 text-xs"><strong className="text-white">{e.degree} {e.fieldOfStudy}</strong><p className="text-slate-400">{e.institution} · {e.startDate} – {e.endDate} {e.gpa ? `· ${e.gpa}` : ''}</p></div>) : <p className="text-xs text-slate-500">No education entries.</p>}</div>
              <div><h4 className="text-xs font-black uppercase text-emerald-300 mb-1">Skills & Languages</h4><p className="text-xs">{[...selected.cvData.skills.technical, ...selected.cvData.skills.soft, ...selected.cvData.skills.languages].join(' · ') || 'No skills entered.'}</p></div>
              <div><h4 className="text-xs font-black uppercase text-emerald-300 mb-1">Certifications</h4>{selected.cvData.certifications.map((e) => <p key={e.id} className="text-xs">{e.name} · {e.issuer} · {e.year}</p>)}{!selected.cvData.certifications.length && <p className="text-xs text-slate-500">No certifications.</p>}</div>
              {lists.map(([label, entries]) => entries?.length ? <div key={label}><h4 className="text-xs font-black uppercase text-emerald-300 mb-1">{label}</h4><ul className="list-disc pl-4 text-xs space-y-1">{entries.map((entry, i) => <li key={i}>{entry}</li>)}</ul></div> : null)}
              {(['careerGapExplanation', 'preferredEmploymentType', 'noticePeriod', 'domicile', 'professionalRegistration'] as const).map((field) => extra[field] ? <div key={field}><h4 className="text-xs font-black uppercase text-emerald-300 mb-1">{field.replace(/([A-Z])/g, ' $1')}</h4><p className="text-xs">{extra[field]}</p></div> : null)}
              {selected.cvReview.history?.length ? <div><h4 className="text-xs font-black uppercase text-emerald-300 mb-2">Review History</h4><div className="space-y-2">{selected.cvReview.history.slice().reverse().map((entry, index) => <div key={`${entry.at}-${index}`} className="border-l-2 border-slate-700 pl-3"><p className="text-xs text-white font-bold">{entry.status}</p><p className="text-[10px] text-slate-500">{entry.at} · {entry.by}</p>{entry.note && <p className="text-xs text-slate-300 mt-1">{entry.note}</p>}</div>)}</div></div> : null}
              <div><h4 className="text-xs font-black uppercase text-emerald-300 mb-1">Reviewer Notes</h4><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={3000} rows={4} placeholder="Tell the candidate what is good or what needs correction..." className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white" /></div>
            </div>
            <p className="text-[10px] text-slate-500">“Verified” means an administrator reviewed the CV content. It does not independently authenticate degrees, licences or employment history.</p>
            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
              <button type="button" disabled={saving} onClick={() => void updateStatus('Reviewed')} className="px-3 py-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-200 text-xs font-bold disabled:opacity-50"><Eye className="inline w-3.5 h-3.5 mr-1" /> Mark Reviewed</button>
              <button type="button" disabled={saving} onClick={() => void updateStatus('Verified')} className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-bold disabled:opacity-50"><BadgeCheck className="inline w-3.5 h-3.5 mr-1" /> Verify CV</button>
              <button type="button" disabled={saving} onClick={() => void updateStatus('Needs Changes')} className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-bold disabled:opacity-50"><FileText className="inline w-3.5 h-3.5 mr-1" /> Request Changes</button>
            </div>
            {selected.cvReview.reviewedBy && <p className="text-[10px] text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Last reviewed by {selected.cvReview.reviewedBy} · {selected.cvReview.reviewedAt || ''}</p>}
          </>}
        </section>
      </div>
    </div>
  );
};
