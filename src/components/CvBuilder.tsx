import React, { useEffect, useState } from 'react';
import { CvData } from '../types/job';
import { Sparkles, Printer, Download, Plus, Trash2, CheckCircle2, FileText, ChevronRight, ChevronLeft, Palette, User, Briefcase, GraduationCap, Award, Eye } from 'lucide-react';

interface CvBuilderProps {
  isSubscribed: boolean;
  initialCvData?: CvData;
  onSaveCv: (data: CvData) => Promise<boolean> | boolean;
  onOpenPaywall: () => void;
}

const createBlankCvData = (): CvData => ({
  personalInfo: {
    fullName: '',
    jobTitle: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    linkedin: '',
    github: '',
    summary: ''
  },
  experience: [],
  education: [],
  skills: { technical: [], soft: [], languages: [] },
  certifications: [],
  templateStyle: 'modern',
  themeColor: '#10b981'
});

const normalizeCvData = (value?: CvData): CvData => {
  const blank = createBlankCvData();
  const raw = value && typeof value === 'object' ? value : blank;
  const validStyles = ['modern', 'executive', 'tech', 'classic'];
  return {
    ...(typeof raw.photoBase64 === 'string' ? { photoBase64: raw.photoBase64 } : {}),
    personalInfo: { ...blank.personalInfo, ...(raw.personalInfo || {}) },
    experience: Array.isArray(raw.experience) ? raw.experience.map((item, index) => ({
      id: String(item?.id || `exp-${index + 1}`),
      company: String(item?.company || ''),
      position: String(item?.position || ''),
      location: String(item?.location || ''),
      startDate: String(item?.startDate || ''),
      endDate: String(item?.endDate || ''),
      current: Boolean(item?.current),
      bullets: Array.isArray(item?.bullets) ? item.bullets.filter((bullet) => typeof bullet === 'string') : []
    })) : [],
    education: Array.isArray(raw.education) ? raw.education.map((item, index) => ({
      id: String(item?.id || `edu-${index + 1}`),
      institution: String(item?.institution || ''),
      degree: String(item?.degree || ''),
      fieldOfStudy: String(item?.fieldOfStudy || ''),
      startDate: String(item?.startDate || ''),
      endDate: String(item?.endDate || ''),
      ...(typeof item?.gpa === 'string' ? { gpa: item.gpa } : {})
    })) : [],
    skills: {
      technical: Array.isArray(raw.skills?.technical) ? raw.skills.technical.filter((item) => typeof item === 'string') : [],
      soft: Array.isArray(raw.skills?.soft) ? raw.skills.soft.filter((item) => typeof item === 'string') : [],
      languages: Array.isArray(raw.skills?.languages) ? raw.skills.languages.filter((item) => typeof item === 'string') : []
    },
    certifications: Array.isArray(raw.certifications) ? raw.certifications.map((item, index) => ({
      id: String(item?.id || `cert-${index + 1}`),
      name: String(item?.name || ''),
      issuer: String(item?.issuer || ''),
      year: String(item?.year || '')
    })) : [],
    templateStyle: validStyles.includes(raw.templateStyle) ? raw.templateStyle : blank.templateStyle,
    themeColor: typeof raw.themeColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.themeColor) ? raw.themeColor : blank.themeColor
  };
};

export const CvBuilder: React.FC<CvBuilderProps> = ({ isSubscribed, initialCvData, onSaveCv, onOpenPaywall }) => {
  const [step, setStep] = useState<number>(1);
  const [isSavingCv, setIsSavingCv] = useState(false);
  const [cvSaveMessage, setCvSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cvData, setCvData] = useState<CvData>(() => normalizeCvData(initialCvData));

  // Always reset to the current account's saved CV (or a blank draft) when the account data changes.
  useEffect(() => {
    setCvData(normalizeCvData(initialCvData));
    setCvSaveMessage(null);
  }, [initialCvData]);

  // Add an empty achievement line for the user to complete; no simulated AI output is presented as generated content.
  const handleGenerateAiBullets = (expIndex: number) => {
    const updated = [...cvData.experience];
    if (!updated[expIndex]) return;
    updated[expIndex] = {
      ...updated[expIndex],
      bullets: [...(updated[expIndex].bullets || []), '']
    };
    setCvData({ ...cvData, experience: updated });
  };

  // Add Experience
  const handleAddExperience = () => {
    setCvData({
      ...cvData,
      experience: [
        ...cvData.experience,
        {
          id: 'exp-' + Date.now(),
          company: '',
          position: '',
          location: '',
          startDate: '',
          endDate: '',
          current: false,
          bullets: []
        }
      ]
    });
  };

  // Remove Experience
  const handleRemoveExperience = (id: string) => {
    setCvData({
      ...cvData,
      experience: cvData.experience.filter((e) => e.id !== id)
    });
  };

  const handleAddEducation = () => {
    setCvData({
      ...cvData,
      education: [...cvData.education, {
        id: `edu-${Date.now()}`,
        institution: '',
        degree: '',
        fieldOfStudy: '',
        startDate: '',
        endDate: '',
        gpa: ''
      }]
    });
  };

  const handleRemoveEducation = (id: string) => {
    setCvData({ ...cvData, education: cvData.education.filter((item) => item.id !== id) });
  };

  const handleAddCertification = () => {
    setCvData({
      ...cvData,
      certifications: [...cvData.certifications, {
        id: `cert-${Date.now()}`,
        name: '',
        issuer: '',
        year: ''
      }]
    });
  };

  const handleRemoveCertification = (id: string) => {
    setCvData({ ...cvData, certifications: cvData.certifications.filter((item) => item.id !== id) });
  };

  const handleSaveCv = async () => {
    if (isSavingCv) return;
    setIsSavingCv(true);
    setCvSaveMessage(null);
    try {
      const saved = await onSaveCv(cvData);
      setCvSaveMessage(saved
        ? { type: 'success', text: 'Your CV draft has been saved to your account.' }
        : { type: 'error', text: 'The CV could not be saved. Please try again.' });
    } catch (error: any) {
      setCvSaveMessage({ type: 'error', text: error?.message || 'Unable to save your CV right now.' });
    } finally {
      setIsSavingCv(false);
    }
  };

  // Trigger Print Engine
  const handleDownloadPdf = () => {
    if (!isSubscribed) {
      onOpenPaywall();
    } else {
      window.print();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {cvSaveMessage && <div className={`mb-4 rounded-xl border px-4 py-3 text-xs ${cvSaveMessage.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`} role="status">{cvSaveMessage.text}</div>}
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-2xl p-6 mb-8 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Automated ATS Resume Builder Engine</span>
          </div>
          <h2 className="text-2xl font-black">Build a Professional Resume in 3 Minutes</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Fill in your details, choose an ATS-friendly layout, add achievement points, save your CV to your account, and export a PDF for job applications.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSaveCv}
            disabled={isSavingCv}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-black text-sm flex items-center space-x-2 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{isSavingCv ? 'Saving...' : 'Save CV Draft'}</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center space-x-2 hover:scale-105 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>{isSubscribed ? 'Export PDF Resume' : 'Download Premium PDF'}</span>
          </button>
        </div>
      </div>

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          
          {/* Step Indicator Tabs */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 overflow-x-auto text-xs font-bold space-x-2">
            {[
              { id: 1, label: 'Personal Info', icon: User },
              { id: 2, label: 'Experience', icon: Briefcase },
              { id: 3, label: 'Education', icon: GraduationCap },
              { id: 4, label: 'Skills & Style', icon: Palette }
            ].map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    step === s.id
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* STEP 1: PERSONAL INFO */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <User className="w-4 h-4 text-emerald-400" />
                <span>Personal & Contact Information</span>
              </h3>

              {/* Profile Photo Upload Field with Base64 FileReader */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Profile Picture (Optional Corporate Headshot)
                </label>
                <div className="flex items-center space-x-4">
                  {cvData.photoBase64 ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md">
                      <img src={cvData.photoBase64} alt="Profile Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCvData({ ...cvData, photoBase64: undefined })}
                        className="absolute top-0 right-0 bg-rose-500 text-white p-0.5 rounded-bl text-[10px]"
                        title="Remove Photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-xs font-bold">
                      No Photo
                    </div>
                  )}

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      id="cv-photo-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                          setCvSaveMessage({ type: 'error', text: 'Please select a PNG, JPEG, or WebP image.' });
                          e.target.value = '';
                          return;
                        }
                        if (file.size > 250 * 1024) {
                          setCvSaveMessage({ type: 'error', text: 'Profile photo must be 250 KB or smaller to save with your CV.' });
                          e.target.value = '';
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (typeof reader.result === 'string') {
                            setCvData({ ...cvData, photoBase64: reader.result });
                            setCvSaveMessage(null);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="cv-photo-input"
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-bold inline-block cursor-pointer"
                    >
                      Upload Headshot Photo
                    </label>
                    <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, or WebP · maximum 250 KB</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.fullName}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, fullName: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Professional Job Title</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.jobTitle}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, jobTitle: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={cvData.personalInfo.email}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, email: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.phone}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, phone: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Location / Country</label>
                <input
                  type="text"
                  value={cvData.personalInfo.location}
                  onChange={(e) =>
                    setCvData({
                      ...cvData,
                      personalInfo: { ...cvData.personalInfo, location: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Professional Summary</label>
                <textarea
                  rows={4}
                  value={cvData.personalInfo.summary}
                  onChange={(e) =>
                    setCvData({
                      ...cvData,
                      personalInfo: { ...cvData.personalInfo, summary: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2: EXPERIENCE */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-indigo-400" />
                  <span>Work Experience</span>
                </h3>
                <button
                  onClick={handleAddExperience}
                  className="text-xs px-2.5 py-1.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-lg border border-emerald-500/30 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Role</span>
                </button>
              </div>

              {cvData.experience.map((exp, idx) => (
                <div key={exp.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 relative">
                  <button
                    onClick={() => handleRemoveExperience(exp.id)}
                    className="absolute top-3 right-3 text-slate-500 hover:text-rose-400"
                    title="Delete Role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400">Company</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => {
                          const updated = [...cvData.experience];
                          updated[idx].company = e.target.value;
                          setCvData({ ...cvData, experience: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400">Position</label>
                      <input
                        type="text"
                        value={exp.position}
                        onChange={(e) => {
                          const updated = [...cvData.experience];
                          updated[idx].position = e.target.value;
                          setCvData({ ...cvData, experience: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-400">Key Achievements / Bullets</label>
                      <button
                        type="button"
                        onClick={() => handleGenerateAiBullets(idx)}
                        className="text-[10px] text-amber-400 hover:underline font-bold flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Add Achievement Line</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={exp.bullets.join('\n')}
                      onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx].bullets = e.target.value.split('\n');
                        setCvData({ ...cvData, experience: updated });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 3: EDUCATION & CERTIFICATIONS */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  <span>Education & Qualifications</span>
                </h3>
                <button type="button" onClick={handleAddEducation} className="text-xs px-2.5 py-1.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Education
                </button>
              </div>

              {cvData.education.length === 0 && <p className="text-xs text-slate-500">No education entries added yet.</p>}
              {cvData.education.map((edu, idx) => (
                <div key={edu.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Education {idx + 1}</span>
                    <button type="button" onClick={() => handleRemoveEducation(edu.id)} aria-label={`Remove education ${idx + 1}`} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([
                      ['institution', 'Institution / University'],
                      ['degree', 'Degree'],
                      ['fieldOfStudy', 'Field of Study'],
                      ['startDate', 'Start Date'],
                      ['endDate', 'End Date'],
                      ['gpa', 'Grade / GPA']
                    ] as const).map(([field, label]) => (
                      <label key={field} className="block text-[11px] font-semibold text-slate-400">
                        {label}
                        <input type="text" value={edu[field] || ''} onChange={(e) => {
                          const updated = [...cvData.education];
                          updated[idx] = { ...updated[idx], [field]: e.target.value };
                          setCvData({ ...cvData, education: updated });
                        }} className="mt-1 w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2"><Award className="w-4 h-4 text-amber-400" /> Certifications</h3>
                <button type="button" onClick={handleAddCertification} className="text-xs px-2.5 py-1.5 bg-indigo-500/20 text-indigo-300 font-bold rounded-lg border border-indigo-500/30 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Certification
                </button>
              </div>
              {cvData.certifications.length === 0 && <p className="text-xs text-slate-500">No certifications added yet.</p>}
              {cvData.certifications.map((cert, idx) => (
                <div key={cert.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Certification {idx + 1}</span>
                    <button type="button" onClick={() => handleRemoveCertification(cert.id)} aria-label={`Remove certification ${idx + 1}`} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {([
                      ['name', 'Certification'],
                      ['issuer', 'Issuing Organization'],
                      ['year', 'Year']
                    ] as const).map(([field, label]) => (
                      <label key={field} className="block text-[11px] font-semibold text-slate-400">
                        {label}
                        <input type="text" value={cert[field]} onChange={(e) => {
                          const updated = [...cvData.certifications];
                          updated[idx] = { ...updated[idx], [field]: e.target.value };
                          setCvData({ ...cvData, certifications: updated });
                        }} className="mt-1 w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 4: SKILLS & TEMPLATE STYLE */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Palette className="w-4 h-4 text-teal-400" />
                <span>Skills & Template Theme</span>
              </h3>

              {([
                ['technical', 'Technical Skills'],
                ['soft', 'Soft Skills'],
                ['languages', 'Languages']
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{label} (comma separated)</label>
                  <textarea rows={2} value={cvData.skills[field].join(', ')} onChange={(e) => setCvData({
                    ...cvData,
                    skills: { ...cvData.skills, [field]: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }
                  })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Select Template Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'modern', name: 'Modern Clean' },
                    { id: 'executive', name: 'Executive Dark Sidebar' },
                    { id: 'tech', name: 'Tech Minimalist' },
                    { id: 'classic', name: 'Classic Corporate' }
                  ].map((t) => (
                    <button type="button" key={t.id} onClick={() => setCvData({ ...cvData, templateStyle: t.id as CvData['templateStyle'] })} className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${cvData.templateStyle === t.id ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
                Accent Color
                <input type="color" value={cvData.themeColor} onChange={(e) => setCvData({ ...cvData, themeColor: e.target.value })} className="h-9 w-14 rounded border border-slate-700 bg-slate-900 cursor-pointer" aria-label="CV accent color" />
              </label>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Step</span>
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center space-x-1"
              >
                <span>Next Step</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleDownloadPdf}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black flex items-center space-x-1"
              >
                <Printer className="w-4 h-4" />
                <span>Generate & Download</span>
              </button>
            )}
          </div>

        </div>

        {/* Right Column: Interactive Live Preview Pane */}
        <div className="lg:col-span-6 sticky top-24">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-bold border-b border-slate-800 pb-2">
              <span className="flex items-center space-x-1 text-emerald-400">
                <Eye className="w-4 h-4" />
                <span>Live Interactive ATS CV Preview</span>
              </span>
              <span className="uppercase text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                {cvData.templateStyle} Layout
              </span>
            </div>

            {/* Simulated Paper Layout Container */}
            <div
              id="cv-print-area"
              className="bg-white text-slate-900 p-6 rounded-lg shadow-inner min-h-[580px] text-xs font-sans space-y-4"
            >
              {/* CV Header */}
              <div className="border-b-2 border-emerald-600 pb-3 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {cvData.personalInfo.fullName || 'Your Full Name'}
                  </h1>
                  <p className="text-emerald-700 font-bold text-xs mt-0.5">
                    {cvData.personalInfo.jobTitle || 'Your Job Title'}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 mt-2 font-medium">
                    <span>{cvData.personalInfo.phone}</span>
                    <span>•</span>
                    <span>{cvData.personalInfo.email}</span>
                    <span>•</span>
                    <span>{cvData.personalInfo.location}</span>
                  </div>
                </div>

                {cvData.photoBase64 && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-300 shadow-sm flex-shrink-0">
                    <img src={cvData.photoBase64} alt="Candidate Profile" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Summary */}
              {cvData.personalInfo.summary && (
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-1 text-emerald-800">
                    Professional Summary
                  </h3>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    {cvData.personalInfo.summary}
                  </p>
                </div>
              )}

              {/* Experience */}
              {cvData.experience.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-2 text-emerald-800">
                    Work Experience
                  </h3>
                  <div className="space-y-2">
                    {cvData.experience.map((exp) => (
                      <div key={exp.id}>
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{exp.position} — <span className="text-emerald-700">{exp.company}</span></span>
                          <span className="text-[10px] text-slate-500">{exp.startDate} - {exp.endDate}</span>
                        </div>
                        <ul className="list-disc list-inside text-slate-700 text-[10px] space-y-0.5 mt-1">
                          {exp.bullets.map((b, i) => b.trim() && <li key={i}>{b}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {cvData.education.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-1 text-emerald-800">
                    Education
                  </h3>
                  {cvData.education.map((edu) => (
                    <div key={edu.id} className="flex justify-between text-[11px]">
                      <span className="font-bold text-slate-900">{edu.degree} in {edu.fieldOfStudy} - {edu.institution}</span>
                      <span className="text-slate-500">{edu.startDate} - {edu.endDate}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills */}
              {cvData.skills.technical.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-1 text-emerald-800">
                    Key Technical Skills
                  </h3>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {cvData.skills.technical.map((sk, i) => (
                      <span key={i} className="bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
