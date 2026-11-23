import React, { useEffect, useState } from 'react';
import { CvData, CvDocument, CvDesignEntitlement } from '../types/job';
import { Sparkles, Printer, Download, Plus, Trash2, CheckCircle2, FileText, ChevronRight, ChevronLeft, Palette, User, Briefcase, GraduationCap, Award, Eye } from 'lucide-react';

interface CvBuilderProps {
  isSubscribed: boolean;
  initialCvData?: CvData;
  initialCvDocuments?: CvDocument[];
  cvDesignEntitlements?: CvDesignEntitlement[];
  onPurchaseTemplate: (templateId: string, templateName: string, pricePkr: number) => void;
  onSaveCvDocuments?: (documents: CvDocument[], activeData: CvData) => Promise<boolean> | boolean;
  onSaveCv: (data: CvData) => Promise<boolean> | boolean;
  onOpenPaywall: () => void;
  cvBuilderSettings?: any;
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
  additionalSections: { objective: '', projects: [], internships: [], volunteerWork: [], achievements: [], professionalTraining: [], relevantCoursework: [], publications: [], references: [], careerGapExplanation: '', preferredEmploymentType: '', noticePeriod: '', domicile: '', professionalRegistration: '' },
  templateStyle: 'modern',
  themeColor: '#10b981'
});

const normalizeCvData = (value?: CvData): CvData => {
  const blank = createBlankCvData();
  const raw = value && typeof value === 'object' ? value : blank;
  const validStyles = ['modern', 'executive', 'tech', 'classic', 'ats'];
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
    additionalSections: {
      objective: String(raw.additionalSections?.objective || ''),
      projects: Array.isArray(raw.additionalSections?.projects) ? raw.additionalSections.projects.filter((v) => typeof v === 'string') : [],
      internships: Array.isArray(raw.additionalSections?.internships) ? raw.additionalSections.internships.filter((v) => typeof v === 'string') : [],
      volunteerWork: Array.isArray(raw.additionalSections?.volunteerWork) ? raw.additionalSections.volunteerWork.filter((v) => typeof v === 'string') : [],
      achievements: Array.isArray(raw.additionalSections?.achievements) ? raw.additionalSections.achievements.filter((v) => typeof v === 'string') : [],
      professionalTraining: Array.isArray(raw.additionalSections?.professionalTraining) ? raw.additionalSections.professionalTraining.filter((v) => typeof v === 'string') : [],
      relevantCoursework: Array.isArray(raw.additionalSections?.relevantCoursework) ? raw.additionalSections.relevantCoursework.filter((v) => typeof v === 'string') : [],
      publications: Array.isArray(raw.additionalSections?.publications) ? raw.additionalSections.publications.filter((v) => typeof v === 'string') : [],
      references: Array.isArray(raw.additionalSections?.references) ? raw.additionalSections.references.filter((v) => typeof v === 'string') : [],
      careerGapExplanation: String(raw.additionalSections?.careerGapExplanation || ''),
      preferredEmploymentType: String(raw.additionalSections?.preferredEmploymentType || ''),
      noticePeriod: String(raw.additionalSections?.noticePeriod || ''),
      domicile: String(raw.additionalSections?.domicile || ''),
      professionalRegistration: String(raw.additionalSections?.professionalRegistration || '')
    },
    templateStyle: validStyles.includes(raw.templateStyle) ? raw.templateStyle : blank.templateStyle,
    themeColor: typeof raw.themeColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.themeColor) ? raw.themeColor : blank.themeColor
  };
};

export const CvBuilder: React.FC<CvBuilderProps> = ({ isSubscribed, initialCvData, initialCvDocuments, cvDesignEntitlements = [], onPurchaseTemplate, onSaveCvDocuments, onSaveCv, onOpenPaywall, cvBuilderSettings = {} }) => {
  const [step, setStep] = useState<number>(1);
  const [isSavingCv, setIsSavingCv] = useState(false);
  const [cvSaveMessage, setCvSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const makeDocument = (data: CvData, title = ''): CvDocument => ({
    id: `cv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title || data.personalInfo.fullName || 'My CV',
    data: normalizeCvData(data),
    updatedAt: new Date().toISOString()
  });
  const [documents, setDocuments] = useState<CvDocument[]>(() => Array.isArray(initialCvDocuments) && initialCvDocuments.length
    ? initialCvDocuments.map((doc) => ({ ...doc, data: normalizeCvData(doc.data) }))
    : [makeDocument(normalizeCvData(initialCvData), 'My CV')]);
  const [activeCvId, setActiveCvId] = useState<string>(() => documents[0]?.id || 'cv-main');
  const [cvData, setCvData] = useState<CvData>(() => normalizeCvData(documents[0]?.data || initialCvData));

  // Hydrate account documents while preserving the currently selected document after saves.
  useEffect(() => {
    const next = Array.isArray(initialCvDocuments) && initialCvDocuments.length
      ? initialCvDocuments.map((doc) => ({ ...doc, data: normalizeCvData(doc.data) }))
      : [makeDocument(normalizeCvData(initialCvData), 'My CV')];
    setDocuments(next);
    const selected = next.find((doc) => doc.id === activeCvId) || next[0];
    setActiveCvId(selected.id);
    setCvData(normalizeCvData(selected.data));
    setCvSaveMessage(null);
  }, [initialCvData, initialCvDocuments]);

  useEffect(() => {
    setDocuments((previous) => previous.map((document) => document.id === activeCvId ? { ...document, data: cvData } : document));
  }, [cvData, activeCvId]);

  const handleCreateCv = () => {
    const maxAllowed = isSubscribed ? Math.max(0, Math.min(10, Math.floor(Number(cvBuilderSettings.premiumCvLimit ?? 10)))) : Math.max(0, Math.min(10, Math.floor(Number(cvBuilderSettings.freeCvLimit ?? 1))));
    if (documents.length >= maxAllowed) {
      setCvSaveMessage({ type: 'error', text: isSubscribed ? `The administrator has set a maximum of ${maxAllowed} CV(s) for premium members.` : `Your free plan allows ${maxAllowed} CV(s). Upgrade to create more.` });
      if (!isSubscribed) onOpenPaywall();
      return;
    }
    const blank = createBlankCvData();
    const next = makeDocument(blank, `CV ${documents.length + 1}`);
    setDocuments((previous) => [...previous, next]);
    setActiveCvId(next.id);
    setCvData(blank);
    setStep(1);
    setCvSaveMessage({ type: 'success', text: 'A new CV draft is ready. Save it when you finish.' });
  };

  const handleSelectCv = (id: string) => {
    const selected = documents.find((document) => document.id === id);
    if (!selected) return;
    setActiveCvId(id);
    setCvData(normalizeCvData(selected.data));
    setCvSaveMessage(null);
  };

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
      const updatedDocuments = documents.map((document) => document.id === activeCvId
        ? { ...document, title: (cvData.personalInfo.fullName.trim() || document.title || 'My CV').slice(0, 120), data: cvData, updatedAt: new Date().toISOString() }
        : document);
      const saved = onSaveCvDocuments
        ? await onSaveCvDocuments(updatedDocuments, cvData)
        : await onSaveCv(cvData);
      if (saved) setDocuments(updatedDocuments);
      setCvSaveMessage(saved
        ? { type: 'success', text: 'Your CV has been saved to your account.' }
        : { type: 'error', text: 'The CV could not be saved. Please try again.' });
    } catch (error: any) {
      setCvSaveMessage({ type: 'error', text: error?.message || 'Unable to save your CV right now.' });
    } finally {
      setIsSavingCv(false);
    }
  };

  const handleDownloadAtsText = () => {
    if (!isTemplateEnabled(cvData.templateStyle) || (!isSubscribed && !isTemplateFree(cvData.templateStyle))) {
      const selected = configuredTemplates.find((item: any) => item.id === cvData.templateStyle);
      const price = Math.max(0, Number(selected?.pricePkr || 0));
      if (price > 0) onPurchaseTemplate(cvData.templateStyle, selected?.name || 'Premium CV Design', price);
      else onOpenPaywall();
      return;
    }
    const ownsSelectedDesignForExport = cvDesignEntitlements.some((item) => item.templateId === cvData.templateStyle);
    if (!isSubscribed && !ownsSelectedDesignForExport && cvBuilderSettings.atsTextExportEnabled === false) { onOpenPaywall(); return; }
    const lines: string[] = [];
    const p = cvData.personalInfo;
    const extra: NonNullable<CvData['additionalSections']> = cvData.additionalSections || {};
    const add = (heading: string, values: string[]) => {
      const clean = values.map((v) => String(v || '').trim()).filter(Boolean);
      if (clean.length) lines.push('', heading.toUpperCase(), ...clean);
    };
    lines.push(p.fullName, p.jobTitle, [p.email, p.phone, p.location, p.website, p.linkedin, p.github].filter(Boolean).join(' | '), '', 'PROFESSIONAL SUMMARY', p.summary || '');
    add('Career Objective', [extra.objective || '']);
    add('Work Experience', cvData.experience.flatMap((entry) => [`${entry.position} - ${entry.company} (${entry.startDate} - ${entry.current ? 'Present' : entry.endDate})`, ...entry.bullets]));
    add('Education', cvData.education.map((entry) => `${entry.degree} ${entry.fieldOfStudy} - ${entry.institution} (${entry.startDate} - ${entry.endDate}) ${entry.gpa || ''}`));
    add('Skills', [...cvData.skills.technical, ...cvData.skills.soft, ...cvData.skills.languages]);
    add('Certifications', cvData.certifications.map((entry) => `${entry.name} - ${entry.issuer} - ${entry.year}`));
    add('Projects', extra.projects || []);
    add('Internships', extra.internships || []);
    add('Volunteer Work', extra.volunteerWork || []);
    add('Achievements & Awards', extra.achievements || []);
    add('Professional Training', extra.professionalTraining || []);
    add('Relevant Coursework', extra.relevantCoursework || []);
    add('Research & Publications', extra.publications || []);
    add('References', extra.references || []);
    add('Additional Information', [extra.careerGapExplanation, extra.preferredEmploymentType, extra.noticePeriod, extra.domicile, extra.professionalRegistration].filter(Boolean) as string[]);
    if (exportWatermarkVisible) lines.push('', String(selectedTemplateConfig.watermarkText || cvBuilderSettings.watermarkText || 'Hybrid Job Portal'));
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(p.fullName || 'candidate-cv').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'candidate-cv'}-ats.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Trigger Print Engine
  const handleDownloadPdf = () => {
    if (!isTemplateEnabled(cvData.templateStyle) || (!isSubscribed && !isTemplateFree(cvData.templateStyle))) {
      const selected = configuredTemplates.find((item: any) => item.id === cvData.templateStyle);
      const price = Math.max(0, Number(selected?.pricePkr || 0));
      if (price > 0) onPurchaseTemplate(cvData.templateStyle, selected?.name || 'Premium CV Design', price);
      else onOpenPaywall();
      return;
    }
    const ownsSelectedDesignForExport = cvDesignEntitlements.some((item) => item.templateId === cvData.templateStyle);
    if (!isSubscribed && !ownsSelectedDesignForExport && cvBuilderSettings.pdfExportEnabled === false) { onOpenPaywall(); return; }
    window.print();
  };

  const templateCatalog = [
    { id: 'modern', name: 'Modern Clean' }, { id: 'executive', name: 'Executive Dark Sidebar' },
    { id: 'tech', name: 'Tech Minimalist' }, { id: 'classic', name: 'Classic Corporate' }, { id: 'ats', name: 'ATS Plain Text' }
  ];
  const configuredTemplates = Array.isArray(cvBuilderSettings.templates) ? cvBuilderSettings.templates : [];
  const enabledTemplates = templateCatalog.filter((template) => configuredTemplates.find((item: any) => item.id === template.id)?.enabled !== false || cvDesignEntitlements.some((item) => item.templateId === template.id));
  const freeTemplates = enabledTemplates.filter((template) => {
    const config = configuredTemplates.find((item: any) => item.id === template.id);
    return config ? config.enabled !== false && config.free === true : ['modern', 'ats'].includes(template.id);
  }).slice(0, Math.max(0, Math.min(5, Number(cvBuilderSettings.freeDesignLimit ?? 2))));
  const isTemplateEnabled = (id: string) => enabledTemplates.some((template) => template.id === id);
  const isTemplateFree = (id: string) => isSubscribed || freeTemplates.some((template) => template.id === id) || cvDesignEntitlements.some((item) => item.templateId === id);
  const selectedTemplateConfig = configuredTemplates.find((item: any) => item.id === cvData.templateStyle) || {};
  // A preview watermark is intentionally always visible to discourage screenshot-based reuse.
  // Export watermark policy is evaluated separately and never controls the on-screen preview.
  const previewWatermarkVisible = selectedTemplateConfig.previewWatermarkEnabled !== false;
  const exportWatermarkVisible = selectedTemplateConfig.exportWatermarkEnabled === true ||
    (selectedTemplateConfig.exportWatermarkEnabled === undefined &&
      cvBuilderSettings.watermarkEnabled !== false &&
      (!isSubscribed || cvBuilderSettings.watermarkFreeOnly === false));

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

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Select saved CV" value={activeCvId} onChange={(e) => handleSelectCv(e.target.value)} className="max-w-[170px] px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white">
              {documents.map((document, index) => <option key={document.id} value={document.id}>{document.title || `CV ${index + 1}`}</option>)}
            </select>
            <button type="button" onClick={handleCreateCv} className="px-3 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold">+ New CV ({documents.length}/{isSubscribed ? Math.max(0, Number(cvBuilderSettings.premiumCvLimit ?? 10)) : Math.max(0, Number(cvBuilderSettings.freeCvLimit ?? 1))})</button>
          </div>
          <button
            type="button"
            onClick={handleSaveCv}
            disabled={isSavingCv}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-black text-sm flex items-center space-x-2 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{isSavingCv ? 'Saving...' : 'Save CV Draft'}</span>
          </button>
          <button type="button" onClick={handleDownloadAtsText} className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs">{!isSubscribed && cvBuilderSettings.atsTextExportEnabled === false ? 'ATS Text · Premium' : 'Download ATS Text'}</button>

          <button
            onClick={handleDownloadPdf}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center space-x-2 hover:scale-105 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>{!isSubscribed && cvBuilderSettings.pdfExportEnabled === false ? 'PDF Export · Premium' : 'Export PDF Resume'}</span>
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
              { id: 4, label: 'Skills & Style', icon: Palette },
              { id: 5, label: 'Additional Sections', icon: FileText }
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="block text-[11px] font-semibold text-slate-400">Work Location
                      <input type="text" value={exp.location} onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx] = { ...updated[idx], location: e.target.value };
                        setCvData({ ...cvData, experience: updated });
                      }} className="mt-1 w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs" />
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-400">Start Date
                      <input type="text" value={exp.startDate} onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx] = { ...updated[idx], startDate: e.target.value };
                        setCvData({ ...cvData, experience: updated });
                      }} placeholder="e.g. Jan 2022" className="mt-1 w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs" />
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-400">End Date
                      <input type="text" value={exp.endDate} disabled={exp.current} onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx] = { ...updated[idx], endDate: e.target.value };
                        setCvData({ ...cvData, experience: updated });
                      }} placeholder="e.g. Dec 2024" className="mt-1 w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs disabled:opacity-50" />
                    </label>
                    <label className="flex items-center gap-2 self-end pb-2 text-xs text-slate-300">
                      <input type="checkbox" checked={exp.current} onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx] = { ...updated[idx], current: e.target.checked, endDate: e.target.checked ? 'Present' : '' };
                        setCvData({ ...cvData, experience: updated });
                      }} />
                      I currently work here
                    </label>
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
                  {enabledTemplates.map((t) => {
                    const templateConfig = configuredTemplates.find((item: any) => item.id === t.id);
                    const displayName = String(templateConfig?.name || t.name);
                    const free = isTemplateFree(t.id);
                    const price = Math.max(0, Number(templateConfig?.pricePkr || 0));
                    return <button type="button" key={t.id} onClick={() => { if (free) setCvData({ ...cvData, templateStyle: t.id as CvData['templateStyle'] }); else if (price > 0) onPurchaseTemplate(t.id, displayName, price); else onOpenPaywall(); }} className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${cvData.templateStyle === t.id ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'}`}>
                      {displayName}{!free && <span className="block text-[10px] text-amber-300">Premium · {price > 0 ? `One-time PKR ${price}` : 'Premium plan'}</span>}{cvDesignEntitlements.some((item) => item.templateId === t.id) && <span className="block text-[10px] text-emerald-300">Purchased · Unlocked</span>}
                    </button>;
                  })}
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
                Accent Color
                <input type="color" value={cvData.themeColor} onChange={(e) => setCvData({ ...cvData, themeColor: e.target.value })} className="h-9 w-14 rounded border border-slate-700 bg-slate-900 cursor-pointer" aria-label="CV accent color" />
              </label>
            </div>
          )}

          {/* STEP 5: OPTIONAL CAREER SECTIONS */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Additional Career Information (Optional)</h3>
              <p className="text-xs text-slate-400">Only add information that is accurate and relevant. Leave any section blank if it does not apply.</p>
              <label className="block text-xs font-semibold text-slate-400">Career Objective
                <textarea rows={3} maxLength={5000} value={cvData.additionalSections?.objective || ''} onChange={(e) => setCvData({ ...cvData, additionalSections: { ...cvData.additionalSections, objective: e.target.value } })} className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
              </label>
              {([
                ['projects', 'Projects'], ['internships', 'Internships'], ['volunteerWork', 'Volunteer Work'],
                ['achievements', 'Achievements & Awards'], ['professionalTraining', 'Professional Training'],
                ['relevantCoursework', 'Relevant Coursework'], ['publications', 'Research & Publications'], ['references', 'References (Optional)']
              ] as const).map(([field, label]) => (
                <label key={field} className="block text-xs font-semibold text-slate-400">{label} (one item per line)
                  <textarea rows={3} value={(cvData.additionalSections?.[field] || []).join('\n')} onChange={(e) => setCvData({ ...cvData, additionalSections: { ...cvData.additionalSections, [field]: e.target.value.split('\n').map((v) => v.trim()).filter(Boolean) } })} className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
                </label>
              ))}
              {([
                ['careerGapExplanation', 'Career Gap Explanation (Optional)'], ['preferredEmploymentType', 'Preferred Employment Type'],
                ['noticePeriod', 'Notice Period / Availability'], ['domicile', 'Domicile / Province (only where relevant)'],
                ['professionalRegistration', 'Professional Registration / Licence (if applicable)']
              ] as const).map(([field, label]) => (
                <label key={field} className="block text-xs font-semibold text-slate-400">{label}
                  <input type="text" maxLength={5000} value={cvData.additionalSections?.[field] || ''} onChange={(e) => setCvData({ ...cvData, additionalSections: { ...cvData.additionalSections, [field]: e.target.value } })} className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
                </label>
              ))}
              <p className="text-[11px] text-amber-300">CNIC, religion, marital status, age and gender are not required in a standard CV. Do not add sensitive details unless a specific application requires them.</p>
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

            {step < 5 ? (
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
              className="relative overflow-hidden bg-white text-slate-900 p-6 rounded-lg shadow-inner min-h-[580px] text-xs space-y-4"
              style={{
                borderTop: cvData.templateStyle === 'ats' ? 'none' : `5px solid ${cvData.themeColor}`,
                borderLeft: cvData.templateStyle === 'executive' ? '14px solid #0f172a' : undefined,
                fontFamily: cvData.templateStyle === 'tech' ? 'ui-monospace, SFMono-Regular, monospace' : cvData.templateStyle === 'classic' ? 'Georgia, serif' : 'Arial, sans-serif'
              }}
            >
              {previewWatermarkVisible && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden print:hidden"><span className="whitespace-nowrap text-3xl font-black uppercase tracking-widest text-slate-500" style={{ transform: "rotate(-35deg)", opacity: Math.min(0.35, Math.max(0.05, Number(selectedTemplateConfig.watermarkOpacity ?? cvBuilderSettings.watermarkOpacity ?? 0.16))) }}>{String(selectedTemplateConfig.watermarkText || cvBuilderSettings.watermarkText || 'Hybrid Job Portal')} · PREVIEW</span></div>}
              {exportWatermarkVisible && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 hidden print:flex items-center justify-center overflow-hidden"><span className="whitespace-nowrap text-3xl font-black uppercase tracking-widest text-slate-500" style={{ transform: "rotate(-35deg)", opacity: Math.min(0.35, Math.max(0.05, Number(selectedTemplateConfig.watermarkOpacity ?? cvBuilderSettings.watermarkOpacity ?? 0.16))) }}>{String(selectedTemplateConfig.watermarkText || cvBuilderSettings.watermarkText || 'Hybrid Job Portal')}</span></div>}
              {/* CV Header */}
              <div className="border-b-2 pb-3 flex items-start justify-between gap-4" style={{ borderColor: cvData.themeColor }}>
                <div className="flex-1">
                  <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: cvData.themeColor }}>
                    {cvData.personalInfo.fullName || 'Your Full Name'}
                  </h1>
                  <p className="font-bold text-xs mt-0.5" style={{ color: cvData.themeColor }}>
                    {cvData.personalInfo.jobTitle || 'Your Job Title'}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 mt-2 font-medium">
                    <span>{cvData.personalInfo.phone}</span>
                    <span>•</span>
                    <span>{cvData.personalInfo.email}</span>
                    <span>•</span>
                    <span>{cvData.personalInfo.location}</span>
                    {[cvData.personalInfo.website, cvData.personalInfo.linkedin, cvData.personalInfo.github].filter(Boolean).map((link, index) => (
                      <span key={index} className="break-all">{link}</span>
                    ))}
                  </div>
                </div>

                {cvData.photoBase64 && cvData.templateStyle !== 'ats' && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-300 shadow-sm flex-shrink-0">
                    <img src={cvData.photoBase64} alt="Candidate Profile" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Summary */}
              {cvData.personalInfo.summary && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: cvData.themeColor }}>
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
                  <h3 className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: cvData.themeColor }}>
                    Work Experience
                  </h3>
                  <div className="space-y-2">
                    {cvData.experience.map((exp) => (
                      <div key={exp.id}>
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{exp.position} — <span style={{ color: cvData.themeColor }}>{exp.company}</span></span>
                          <span className="text-[10px] text-slate-500">{exp.startDate} - {exp.endDate}</span>
                        </div>
                        {exp.location && <div className="text-[10px] text-slate-500">{exp.location}</div>}
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
                      <span className="font-bold text-slate-900">{edu.degree}{edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''} - {edu.institution}{edu.gpa ? ` · ${edu.gpa}` : ''}</span>
                      <span className="text-slate-500">{edu.startDate} - {edu.endDate}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills */}
              {(['technical', 'soft', 'languages'] as const).map((field) => cvData.skills[field].length > 0 && (
                <div key={field}>
                  <h3 className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: cvData.themeColor }}>
                    {field === 'technical' ? 'Technical Skills' : field === 'soft' ? 'Soft Skills' : 'Languages'}
                  </h3>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {cvData.skills[field].map((skill, index) => (
                      <span key={index} className="bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded">{skill}</span>
                    ))}
                  </div>
                </div>
              ))}

              {cvData.certifications.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: cvData.themeColor }}>Certifications</h3>
                  <div className="space-y-1">
                    {cvData.certifications.map((cert) => (
                      <div key={cert.id} className="text-[11px] text-slate-700">
                        <strong className="text-slate-900">{cert.name}</strong>
                        {cert.issuer ? ` — ${cert.issuer}` : ''}{cert.year ? ` (${cert.year})` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cvData.additionalSections?.objective && <div><h3 className="text-xs font-black uppercase mb-1" style={{ color: cvData.themeColor }}>Career Objective</h3><p className="text-[11px] whitespace-pre-wrap">{cvData.additionalSections.objective}</p></div>}
              {([
                ['projects', 'Projects'], ['internships', 'Internships'], ['volunteerWork', 'Volunteer Work'],
                ['achievements', 'Achievements & Awards'], ['professionalTraining', 'Professional Training'],
                ['relevantCoursework', 'Relevant Coursework'], ['publications', 'Research & Publications'], ['references', 'References']
              ] as const).map(([field, label]) => {
                const items = cvData.additionalSections?.[field] || [];
                return items.length ? <div key={field}><h3 className="text-xs font-black uppercase mb-1" style={{ color: cvData.themeColor }}>{label}</h3><ul className="list-disc pl-4 space-y-0.5">{items.map((item, index) => <li key={index} className="text-[11px]">{item}</li>)}</ul></div> : null;
              })}
              {([
                ['careerGapExplanation', 'Career Gap'], ['preferredEmploymentType', 'Preferred Employment'],
                ['noticePeriod', 'Notice Period'], ['domicile', 'Domicile'], ['professionalRegistration', 'Professional Registration']
              ] as const).map(([field, label]) => {
                const value = cvData.additionalSections?.[field];
                return value ? <div key={field}><h3 className="text-xs font-black uppercase mb-1" style={{ color: cvData.themeColor }}>{label}</h3><p className="text-[11px]">{value}</p></div> : null;
              })}

            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
