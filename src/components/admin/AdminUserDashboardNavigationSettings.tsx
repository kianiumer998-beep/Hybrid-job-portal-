import React, { useEffect, useMemo, useState } from 'react';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Eye, Settings2, Smartphone, Monitor } from 'lucide-react';
import { api } from '../../services/api';

type MenuMode = 'classic' | 'professional' | 'new' | 'classic-new';
type QuickAction = { id: string; label: string; icon: string; destination: string; enabled: boolean; mobile: boolean; desktop: boolean };
type Config = { enabledModes: MenuMode[]; defaultMode: MenuMode; allowModeSwitching: boolean; quickActions: QuickAction[] };

const DEFAULT_CONFIG: Config = {
  enabledModes: ['classic', 'professional', 'new', 'classic-new'],
  defaultMode: 'professional',
  allowModeSwitching: true,
  quickActions: [
    { id: 'dash-overview', label: 'Home', icon: 'LayoutDashboard', destination: '/dashboard', enabled: true, mobile: true, desktop: false },
    { id: 'jobs-explore', label: 'Jobs', icon: 'Search', destination: '/jobs', enabled: true, mobile: true, desktop: false },
    { id: 'career-cv', label: 'CV', icon: 'FileText', destination: '/cv', enabled: true, mobile: true, desktop: false },
    { id: 'mem-whatsapp', label: 'Alerts', icon: 'Bell', destination: '/alerts', enabled: true, mobile: true, desktop: false },
    { id: 'acc-profile', label: 'Account', icon: 'User', destination: '/dashboard/profile', enabled: true, mobile: true, desktop: false }
  ]
};

const DESTINATIONS = [
  ['dash-overview','Dashboard Overview','/dashboard'],['jobs-recommended','Recommended Jobs','/dashboard/recommendations'],
  ['jobs-explore','Explore All Jobs','/jobs'],['jobs-applications','My Applications','/dashboard/applications'],
  ['jobs-saved','Saved Jobs','/dashboard/saved-jobs'],['jobs-alerts','Job Alerts','/dashboard/job-alerts'],
  ['career-cv','CV Builder','/cv'],['career-docs','My Documents','/dashboard/documents'],
  ['emp-post','Post a Job','/dashboard/post-job'],['emp-listings','My Job Listings','/dashboard/my-jobs'],
  ['emp-verification','Business Verification','/dashboard/verification'],['ads-list','My Campaigns','/dashboard/campaigns'],
  ['ads-create','Create Campaign','/dashboard/campaigns/create'],['mem-wallet','Wallet & Balance','/dashboard/wallet'],
  ['membership-plan','Membership & Plans','/dashboard/membership'],['wallet-deposit','Add Funds / Deposit','/dashboard/deposit'],
  ['mem-history','Payment History','/dashboard/payment-history'],['mem-whatsapp','WhatsApp & Job Alerts','/alerts'],
  ['notifications-center','Notifications Center','/dashboard/notifications'],['acc-chat','Support Inbox','/dashboard/support'],
  ['acc-profile','Profile & Preferences','/dashboard/profile'],['acc-security','Security & Password','/dashboard/security']
] as const;

export const AdminUserDashboardNavigationSettings: React.FC = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [newDestination, setNewDestination] = useState<string>(DESTINATIONS[0][0]);

  useEffect(() => {
    let mounted = true;
    api.settings.getUserDashboardNavigation().then((result: any) => {
      if (mounted && result?.success && result.config) setConfig({ ...DEFAULT_CONFIG, ...result.config });
    }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const selectedIds = useMemo(() => new Set(config.quickActions.map(item => item.id)), [config.quickActions]);
  const updateAction = (index: number, patch: Partial<QuickAction>) => setConfig(prev => ({
    ...prev, quickActions: prev.quickActions.map((item, i) => i === index ? { ...item, ...patch } : item)
  }));
  const moveAction = (index: number, direction: -1 | 1) => setConfig(prev => {
    const next = [...prev.quickActions], target = index + direction;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...prev, quickActions: next };
  });
  const addAction = () => {
    const def = DESTINATIONS.find(item => item[0] === newDestination);
    if (!def || selectedIds.has(def[0]) || config.quickActions.length >= 5) return;
    setConfig(prev => ({ ...prev, quickActions: [...prev.quickActions, {
      id: def[0], label: def[1], icon: 'LayoutDashboard', destination: def[2], enabled: true, mobile: true, desktop: false
    }] }));
  };
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const result: any = await api.settings.updateUserDashboardNavigation(config);
      if (result?.success && result.config) {
        setConfig({ ...DEFAULT_CONFIG, ...result.config });
        setMessage('Settings successfully saved to server.');
      } else setMessage(result?.message || 'Save failed. Existing saved settings were not changed.');
    } catch { setMessage('Unable to save settings. Please try again.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">Loading user dashboard settings…</div>;

  return <section className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-3 sm:p-5 space-y-4">
    <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-emerald-400"/><div><h3 className="text-sm font-black text-white">User Dashboard — Navigation & Quick Actions</h3><p className="text-[11px] text-slate-400">Manage menu styles and the fixed quick-action bar.</p></div></div>
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
      <h4 className="text-xs font-bold text-emerald-300">Menu Style Control</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['classic','professional','new','classic-new'] as MenuMode[]).map(mode => <label key={mode} className="flex items-center gap-2 rounded-lg border border-slate-800 p-2 text-[11px] text-slate-200">
          <input type="checkbox" checked={config.enabledModes.includes(mode)} onChange={e => setConfig(prev => {
            const enabledModes = e.target.checked ? [...prev.enabledModes, mode] : prev.enabledModes.filter(x => x !== mode);
            if (!enabledModes.length) return prev;
            return { ...prev, enabledModes, defaultMode: enabledModes.includes(prev.defaultMode) ? prev.defaultMode : enabledModes[0] };
          })}/>{mode === 'classic' ? 'Classic' : mode === 'professional' ? 'Professional' : mode === 'new' ? 'New Menu' : 'Classic New'}
        </label>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="space-y-1 text-slate-300">Default menu<select className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" value={config.defaultMode} onChange={e => setConfig(p => ({...p, defaultMode:e.target.value as MenuMode}))}>{config.enabledModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}</select></label>
        <label className="flex items-center gap-2 self-end text-slate-300"><input type="checkbox" checked={config.allowModeSwitching} onChange={e => setConfig(p => ({...p, allowModeSwitching:e.target.checked}))}/> Allow users to switch enabled menu styles</label>
      </div>
      <p className="text-[10px] text-slate-500">When only one style is enabled, users will use it directly without a style comparison switcher.</p>
    </div>
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-bold text-emerald-300">Quick Actions Manager</h4><span className="text-[10px] text-slate-500">{config.quickActions.length}/5</span></div>
      <div className="flex flex-col sm:flex-row gap-2"><select value={newDestination} onChange={e => setNewDestination(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white">{DESTINATIONS.filter(item => !selectedIds.has(item[0])).map(item => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</select><button type="button" onClick={addAction} disabled={config.quickActions.length>=5 || selectedIds.has(newDestination)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"><Plus className="h-3.5 w-3.5"/> Add Destination</button></div>
      {config.quickActions.map((item,index) => <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-white">{index+1}. {item.id}</span><div className="flex gap-1"><button type="button" title="Move up" onClick={()=>moveAction(index,-1)} disabled={index===0} className="rounded p-1 text-slate-300 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5"/></button><button type="button" title="Move down" onClick={()=>moveAction(index,1)} disabled={index===config.quickActions.length-1} className="rounded p-1 text-slate-300 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5"/></button><button type="button" title="Remove" onClick={()=>setConfig(p=>({...p,quickActions:p.quickActions.filter((_,i)=>i!==index)}))} className="rounded p-1 text-rose-400"><Trash2 className="h-3.5 w-3.5"/></button></div></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><label className="text-[10px] text-slate-400">Display label<input maxLength={24} value={item.label} onChange={e=>updateAction(index,{label:e.target.value})} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white"/></label><label className="text-[10px] text-slate-400">Icon<select value={item.icon} onChange={e=>updateAction(index,{icon:e.target.value})} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white">{['LayoutDashboard','Search','Building2','Megaphone','User','FileText','Sparkles','History','Bookmark','Plus','Wallet','Crown','ShieldCheck','Bell','Lock','MessageSquare','Zap'].map(icon=><option key={icon}>{icon}</option>)}</select></label><label className="text-[10px] text-slate-400">Landing address / route<input maxLength={160} value={item.destination} onChange={e=>updateAction(index,{destination:e.target.value})} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white"/></label></div>
        <div className="text-[10px]">{item.destination.startsWith('/') && !item.destination.startsWith('//') ? <a href={item.destination} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">Preview address in new tab</a> : <span className="text-amber-300">Enter a valid internal address to preview</span>}</div>
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-300"><label className="flex items-center gap-1"><input type="checkbox" checked={item.enabled} onChange={e=>updateAction(index,{enabled:e.target.checked})}/> Enabled</label><label className="flex items-center gap-1"><Smartphone className="h-3 w-3"/><input type="checkbox" checked={item.mobile} onChange={e=>updateAction(index,{mobile:e.target.checked})}/> Mobile</label><label className="flex items-center gap-1"><Monitor className="h-3 w-3"/><input type="checkbox" checked={item.desktop} onChange={e=>updateAction(index,{desktop:e.target.checked})}/> Desktop</label><span className="flex items-center gap-1 text-slate-500"><Eye className="h-3 w-3"/> ID maps to existing authorized dashboard action</span></div>
      </div>)}
      <p className="text-[10px] text-amber-300/80">Address preview/reference is an internal path. The actual dashboard action is resolved by its existing menu destination ID and permission checks; editing a path cannot grant access to another page.</p>
    </div>
    {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
    <div className="flex justify-end"><button type="button" onClick={save} disabled={saving || !config.enabledModes.length} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Saving…':'Save Navigation Settings'}</button></div>
  </section>;
};
