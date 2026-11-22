import React, { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Check, Save, Trash2 } from 'lucide-react';

type FilterValue = string | boolean;
type FilterPreset = { id: string; name: string; filters: Record<string, FilterValue>; updatedAt: string };

interface AdminJobFilterPresetsProps {
  storageKey: string;
  filters: Record<string, FilterValue>;
  onApply: (filters: Record<string, FilterValue>) => void;
}

/** Browser-local, scope-isolated saved filter presets. Stores filter values only (no job/user records). */
export const AdminJobFilterPresets: React.FC<AdminJobFilterPresetsProps> = ({ storageKey, filters, onApply }) => {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) { setPresets([]); return; }
      const parsed: unknown = JSON.parse(raw);
      const safe = Array.isArray(parsed) ? parsed.filter((item: any) =>
        item && typeof item.id === 'string' && typeof item.name === 'string' &&
        item.filters && typeof item.filters === 'object' && !Array.isArray(item.filters) &&
        Object.values(item.filters).every(value => typeof value === 'string' || typeof value === 'boolean')
      ).slice(0, 12) as FilterPreset[] : [];
      setPresets(safe);
    } catch {
      setPresets([]);
      setNotice('Saved presets could not be read from this browser.');
    }
  }, [storageKey]);

  const selectedPreset = useMemo(() => presets.find(item => item.id === selectedId), [presets, selectedId]);

  const persist = (next: FilterPreset[]) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setPresets(next);
      setNotice('');
      return true;
    } catch {
      setNotice('Could not save preset. Browser storage may be full or unavailable.');
      return false;
    }
  };

  const handleSave = () => {
    const name = presetName.trim().slice(0, 40);
    if (!name) { setNotice('Enter a name for this preset.'); return; }
    const now = new Date().toISOString();
    const existing = presets.find(item => item.name.toLowerCase() === name.toLowerCase());
    const nextPreset: FilterPreset = {
      id: existing?.id || `preset-${Date.now().toString(36)}`,
      name,
      filters: { ...filters },
      updatedAt: now
    };
    const next = existing
      ? presets.map(item => item.id === existing.id ? nextPreset : item)
      : [...presets, nextPreset].slice(-12);
    if (persist(next)) {
      setSelectedId(nextPreset.id);
      setPresetName('');
      setNotice(existing ? 'Preset updated.' : 'Preset saved on this device.');
    }
  };

  const handleDelete = () => {
    if (!selectedPreset) return;
    const next = presets.filter(item => item.id !== selectedPreset.id);
    if (persist(next)) {
      setSelectedId('');
      setNotice('Preset deleted from this device.');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-2.5" aria-label="Saved filter presets">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-200">
        <BookmarkPlus className="h-3.5 w-3.5" />
        <span>Saved Filter Presets</span>
      </div>
      <input
        value={presetName}
        onChange={event => setPresetName(event.target.value.slice(0, 40))}
        onKeyDown={event => { if (event.key === 'Enter') handleSave(); }}
        maxLength={40}
        placeholder="Name current filters"
        aria-label="New filter preset name"
        className="min-w-[145px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white placeholder:text-slate-500"
      />
      <button type="button" onClick={handleSave} className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-2.5 py-2 text-xs font-bold text-indigo-100 hover:bg-indigo-600/40">
        <Save className="h-3.5 w-3.5" /> Save
      </button>
      <select value={selectedId} onChange={event => setSelectedId(event.target.value)} aria-label="Choose saved filter preset" className="min-w-[150px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white">
        <option value="">Choose saved preset ({presets.length})</option>
        {presets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <button type="button" disabled={!selectedPreset} onClick={() => selectedPreset && onApply({ ...selectedPreset.filters })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-600/40 disabled:cursor-not-allowed disabled:opacity-40">
        <Check className="h-3.5 w-3.5" /> Apply
      </button>
      <button type="button" disabled={!selectedPreset} onClick={handleDelete} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-600/10 px-2.5 py-2 text-xs font-bold text-rose-200 hover:bg-rose-600/20 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Delete selected filter preset">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {notice && <span role="status" className="w-full text-[10px] text-slate-400">{notice}</span>}
    </div>
  );
};
