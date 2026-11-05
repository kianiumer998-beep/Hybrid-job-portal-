import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Search, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  RefreshCw, 
  Eye, 
  Lock, 
  Crown, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  X, 
  FileText, 
  UserCheck, 
  Globe, 
  Layers,
  ArrowRight,
  Bookmark
} from 'lucide-react';
import { api } from '../../services/api';

export interface ModalDefinition {
  id: string;
  name: string;
  category: 'Premium & Subscription' | 'Job Applications' | 'Authentication' | 'General & Legal';
  filePath: string;
  description: string;
  fields: {
    key: string;
    label: string;
    type: 'input' | 'textarea';
    defaultValue: string;
    placeholder?: string;
  }[];
}

export const MODAL_INVENTORY: ModalDefinition[] = [
  {
    id: 'premiumUpgrade',
    name: 'Premium Upgrade Modal',
    category: 'Premium & Subscription',
    filePath: 'src/components/PremiumUpgradeModal.tsx',
    description: 'Shown when candidate or guest clicks locked premium job features, hidden salary details, or apply links.',
    fields: [
      { key: 'customTitle', label: 'Main Modal Title', type: 'input', defaultValue: 'Unlock Premium Access', placeholder: 'e.g. Unlock Premium Access' },
      { key: 'customMessage', label: 'Subtitle / Description', type: 'textarea', defaultValue: 'Upgrade your account to apply for jobs and unlock all premium portal features.', placeholder: 'Subtitle description...' },
      { key: 'benefit1Title', label: 'Benefit 1 Title', type: 'input', defaultValue: 'Direct Application URLs', placeholder: 'Direct Application URLs' },
      { key: 'benefit1Desc', label: 'Benefit 1 Description', type: 'textarea', defaultValue: 'Instant 1-click access to official department & portal application links.', placeholder: 'Description...' },
      { key: 'benefit2Title', label: 'Benefit 2 Title', type: 'input', defaultValue: 'Official Gazette & Source PDFs', placeholder: 'Official Gazette & Source PDFs' },
      { key: 'benefit2Desc', label: 'Benefit 2 Description', type: 'textarea', defaultValue: 'Download original recruitment circulars and newspaper ads.', placeholder: 'Description...' },
      { key: 'benefit3Title', label: 'Benefit 3 Title', type: 'input', defaultValue: 'Priority Member Access', placeholder: 'Priority Member Access' },
      { key: 'benefit3Desc', label: 'Benefit 3 Description', type: 'textarea', defaultValue: 'Unlock full department details and priority vacancy listings.', placeholder: 'Description...' },
      { key: 'ctaText', label: 'Primary CTA Button Text', type: 'input', defaultValue: 'Upgrade to Premium', placeholder: 'e.g. Upgrade to Premium' },
      { key: 'footerNote', label: 'Footer Security Note', type: 'input', defaultValue: 'Instant Access Upon Admin Verification • Easy Online Subscriptions', placeholder: 'Security note...' }
    ]
  },
  {
    id: 'candidateApplication',
    name: 'Candidate Application Modal',
    category: 'Job Applications',
    filePath: 'src/components/CandidateApplicationModal.tsx',
    description: 'Application form modal rendered when candidate applies directly for a vacancy.',
    fields: [
      { key: 'title', label: 'Modal Header Title', type: 'input', defaultValue: 'Submit Job Application', placeholder: 'Submit Job Application' },
      { key: 'instructions', label: 'Candidate Instructions', type: 'textarea', defaultValue: 'Complete the verified application details below. The hiring employer or department will review your credentials directly.', placeholder: 'Instructions...' },
      { key: 'contactHeading', label: 'Contact Details Section Title', type: 'input', defaultValue: 'Candidate Contact Credentials', placeholder: 'Candidate Contact Credentials' },
      { key: 'resumeHeading', label: 'Resume Section Title', type: 'input', defaultValue: 'Verified ATS Resume Attachment', placeholder: 'Verified ATS Resume Attachment' },
      { key: 'submitCta', label: 'Submit Button Text', type: 'input', defaultValue: 'Submit Application Now', placeholder: 'Submit Application Now' },
      { key: 'successMsg', label: 'Submission Success Message', type: 'textarea', defaultValue: 'Your application has been received successfully and forwarded to the hiring team!', placeholder: 'Success message...' }
    ]
  },
  {
    id: 'subscription',
    name: 'Subscription / Payment Modal',
    category: 'Premium & Subscription',
    filePath: 'src/components/SubscriptionModal.tsx',
    description: 'Payment selection and transaction proof submission modal for premium subscriptions.',
    fields: [
      { key: 'badgeText', label: 'Header Badge Label', type: 'input', defaultValue: 'Instant WhatsApp & Direct Apply Unlock', placeholder: 'Badge text...' },
      { key: 'title', label: 'Main Modal Heading', type: 'input', defaultValue: 'Get Daily Job Alerts & Direct Application Access', placeholder: 'Heading...' },
      { key: 'subtitle', label: 'Subtitle Description', type: 'textarea', defaultValue: 'Subscribe once to receive daily verified remote & hybrid job openings directly on WhatsApp and apply instantly with 1-click.', placeholder: 'Subtitle...' },
      { key: 'packageSectionTitle', label: 'Package Selection Label', type: 'input', defaultValue: 'Select Subscription Package', placeholder: 'Select Subscription Package' },
      { key: 'submitCta', label: 'Submit Proof CTA Label', type: 'input', defaultValue: 'Submit Payment Proof for Verification', placeholder: 'Submit Payment Proof...' }
    ]
  },
  {
    id: 'cvPaywall',
    name: 'CV Download Paywall Modal',
    category: 'Job Applications',
    filePath: 'src/components/CvPaywallModal.tsx',
    description: 'Prompt modal shown when candidate requests watermark-free HD PDF resume download.',
    fields: [
      { key: 'title', label: 'Modal Title', type: 'input', defaultValue: 'Unlock Premium HD PDF Download', placeholder: 'Unlock Premium HD PDF Download' },
      { key: 'subtitle', label: 'Modal Subtitle', type: 'textarea', defaultValue: 'Download your watermarked-free, high-resolution vector PDF resume optimized for ATS corporate scanners.', placeholder: 'Subtitle...' },
      { key: 'packageTitle', label: 'Export Plan Title', type: 'input', defaultValue: 'Single Premium CV Export', placeholder: 'Single Premium CV Export' },
      { key: 'bullet1', label: 'Feature Bullet 1', type: 'input', defaultValue: '100% Vector Quality Print Engine', placeholder: 'Bullet 1...' },
      { key: 'bullet2', label: 'Feature Bullet 2', type: 'input', defaultValue: '99.4% ATS Parser Score', placeholder: 'Bullet 2...' },
      { key: 'ctaText', label: 'Primary CTA Button Label', type: 'input', defaultValue: 'Upgrade to Pro / Export Resume', placeholder: 'CTA Label...' }
    ]
  },
  {
    id: 'authModal',
    name: 'Candidate Sign In / Registration Modal',
    category: 'Authentication',
    filePath: 'src/components/AuthModal.tsx',
    description: 'Account login and free registration modal for candidates.',
    fields: [
      { key: 'loginTab', label: 'Login Tab Label', type: 'input', defaultValue: 'Sign In', placeholder: 'Sign In' },
      { key: 'registerTab', label: 'Register Tab Label', type: 'input', defaultValue: 'Create Free Account', placeholder: 'Create Free Account' },
      { key: 'loginTitle', label: 'Sign In Heading', type: 'input', defaultValue: 'Welcome Back to Career Portal', placeholder: 'Welcome Back...' },
      { key: 'registerTitle', label: 'Registration Heading', type: 'input', defaultValue: 'Create Candidate Profile', placeholder: 'Create Candidate Profile' },
      { key: 'loginCta', label: 'Sign In Button Text', type: 'input', defaultValue: 'Sign In to Candidate Dashboard', placeholder: 'Sign In...' },
      { key: 'registerCta', label: 'Register Button Text', type: 'input', defaultValue: 'Register Free Account', placeholder: 'Register...' }
    ]
  },
  {
    id: 'adminLogin',
    name: 'Admin Portal Authentication Modal',
    category: 'Authentication',
    filePath: 'src/components/AdminLoginModal.tsx',
    description: 'Security passcode dialog for system administrator portal access.',
    fields: [
      { key: 'title', label: 'Admin Modal Heading', type: 'input', defaultValue: 'System Administrator Authentication', placeholder: 'System Administrator Authentication' },
      { key: 'subtitle', label: 'Security Subtitle', type: 'input', defaultValue: 'Restricted Portal Access', placeholder: 'Restricted Portal Access' },
      { key: 'ctaText', label: 'Authenticate CTA Label', type: 'input', defaultValue: 'Authenticate & Launch Dashboard', placeholder: 'Authenticate...' }
    ]
  },
  {
    id: 'countrySelection',
    name: 'Country & Region Switcher Modal',
    category: 'General & Legal',
    filePath: 'src/components/CountrySelectionModal.tsx',
    description: 'Welcome and regional/language selection modal for new portal visitors.',
    fields: [
      { key: 'title', label: 'Welcome Title', type: 'input', defaultValue: 'Welcome to Hybrid Job Portal', placeholder: 'Welcome...' },
      { key: 'subtitle', label: 'Instructions Subtitle', type: 'input', defaultValue: 'Select your country / region to view localized vacancies and currency.', placeholder: 'Instructions...' },
      { key: 'ctaText', label: 'Confirmation Button Label', type: 'input', defaultValue: 'Continue to Job Portal', placeholder: 'Continue...' }
    ]
  },
  {
    id: 'legalDisclaimer',
    name: 'Terms, Privacy & Legal Modal',
    category: 'General & Legal',
    filePath: 'src/components/LegalDisclaimerModal.tsx',
    description: 'Legal terms, privacy policy, and contact modal.',
    fields: [
      { key: 'title', label: 'Legal Modal Title', type: 'input', defaultValue: 'Portal Terms, Privacy & Legal Guidelines', placeholder: 'Title...' },
      { key: 'acceptCta', label: 'Accept Agreement CTA Text', type: 'input', defaultValue: 'I Understand & Accept Terms', placeholder: 'I Understand...' }
    ]
  }
];

export const AdminModalContentManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const [activeModalId, setActiveModalId] = useState<string>('premiumUpgrade');
  const [modalSettings, setModalSettings] = useState<Record<string, Record<string, string>>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.applySettings.get();
      if (res && res.success && res.settings && res.settings.modalSettings) {
        setModalSettings(res.settings.modalSettings || {});
      }
    } catch (err) {
      console.error('Failed to load modal content settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldValueChange = (modalId: string, fieldKey: string, val: string) => {
    setModalSettings((prev) => ({
      ...prev,
      [modalId]: {
        ...(prev[modalId] || {}),
        [fieldKey]: val
      }
    }));
  };

  const handleResetModalFields = (modalId: string) => {
    setModalSettings((prev) => {
      const next = { ...prev };
      delete next[modalId];
      return next;
    });
    setShowResetConfirm(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const currentRes = await api.applySettings.get();
      const currentSettings = currentRes?.settings || {};

      const updated = {
        ...currentSettings,
        modalSettings
      };

      const res = await api.applySettings.update(updated);
      if (res && res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (err) {
      console.error('Error saving modal settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const filteredModals = MODAL_INVENTORY.filter((m) => {
    const matchesCat = selectedCategory === 'All' || m.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const activeModalDef = MODAL_INVENTORY.find((m) => m.id === activeModalId) || MODAL_INVENTORY[0];
  const activeModalCustoms = modalSettings[activeModalDef.id] || {};

  const getValue = (key: string, defaultVal: string) => {
    return activeModalCustoms[key] !== undefined ? activeModalCustoms[key] : defaultVal;
  };

  const isModalCustomized = (modalId: string) => {
    const customs = modalSettings[modalId];
    if (!customs) return false;
    return Object.keys(customs).some((k) => customs[k] && customs[k].trim() !== '');
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center space-x-3">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
        <span>Loading Modal & Popup Content Manager...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="bg-[#05130e] border border-emerald-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Modal & Popup Content Manager</h2>
              <p className="text-xs text-emerald-100/70">Centralized presentation editor for user-facing dialogs, popups, and application modals.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {saveSuccess && (
            <span className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 rounded-xl">
              <CheckCircle className="w-4 h-4" />
              <span>Settings Saved & Persisted!</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin text-slate-950" /> : <Save className="w-4 h-4 text-slate-950" />}
            <span>Save All Customizations</span>
          </button>
        </div>
      </div>

      {/* Categories & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {['All', 'Premium & Subscription', 'Job Applications', 'Authentication', 'General & Legal'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                selectedCategory === cat 
                  ? 'bg-emerald-500 text-slate-950 shadow-md' 
                  : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search modals..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Main Grid: Modals Sidebar + Editor / Live Preview Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Modal Inventory List (4 Cols) */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="text-xs font-bold uppercase text-slate-400 tracking-wider px-1">
            Available Modals ({filteredModals.length})
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {filteredModals.map((m) => {
              const isActive = m.id === activeModalId;
              const isCustom = isModalCustomized(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => setActiveModalId(m.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#081a14] border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white truncate max-w-[180px]">{m.name}</span>
                    {isCustom ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Customized
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 border border-slate-800">
                        Default
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">{m.description}</p>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span className="truncate max-w-[150px]">{m.filePath}</span>
                    <span>{m.fields.length} Fields</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Modal Form Fields + Live Preview Split (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Modal Overview Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {activeModalDef.category}
                </span>
                <h3 className="text-base font-black text-white">{activeModalDef.name}</h3>
              </div>
              <p className="text-xs text-slate-400 font-mono">{activeModalDef.filePath}</p>
            </div>

            <div className="flex items-center space-x-2">
              {isModalCustomized(activeModalDef.id) && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Defaults</span>
                </button>
              )}
            </div>
          </div>

          {/* Reset Confirmation Bar */}
          {showResetConfirm && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
              <span className="text-xs font-bold text-rose-300">
                Are you sure you want to reset customized wording for "{activeModalDef.name}" to built-in system defaults?
              </span>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleResetModalFields(activeModalDef.id)}
                  className="px-3 py-1.5 bg-rose-500 text-white font-bold text-xs rounded-xl hover:bg-rose-400 cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Editors Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Editable Presentation Text Elements</span>
            </h4>

            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {activeModalDef.fields.map((field) => {
                const currentVal = getValue(field.key, field.defaultValue);
                const isFieldCustom = activeModalCustoms[field.key] !== undefined && activeModalCustoms[field.key] !== field.defaultValue;

                return (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-slate-200">{field.label}</label>
                      <div className="flex items-center space-x-2">
                        {isFieldCustom && (
                          <span className="text-[10px] text-emerald-400 font-semibold">Customized</span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono">
                          {currentVal.length}/500 chars
                        </span>
                      </div>
                    </div>

                    {field.type === 'textarea' ? (
                      <textarea
                        rows={2}
                        maxLength={500}
                        value={currentVal}
                        onChange={(e) => handleFieldValueChange(activeModalDef.id, field.key, e.target.value)}
                        placeholder={field.placeholder || field.defaultValue}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                      />
                    ) : (
                      <input
                        type="text"
                        maxLength={500}
                        value={currentVal}
                        onChange={(e) => handleFieldValueChange(activeModalDef.id, field.key, e.target.value)}
                        placeholder={field.placeholder || field.defaultValue}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    )}
                    <span className="text-[10px] text-slate-500 block">Default: {field.defaultValue}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Interactive Preview */}
          <div className="bg-[#05130e] border border-emerald-500/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                <Eye className="w-4 h-4" />
                <span>Live Real-Time Modal Preview</span>
              </div>
              <span className="text-[10px] text-emerald-100/50">Renders live customized text</span>
            </div>

            {/* Simulated Modal Card Preview */}
            <div className="p-4 sm:p-5 bg-gradient-to-b from-[#081f17] to-[#05130e] border border-emerald-500/20 rounded-2xl space-y-3 text-center max-w-md mx-auto shadow-xl">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto border border-emerald-500/30">
                <Crown className="w-5 h-5 text-emerald-400" />
              </div>

              <h4 className="text-base font-black text-white">
                {getValue('customTitle', getValue('title', getValue('loginTitle', activeModalDef.name)))}
              </h4>

              <p className="text-xs text-emerald-100/70 leading-relaxed">
                {getValue('customMessage', getValue('instructions', getValue('subtitle', activeModalDef.description)))}
              </p>

              {activeModalDef.id === 'premiumUpgrade' && (
                <div className="space-y-2 text-left pt-1">
                  <div className="p-2.5 bg-[#081a14] rounded-xl border border-emerald-500/20 flex items-center space-x-2">
                    <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold text-white">{getValue('benefit1Title', 'Direct Application URLs')}</div>
                      <div className="text-[10px] text-emerald-100/60">{getValue('benefit1Desc', 'Instant 1-click access to official portal links.')}</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 text-slate-950 font-black text-xs shadow-md"
              >
                {getValue('ctaText', getValue('submitCta', getValue('acceptCta', 'Upgrade / Submit')))}
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
