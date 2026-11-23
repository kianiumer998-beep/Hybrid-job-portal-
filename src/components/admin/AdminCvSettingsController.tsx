import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Save, RefreshCw, AlertCircle, Plus, Trash2 } from 'lucide-react';

const DEFAULT_CV = {
  pdfExportEnabled: true, atsTextExportEnabled: true, freeDesignLimit: 2, freeCvLimit: 1, premiumCvLimit: 10,
  watermarkEnabled: true, watermarkFreeOnly: true, watermarkText: 'Hybrid Job Portal', watermarkOpacity: 0.16,
  atsCompatibilityEnabled: true, aiWritingAssistantEnabled: false, templates: [], packages: []
};

export const AdminCvSettingsController: React.FC<{ onPricingSaved?: (pricing: any) => void }> = ({ onPricingSaved }) => {
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [aiConfig, setAiConfig] = useState<any>({ provider: 'openai', model: 'gpt-4o-mini', apiKeyConfigured: false });
  const [aiApiKey, setAiApiKey] = useState('');
  const [savingAi, setSavingAi] = useState(false);
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [result, aiResult] = await Promise.all([api.pricing.get(), api.pricing.getCvAiConfig()]);
      if (!result?.success || !result.pricing) throw new Error(result?.message || 'Unable to load CV settings.');
      if (aiResult?.success && aiResult.config) setAiConfig(aiResult.config);
      setPricing({ ...result.pricing, cvBuilder: { ...DEFAULT_CV, ...(result.pricing.cvBuilder || {}) }, subscriptionPackages: Array.isArray(result.pricing.subscriptionPackages) ? result.pricing.subscriptionPackages : [] });
    } catch (e: any) { setError(e?.message || 'Unable to load CV settings.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const setCv = (field: string, value: any) => setPricing((p: any) => ({ ...p, cvBuilder: { ...p.cvBuilder, [field]: value } }));
  const setTemplate = (index: number, field: string, value: any) => setCv('templates', pricing.cvBuilder.templates.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item));
  const setPackage = (index: number, field: string, value: any) => setCv('packages', pricing.cvBuilder.packages.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item));
  const setSubscription = (index: number, field: string, value: any) => setPricing((p: any) => ({ ...p, subscriptionPackages: p.subscriptionPackages.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item) }));
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await api.pricing.update({ cvBuilder: pricing.cvBuilder, subscriptionPackages: pricing.subscriptionPackages });
      if (!result?.success) throw new Error(result?.message || 'CV settings were not saved.');
      setPricing((p: any) => ({ ...p, ...result.pricing, cvBuilder: { ...p.cvBuilder, ...(result.pricing?.cvBuilder || {}) } }));
      if (result.pricing) onPricingSaved?.(result.pricing);
      setNotice('CV settings saved successfully.');
    } catch (e: any) { setError(e?.message || 'Unable to save CV settings.'); }
    finally { setSaving(false); }
  };
  const saveAiConfig = async (clearApiKey = false) => {
    setSavingAi(true); setError(''); setNotice('');
    try {
      const result = await api.pricing.updateCvAiConfig({
        provider: aiConfig.provider || 'openai',
        model: aiConfig.model || '',
        ...(aiApiKey.trim() ? { apiKey: aiApiKey.trim() } : {}),
        ...(clearApiKey ? { clearApiKey: true } : {})
      });
      if (!result?.success) throw new Error(result?.message || 'AI provider settings were not saved.');
      setAiConfig(result.config || aiConfig);
      setAiApiKey('');
      setNotice(result.message || 'AI provider settings saved securely.');
    } catch (e: any) { setError(e?.message || 'Unable to save AI provider settings.'); }
    finally { setSavingAi(false); }
  };
  if (loading) return <div className="p-8 text-slate-300">Loading CV settings…</div>;
  if (!pricing) return <div className="m-6 rounded-xl border border-rose-500/30 p-5 text-rose-300">{error || 'CV settings unavailable.'}<button onClick={load} className="ml-3 underline">Retry</button></div>;
  const cv = pricing.cvBuilder;
  return <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 text-white">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">CV Management & Entitlements</h2><p className="mt-1 text-sm text-slate-400">One place for CV designs, quotas, packages, export rules, watermark and subscription benefits.</p></div><div className="flex gap-2"><button onClick={load} className="rounded-lg border border-slate-700 px-3 py-2 text-sm"><RefreshCw className="mr-1 inline h-4 w-4"/>Reload</button><button disabled={saving} onClick={save} className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-slate-950 disabled:opacity-50"><Save className="mr-1 inline h-4 w-4"/>{saving ? 'Saving…' : 'Save CV Settings'}</button></div></div>
    {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"><AlertCircle className="mr-2 inline h-4 w-4"/>{error}</div>}
    {notice && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div>}
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4"><h3 className="font-bold">Global CV rules</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {([{field:'freeCvLimit',label:'Free CV count',max:10},{field:'premiumCvLimit',label:'Premium CV count',max:10},{field:'freeDesignLimit',label:'Free design count',max:5}] as const).map(x=><label key={x.field} className="text-xs text-slate-400">{x.label}<input type="number" min="0" max={x.max} value={cv[x.field] ?? 0} onChange={e=>setCv(x.field,Math.max(0,Math.min(x.max,Math.floor(Number(e.target.value)||0))))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"/></label>)}
      <label className="text-xs text-slate-400">Global watermark text<input maxLength={80} value={cv.watermarkText || ''} onChange={e=>setCv('watermarkText',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"/></label>
      <label className="text-xs text-slate-400">Watermark opacity (0.05–0.35)<input type="number" min="0.05" max="0.35" step="0.01" value={cv.watermarkOpacity ?? 0.16} onChange={e=>setCv('watermarkOpacity',Math.max(0.05,Math.min(0.35,Number(e.target.value)||0.16)))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"/></label>
    </div><div className="flex flex-wrap gap-5 text-sm">{([{field:'pdfExportEnabled',label:'Allow PDF export'},{field:'atsTextExportEnabled',label:'Allow ATS export'},{field:'watermarkEnabled',label:'Enable export watermark'},{field:'watermarkFreeOnly',label:'Watermark free members only'}] as const).map(x=><label key={x.field} className="flex items-center gap-2"><input type="checkbox" checked={cv[x.field] !== false} onChange={e=>setCv(x.field,e.target.checked)}/>{x.label}</label>)}</div><p className="text-xs text-amber-300">Preview is always watermarked. Export files are now generated by the server and consume quota only when generated.</p></section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4"><h3 className="font-bold">ATS & AI tools</h3><div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={cv.atsCompatibilityEnabled !== false} onChange={e=>setCv('atsCompatibilityEnabled',e.target.checked)}/>Enable offline ATS keyword checker</label><label className="flex items-center gap-2"><input type="checkbox" checked={cv.aiWritingAssistantEnabled === true} onChange={e=>setCv('aiWritingAssistantEnabled',e.target.checked)}/>Enable AI Writing Assistant for users</label></div><p className="text-xs text-slate-400">When disabled, the AI Assistant is completely hidden from candidates. It becomes visible only when enabled here and a valid provider API key is configured.</p>
      <div className="rounded-xl border border-emerald-500/20 bg-slate-950 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-white">AI provider connection</h4><p className="text-xs text-slate-400">Supports OpenAI, Google Gemini and Groq through their compatible chat API.</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${aiConfig.apiKeyConfigured ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{aiConfig.apiKeyConfigured ? 'API KEY SAVED' : 'NOT CONFIGURED'}</span></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">AI provider<select value={aiConfig.provider || 'openai'} onChange={e=>setAiConfig((p:any)=>({...p,provider:e.target.value,model:e.target.value==='gemini'?'gemini-2.0-flash':e.target.value==='groq'?'llama-3.3-70b-versatile':'gpt-4o-mini'}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="groq">Groq</option></select></label>
        <label className="text-xs text-slate-400">Model name<input maxLength={100} value={aiConfig.model || ''} onChange={e=>setAiConfig((p:any)=>({...p,model:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"/></label></div>
        <label className="block text-xs text-slate-400">Provider API key<input type="password" autoComplete="new-password" maxLength={500} value={aiApiKey} onChange={e=>setAiApiKey(e.target.value)} placeholder={aiConfig.apiKeyConfigured ? 'Key is saved securely — enter a new key only to replace it' : 'Paste your purchased API key here'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"/></label>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={savingAi || (!aiApiKey.trim() && !aiConfig.apiKeyConfigured)} onClick={()=>void saveAiConfig(false)} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">{savingAi ? 'Saving…' : 'Save provider & API key'}</button>{aiConfig.apiKeyConfigured && <button type="button" disabled={savingAi} onClick={()=>void saveAiConfig(true)} className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-300 disabled:opacity-40">Remove saved key</button>}</div>
        <p className="text-[11px] text-slate-500">The API key is encrypted on the server using the existing JWT_SECRET and is never sent back to the browser. Usage charges are billed by your selected AI provider, not by this portal. Keep your key private.</p>
      </div>
    </section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">Individual design controls</h3><p className="text-xs text-slate-400">Enablement, price, create/edit/export/share limits and watermark policy per design.</p></div></div>
      {(cv.templates || []).map((t:any,i:number)=><div key={t.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-slate-400">Design name<input value={t.name || ''} maxLength={80} onChange={e=>setTemplate(i,'name',e.target.value)} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"/></label><label className="text-xs text-slate-400">Price (PKR)<input type="number" min="0" value={t.pricePkr ?? 0} onChange={e=>setTemplate(i,'pricePkr',Math.max(0,Number(e.target.value)||0))} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"/></label><label className="text-xs text-slate-400">Edit policy<select value={t.editMode || 'unlimited'} onChange={e=>setTemplate(i,'editMode',e.target.value)} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"><option value="unlimited">Unlimited</option><option value="limited">Limited</option><option value="disabled">Disabled</option></select></label><label className="text-xs text-slate-400">Watermark<select value={t.exportWatermarkMode || 'inherit'} onChange={e=>setTemplate(i,'exportWatermarkMode',e.target.value)} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"><option value="inherit">Global</option><option value="always">Always</option><option value="never">Never</option></select></label><label className="text-xs text-slate-400">Design watermark text<input maxLength={80} value={t.watermarkText || ''} onChange={e=>setTemplate(i,'watermarkText',e.target.value)} placeholder={cv.watermarkText || 'Hybrid Job Portal'} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"/></label><label className="text-xs text-slate-400">Design watermark opacity<input type="number" min="0.05" max="0.35" step="0.01" value={t.watermarkOpacity ?? cv.watermarkOpacity ?? 0.16} onChange={e=>setTemplate(i,'watermarkOpacity',Math.max(0.05,Math.min(0.35,Number(e.target.value)||0.16)))} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"/></label>
      {([{field:'cvCreateLimit',label:'CV creations'},{field:'editLimit',label:'Edits'},{field:'pdfExportLimit',label:'PDF quota'},{field:'atsExportLimit',label:'ATS quota'},{field:'shareLimit',label:'Share quota'}] as const).map(x=><label key={x.field} className="text-xs text-slate-400">{x.label}<input type="number" min="0" max="1000" value={t[x.field] ?? 0} onChange={e=>setTemplate(i,x.field,Math.max(0,Math.min(1000,Math.floor(Number(e.target.value)||0))))} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"/></label>)}
      {([{field:'enabled',label:'Available'},{field:'free',label:'Free design'},{field:'pdfExportEnabled',label:'PDF enabled'},{field:'atsExportEnabled',label:'ATS enabled'},{field:'shareEnabled',label:'Sharing enabled'}] as const).map(x=><label key={x.field} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={t[x.field] === true} onChange={e=>setTemplate(i,x.field,e.target.checked)}/>{x.label}</label>)}</div>)}
    </section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">Individual CV packages</h3><p className="text-xs text-slate-400">One-time package pricing, validity and independent quotas.</p></div><button onClick={()=>setCv('packages',[...(cv.packages || []),{id:'cv-package-'+Date.now(),name:'New CV Package',enabled:true,pricePkr:100,durationDays:30,cvCreateLimit:1,editLimit:10,pdfExportLimit:3,atsExportLimit:3,shareLimit:3,noWatermark:false}])} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300"><Plus className="mr-1 inline h-4 w-4"/>Add package</button></div>
      {(cv.packages || []).map((p:any,i:number)=><div key={p.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-slate-400">Package name<input maxLength={80} value={p.name} onChange={e=>setPackage(i,'name',e.target.value)} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"/></label>{([{field:'pricePkr',label:'Price PKR',max:10000000},{field:'durationDays',label:'Validity days',max:3650},{field:'cvCreateLimit',label:'CV creations',max:1000},{field:'editLimit',label:'Edits',max:1000},{field:'pdfExportLimit',label:'PDF exports',max:1000},{field:'atsExportLimit',label:'ATS exports',max:1000},{field:'shareLimit',label:'Shares',max:1000}] as const).map(x=><label key={x.field} className="text-xs text-slate-400">{x.label}<input type="number" min={x.field==='durationDays'?1:0} max={x.max} value={p[x.field] ?? 0} onChange={e=>setPackage(i,x.field,Math.max(x.field==='durationDays'?1:0,Math.min(x.max,Math.floor(Number(e.target.value)||0))))} className="mt-1 w-full rounded bg-slate-900 p-2 text-white"/></label>)}<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.enabled !== false} onChange={e=>setPackage(i,'enabled',e.target.checked)}/>Available for purchase</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.noWatermark === true} onChange={e=>setPackage(i,'noWatermark',e.target.checked)}/>No watermark</label><button onClick={()=>setCv('packages',cv.packages.filter((_:any,j:number)=>j!==i))} className="text-left text-xs text-rose-300"><Trash2 className="mr-1 inline h-4 w-4"/>Remove</button></div>)}
    </section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4"><h3 className="font-bold">Subscription package CV benefits</h3><p className="text-xs text-slate-400">Optional CV quota grants attached to each existing subscription. Benefit description is included in the package snapshot.</p>
      {pricing.subscriptionPackages.map((p:any,i:number)=><div key={p.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-2 lg:grid-cols-4"><div className="text-sm font-bold">{p.name}</div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.cvBenefitsEnabled === true} onChange={e=>setSubscription(i,'cvBenefitsEnabled',e.target.checked)}/>Include CV benefits</label><label className="text-xs text-slate-400 sm:col-span-2">Benefits shown to candidates<input maxLength={240} value={p.cvBenefitsDescription || ''} onChange={e=>setSubscription(i,'cvBenefitsDescription',e.target.value)} className="mt-1 w-full rounded bg-slate-900 p-2 text-white" placeholder="e.g. Includes 2 CVs, 5 edits and 2 PDF exports"/></label>
      {([{field:'cvCreateLimit',label:'CV creations'},{field:'editLimit',label:'Edits'},{field:'pdfExportLimit',label:'PDF exports'},{field:'atsExportLimit',label:'ATS exports'},{field:'shareLimit',label:'Shares'}] as const).map(x=><label key={x.field} className="text-xs text-slate-400">{x.label}<input type="number" min="0" max="1000" disabled={p.cvBenefitsEnabled !== true} value={p.cvBenefits?.[x.field] ?? 0} onChange={e=>setSubscription(i,'cvBenefits',{...(p.cvBenefits || {}),[x.field]:Math.max(0,Math.min(1000,Math.floor(Number(e.target.value)||0)))})} className="mt-1 w-full rounded bg-slate-900 p-2 text-white disabled:opacity-40"/></label>)}<label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={p.cvBenefitsEnabled !== true} checked={p.cvBenefits?.noWatermark === true} onChange={e=>setSubscription(i,'cvBenefits',{...(p.cvBenefits || {}),noWatermark:e.target.checked})}/>No export watermark</label></div>)}
    </section>
    <div className="flex justify-end"><button disabled={saving} onClick={save} className="rounded-xl bg-emerald-500 px-6 py-3 font-black text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Save all CV settings'}</button></div>
  </div>;
};
