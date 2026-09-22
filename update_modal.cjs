const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminQuickEditJobModal.tsx', 'utf8');

const anchor = `<div className="space-y-1">
                <label className="font-bold text-slate-300">City / Location</label>`;

const additions = `
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Country</label>
                <input
                  type="text"
                  value={formData.country || ''}
                  onChange={(e) => setFormData(p => ({ ...p, country: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Region</label>
                <input
                  type="text"
                  value={formData.region || ''}
                  onChange={(e) => setFormData(p => ({ ...p, region: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-300">District</label>
                <input
                  type="text"
                  value={formData.district || ''}
                  onChange={(e) => setFormData(p => ({ ...p, district: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Currency</label>
                <input
                  type="text"
                  value={formData.currency || ''}
                  onChange={(e) => setFormData(p => ({ ...p, currency: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Experience Level</label>
                <input
                  type="text"
                  value={formData.experienceLevel || ''}
                  onChange={(e) => setFormData(p => ({ ...p, experienceLevel: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Department</label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Posted At</label>
                <input
                  type="date"
                  value={formData.postedAt || ''}
                  onChange={(e) => setFormData(p => ({ ...p, postedAt: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-300">Requirements (one per line)</label>
                <textarea
                  rows={3}
                  value={formData.requirements?.join('\n') || ''}
                  onChange={(e) => setFormData(p => ({ ...p, requirements: e.target.value.split('\n').filter(Boolean) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-300">Responsibilities (one per line)</label>
                <textarea
                  rows={3}
                  value={formData.responsibilities?.join('\n') || ''}
                  onChange={(e) => setFormData(p => ({ ...p, responsibilities: e.target.value.split('\n').filter(Boolean) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-300">Benefits (one per line)</label>
                <textarea
                  rows={3}
                  value={formData.benefits?.join('\n') || ''}
                  onChange={(e) => setFormData(p => ({ ...p, benefits: e.target.value.split('\n').filter(Boolean) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 outline-none"
                />
              </div>
`;

content = content.replace(anchor, additions + anchor);

// Fix the province and jobType fallbacks that use "Punjab" and "On-site" literally.
content = content.replace(
  /value=\{formData\.province \|\| 'Punjab'\}/g,
  "value={formData.province || ''}"
);
content = content.replace(
  /value=\{formData\.jobType \|\| 'On-site'\}/g,
  "value={formData.jobType || ''}"
);

// We should also add an empty option to jobType so it can be unselected.
content = content.replace(
  /<select\s*value=\{formData\.jobType \|\| ''\}\s*onChange=\{\(e\) => setFormData\(p => \(\{ \.\.\.p, jobType: e\.target\.value as JobType \}\)\)\}\s*className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"\s*>/,
  `<select
                  value={formData.jobType || ''}
                  onChange={(e) => setFormData(p => ({ ...p, jobType: e.target.value as JobType }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"
                >
                  <option value="">Select Job Type...</option>`
);

// Add empty option to province
content = content.replace(
  /<select\s*value=\{formData\.province \|\| ''\}\s*onChange=\{\(e\) => setFormData\(p => \(\{ \.\.\.p, province: e\.target\.value \}\)\)\}\s*className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"\s*>/,
  `<select
                  value={formData.province || ''}
                  onChange={(e) => setFormData(p => ({ ...p, province: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-400 outline-none"
                >
                  <option value="">Select Province...</option>`
);


fs.writeFileSync('src/components/admin/AdminQuickEditJobModal.tsx', content);
console.log("Updated modal inputs");
