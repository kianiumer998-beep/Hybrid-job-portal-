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
  Bookmark,
  Send,
  UploadCloud,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  Mail,
  Smartphone,
  Building,
  KeyRound,
  User,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
  Check
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
      { key: 'benefit1Desc', label: 'Benefit 1 Description', type: 'textarea', defaultValue: 'Access official department & portal application links directly.', placeholder: 'Description...' },
      { key: 'benefit2Title', label: 'Benefit 2 Title', type: 'input', defaultValue: 'Official Gazette & Source PDFs', placeholder: 'Official Gazette & Source PDFs' },
      { key: 'benefit2Desc', label: 'Benefit 2 Description', type: 'textarea', defaultValue: 'Download original recruitment circulars and newspaper ads.', placeholder: 'Description...' },
      { key: 'benefit3Title', label: 'Benefit 3 Title', type: 'input', defaultValue: 'Verified Vacancy Details', placeholder: 'Verified Vacancy Details' },
      { key: 'benefit3Desc', label: 'Benefit 3 Description', type: 'textarea', defaultValue: 'Unlock full department details and direct vacancy listings.', placeholder: 'Description...' },
      { key: 'ctaText', label: 'Primary CTA Button Text', type: 'input', defaultValue: 'Upgrade to Premium', placeholder: 'e.g. Upgrade to Premium' },
      { key: 'footerNote', label: 'Footer Security Note', type: 'input', defaultValue: 'Access activated upon admin verification • Easy Online Subscriptions', placeholder: 'Security note...' }
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
      { key: 'resumeHeading', label: 'Resume Section Title', type: 'input', defaultValue: 'Resume / Curriculum Vitae Attachment', placeholder: 'Resume Attachment' },
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
      { key: 'badgeText', label: 'Header Badge Label', type: 'input', defaultValue: 'WhatsApp Alerts & Direct Apply Access', placeholder: 'Badge text...' },
      { key: 'title', label: 'Main Modal Heading', type: 'input', defaultValue: 'Get Daily Job Alerts & Direct Application Access', placeholder: 'Heading...' },
      { key: 'subtitle', label: 'Subtitle Description', type: 'textarea', defaultValue: 'Subscribe to receive daily verified remote & hybrid job openings directly on WhatsApp and apply instantly with 1-click.', placeholder: 'Subtitle...' },
      { key: 'packageSectionTitle', label: 'Package Selection Label', type: 'input', defaultValue: 'Select Subscription Package', placeholder: 'Select Subscription Package' },
      { key: 'submitCta', label: 'Submit Proof CTA Label', type: 'input', defaultValue: 'Submit Payment Proof for Verification', placeholder: 'Submit Payment Proof...' }
    ]
  },
  {
    id: 'cvPaywall',
    name: 'CV Download Paywall Modal',
    category: 'Job Applications',
    filePath: 'src/components/CvPaywallModal.tsx',
    description: 'Prompt modal shown when candidate requests watermark-free PDF resume download.',
    fields: [
      { key: 'title', label: 'Modal Title', type: 'input', defaultValue: 'Unlock Premium PDF Download', placeholder: 'Unlock Premium PDF Download' },
      { key: 'subtitle', label: 'Modal Subtitle', type: 'textarea', defaultValue: 'Download your watermark-free vector PDF resume formatted for employment applications.', placeholder: 'Subtitle...' },
      { key: 'packageTitle', label: 'Export Plan Title', type: 'input', defaultValue: 'Premium CV Export', placeholder: 'Premium CV Export' },
      { key: 'priceDisplay', label: 'Pricing Information (Informational)', type: 'input', defaultValue: 'Price confirmed during payment', placeholder: 'e.g. Price confirmed during payment' },
      { key: 'bullet1', label: 'Feature Bullet 1', type: 'input', defaultValue: 'Clean Vector Print Layout', placeholder: 'Bullet 1...' },
      { key: 'bullet2', label: 'Feature Bullet 2', type: 'input', defaultValue: 'Standard ATS Compatible Structure', placeholder: 'Bullet 2...' },
      { key: 'bullet3', label: 'Feature Bullet 3', type: 'input', defaultValue: 'Included with Pro Job Alerts Subscription', placeholder: 'Bullet 3...' },
      { key: 'ctaText', label: 'Primary CTA Button Label', type: 'input', defaultValue: 'Upgrade to Pro / Export Resume', placeholder: 'CTA Label...' },
      { key: 'footerNote', label: 'Footer Payment Note', type: 'input', defaultValue: 'Payment verification via Easypaisa, JazzCash & Bank Transfer', placeholder: 'Footer note...' }
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
      { key: 'subtitle', label: 'Legal Modal Subtitle', type: 'input', defaultValue: 'Independent Listings Disclaimer & Compliance Center', placeholder: 'Subtitle...' },
      { key: 'noticeText', label: 'Primary Disclaimer Notice', type: 'textarea', defaultValue: 'All jobs and advertisements listed on this platform are independent of the websites and should be pursued at your own risk. We are not responsible for any investments or applications made.', placeholder: 'Notice text...' },
      { key: 'acceptCta', label: 'Accept Agreement CTA Text', type: 'input', defaultValue: 'I Understand & Accept Terms', placeholder: 'I Understand...' }
    ]
  }
];

export const AdminModalContentManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const [activeModalId, setActiveModalId] = useState<string>('premiumUpgrade');
  const [modalSettings, setModalSettings] = useState<Record<string, Record<string, string>>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [authPreviewTab, setAuthPreviewTab] = useState<'login' | 'register'>('register');

  // Dynamic Production Settings for Previews
  const [lowestPricePkr, setLowestPricePkr] = useState<number | null>(null);
  const [pricingPackages, setPricingPackages] = useState<any[]>([]);
  const [configuredPaymentMethods, setConfiguredPaymentMethods] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, pricingRes, paymentRes] = await Promise.allSettled([
        api.applySettings.get(),
        api.pricing.get(),
        api.paymentSettings.get()
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value?.success && settingsRes.value?.settings?.modalSettings) {
        setModalSettings(settingsRes.value.settings.modalSettings || {});
      }

      if (pricingRes.status === 'fulfilled' && pricingRes.value?.success && pricingRes.value?.pricing?.subscriptionPackages) {
        const pkgs = pricingRes.value.pricing.subscriptionPackages.filter((p: any) => p && p.enabled);
        setPricingPackages(pkgs);

        const validPrices: number[] = [];
        for (const pkg of pkgs) {
          const raw = pkg.pricePkr;
          if (raw !== null && raw !== undefined && raw !== '') {
            const parsed = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
            if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) {
              validPrices.push(parsed);
            }
          }
        }
        if (validPrices.length > 0) {
          setLowestPricePkr(Math.min(...validPrices));
        } else {
          setLowestPricePkr(null);
        }
      }

      if (paymentRes.status === 'fulfilled' && paymentRes.value?.success && paymentRes.value?.settings?.methods) {
        const enabledMethods = Object.entries(paymentRes.value.settings.methods)
          .filter(([_, m]: [string, any]) => m && m.enabled && m.accountNumber)
          .map(([k, m]: [string, any]) => ({ id: k, ...m }));
        setConfiguredPaymentMethods(enabledMethods);
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

  const handleResetModalFields = async (modalId: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.applySettings.update({
        modalSettings: {
          [modalId]: {}
        }
      });
      if (res && res.success) {
        setModalSettings((prev) => ({
          ...prev,
          [modalId]: {}
        }));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        setSaveError(res?.message || 'Failed to reset modal customizations.');
      }
    } catch (err: any) {
      console.error('Error resetting modal settings:', err);
      setSaveError(err?.message || 'Failed to reset modal customizations.');
    } finally {
      setSaving(false);
      setShowResetConfirm(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveError(null);

    // Strict Frontend Pre-Validation
    for (const modalDef of MODAL_INVENTORY) {
      const modalCustoms = modalSettings[modalDef.id] || {};
      for (const field of modalDef.fields) {
        const val = modalCustoms[field.key];
        if (val !== undefined && typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.length > 500) {
            setSaveError(`Field "${field.label}" in "${modalDef.name}" exceeds maximum allowed length of 500 characters.`);
            setSaving(false);
            return;
          }
          if (/<[a-z/!]/i.test(trimmed)) {
            setSaveError(`Field "${field.label}" in "${modalDef.name}" contains forbidden HTML/XML markup. Please enter plain text only.`);
            setSaving(false);
            return;
          }
          if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
            setSaveError(`Field "${field.label}" in "${modalDef.name}" contains unsafe control characters.`);
            setSaving(false);
            return;
          }
          if (modalDef.id === 'cvPaywall' && field.key === 'priceDisplay' && trimmed.length > 0) {
            if (/(?:pkr|rs\.?|usd|\$|€|£|₹|\b\d+(?:[.,]\d+)?\s*(?:pkr|rs|rupees))\b/i.test(trimmed) || /^\s*\d+/.test(trimmed)) {
              setSaveError('Fixed prices cannot be displayed because single CV exports do not have a separate fixed transaction price. Please use an informational note such as "Price confirmed during payment".');
              setSaving(false);
              return;
            }
          }
        }
      }
    }

    try {
      const res = await api.applySettings.update({
        modalSettings
      });
      if (res && res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
        if (res.settings?.modalSettings) {
          setModalSettings(res.settings.modalSettings);
        }
      } else {
        setSaveError(res?.message || 'Failed to save modal customizations.');
      }
    } catch (err: any) {
      console.error('Error saving modal settings:', err);
      setSaveError(err?.message || 'Failed to save modal customizations.');
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

  const getPreviewValue = (key: string, defaultVal: string) => {
    const val = activeModalCustoms[key];
    return (val !== undefined && val.trim() !== '') ? val : defaultVal;
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
          {saveError && (
            <span className="flex items-center space-x-1.5 text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 px-3.5 py-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </span>
          )}

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
          <div className="bg-[#05130e] border border-emerald-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-emerald-500/20 pb-3 gap-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                <Eye className="w-4 h-4" />
                <span>Live Real-Time Modal Preview</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  🟢 Admin Editable
                </span>
                <span className="text-sky-400 font-mono bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">
                  🔵 Dynamic Data
                </span>
                <span className="text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  🟡 Illustrative Sample
                </span>
              </div>
            </div>

            {/* PREVIEW 1: Premium Upgrade Modal */}
            {activeModalDef.id === 'premiumUpgrade' && (
              <div className="relative bg-[#05130e] border border-emerald-500/30 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.18)] overflow-hidden text-center max-w-md mx-auto">
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400" />
                <div className="p-4 sm:p-5 bg-gradient-to-b from-[#081f17] to-[#05130e] border-b border-emerald-500/20 relative">
                  <div className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-900/90 text-slate-400 border border-emerald-500/20">
                    <X className="w-4 h-4" />
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-2.5 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Crown className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h4 className="text-lg font-black text-white mb-1">
                    {getPreviewValue('customTitle', 'Unlock Premium Access')}
                  </h4>
                  <p className="text-xs text-emerald-100/70 leading-relaxed max-w-sm mx-auto">
                    {getPreviewValue('customMessage', 'Upgrade your account to apply for jobs and unlock all premium portal features.')}
                  </p>
                </div>

                <div className="p-4 space-y-2.5 text-left bg-[#05130e]">
                  <div className="flex items-start space-x-3 p-2.5 bg-[#081a14] rounded-xl border border-emerald-500/20">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shrink-0">
                      <Zap className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{getPreviewValue('benefit1Title', 'Direct Application URLs')}</div>
                      <div className="text-[11px] text-emerald-100/60 leading-tight mt-0.5">{getPreviewValue('benefit1Desc', 'Instant 1-click access to official department & portal application links.')}</div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-2.5 bg-[#081a14] rounded-xl border border-emerald-500/20">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{getPreviewValue('benefit2Title', 'Official Gazette & Source PDFs')}</div>
                      <div className="text-[11px] text-emerald-100/60 leading-tight mt-0.5">{getPreviewValue('benefit2Desc', 'Download original recruitment circulars and newspaper ads.')}</div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-2.5 bg-[#081a14] rounded-xl border border-emerald-500/20">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shrink-0">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{getPreviewValue('benefit3Title', 'Priority Member Access')}</div>
                      <div className="text-[11px] text-emerald-100/60 leading-tight mt-0.5">{getPreviewValue('benefit3Desc', 'Unlock full department details and priority vacancy listings.')}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#040f0b] border-t border-emerald-500/20 space-y-2">
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 text-slate-950 font-black text-xs shadow-md flex items-center justify-center space-x-1.5 cursor-default"
                  >
                    <span>
                      {getPreviewValue('ctaText', 'Upgrade to Premium')}
                      {lowestPricePkr !== null ? ` — From Rs. ${lowestPricePkr}` : ' — View Available Plans'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-950 shrink-0" />
                  </button>
                  <div className="text-[10px] text-emerald-400/80 flex items-center justify-center space-x-1 pt-0.5">
                    <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Dynamic lowest plan from Pricing Engine: {lowestPricePkr !== null ? `Rs. ${lowestPricePkr}` : 'Configure in Pricing Engine'}</span>
                  </div>
                  <p className="text-[10px] text-emerald-100/50 flex items-center justify-center space-x-1">
                    <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{getPreviewValue('footerNote', 'Access activated upon admin verification • Easy Online Subscriptions')}</span>
                  </p>
                </div>
              </div>
            )}

            {/* PREVIEW 2: Candidate Application Modal */}
            {activeModalDef.id === 'candidateApplication' && (
              <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto text-white">
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-0.5">
                      <Sparkles className="w-3 h-3" />
                      <span>{getPreviewValue('title', 'Submit Job Application')}</span>
                    </div>
                    <h4 className="text-sm font-black text-white">Senior Full Stack Engineer</h4>
                    <p className="text-[11px] text-slate-400">Techlogix Pakistan • Islamabad / Remote</p>
                  </div>
                  <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                    <X className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center space-x-2 text-[10px] text-amber-300">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold block">Illustrative Preview Data — Not Real Records</span>
                      <span>Sample candidate fields demonstrate applicant submission experience.</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                    {getPreviewValue('instructions', 'Complete the verified application details below. The hiring employer or department will review your credentials directly.')}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        {getPreviewValue('contactHeading', 'Candidate Contact Credentials')}
                      </label>
                      <span className="text-[9px] text-amber-400/80 font-mono">Sample Form Inputs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-[11px]">
                        Muhammad Ali
                      </div>
                      <div className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-[11px]">
                        ali@example.com
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        {getPreviewValue('resumeHeading', 'Resume / Curriculum Vitae Attachment')}
                      </label>
                      <span className="text-[9px] text-amber-400/80 font-mono">Sample Attachment</span>
                    </div>
                    <div className="p-3 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center flex items-center justify-center space-x-2 text-slate-400">
                      <UploadCloud className="w-4 h-4 text-amber-400" />
                      <span className="text-[11px]">Ali_Resume_2026.pdf (Sample Ready)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shadow-md flex items-center justify-center space-x-1.5 cursor-default mt-2"
                  >
                    <Send className="w-3.5 h-3.5 text-slate-950" />
                    <span>{getPreviewValue('submitCta', 'Submit Application Now')}</span>
                  </button>

                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start space-x-2 text-[10px] text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block">Success Message Preview:</span>
                      <span>{getPreviewValue('successMsg', 'Your application has been received successfully and forwarded to the hiring team!')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW 3: Subscription / Payment Modal */}
            {activeModalDef.id === 'subscription' && (
              <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto text-white">
                <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
                  <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold mb-2">
                    <Zap className="w-3 h-3" />
                    <span>{getPreviewValue('badgeText', 'WhatsApp Alerts & Direct Apply Access')}</span>
                  </div>
                  <h4 className="text-base font-black text-white leading-snug">
                    {getPreviewValue('title', 'Get Daily Job Alerts & Direct Application Access')}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {getPreviewValue('subtitle', 'Subscribe once to receive daily verified remote & hybrid job openings directly on WhatsApp and apply instantly with 1-click.')}
                  </p>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {getPreviewValue('packageSectionTitle', 'Select Subscription Package')}
                      </label>
                      <span className="text-[9px] text-sky-400 font-mono bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                        {pricingPackages.length > 0 ? 'Live Pricing Engine' : 'Sample Indicative'}
                      </span>
                    </div>
                    {pricingPackages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {pricingPackages.slice(0, 2).map((pkg: any, idx: number) => (
                          <div
                            key={pkg.id || idx}
                            className={`p-2.5 rounded-xl border ${
                              idx === 0
                                ? 'border-2 border-emerald-500 bg-emerald-500/10 text-white'
                                : 'border-slate-800 bg-slate-950 text-slate-400'
                            }`}
                          >
                            <div className="flex justify-between items-center text-[11px] font-bold">
                              <span>{pkg.name}</span>
                              {pkg.badge && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                                  {pkg.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-black text-emerald-400 mt-0.5">
                              PKR {pkg.pricePkr} <span className="text-[9px] font-normal text-slate-400">/ {pkg.durationDays} days</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1">
                        <div className="text-[11px] font-semibold text-amber-300">
                          Illustrative Sample Packages — Configure in Pricing Manager
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="p-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-white text-left">
                            <div className="text-[10px] font-bold">Pro Alerts</div>
                            <div className="text-xs font-black text-emerald-400">PKR 1,200 <span className="text-[8px] text-slate-400">/ 30 days</span></div>
                          </div>
                          <div className="p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 text-left">
                            <div className="text-[10px] font-bold">VIP Executive</div>
                            <div className="text-xs font-black text-slate-300">PKR 3,000 <span className="text-[8px] text-slate-500">/ 45 days</span></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    {configuredPaymentMethods.length > 0 ? (
                      <>
                        <div className="flex justify-between items-center text-emerald-300 font-bold">
                          <span className="flex items-center space-x-1">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{configuredPaymentMethods[0].name} (Live Channel)</span>
                          </span>
                          <span className="text-[9px] text-sky-400 font-mono bg-sky-500/10 px-1 rounded">Live Account</span>
                        </div>
                        <div className="text-slate-300 text-[11px]">
                          Account: <span className="text-emerald-400 font-mono font-bold">{configuredPaymentMethods[0].accountNumber}</span>
                          {configuredPaymentMethods[0].accountTitle ? ` (${configuredPaymentMethods[0].accountTitle})` : ''}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-amber-300 font-bold">
                          <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Receiving Accounts (Configured in Payment Settings)</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Active receiving accounts and verified deposit instructions dynamically appear here from Payment Settings.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-black text-xs shadow-md flex items-center justify-center space-x-1.5 cursor-default"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-950" />
                    <span>{getPreviewValue('submitCta', 'Submit Payment Proof for Verification')}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
                  </button>

                  <p className="text-[10px] text-center text-slate-500 flex items-center justify-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Manual payment review: verified by portal admin before activation.</span>
                  </p>
                </div>
              </div>
            )}

            {/* PREVIEW 4: CV Download Paywall Modal */}
            {activeModalDef.id === 'cvPaywall' && (
              <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 text-white text-center max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
                  <Lock className="w-6 h-6" />
                </div>

                <h4 className="text-base font-black text-white">
                  {getPreviewValue('title', 'Unlock Premium HD PDF Download')}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  {getPreviewValue('subtitle', 'Download your watermark-free, high-resolution vector PDF resume formatted for corporate applications.')}
                </p>

                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">
                      {getPreviewValue('packageTitle', 'Premium CV Export')}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      {getPreviewValue('priceDisplay', 'Price confirmed during payment')}
                    </span>
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-1">
                    <li className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{getPreviewValue('bullet1', 'Clean Vector Print Layout')}</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{getPreviewValue('bullet2', 'Standard ATS Compatible Structure')}</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{getPreviewValue('bullet3', 'Included free with Pro Job Alerts Subscription')}</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-extrabold text-xs shadow-md flex items-center justify-center space-x-1.5 cursor-default"
                >
                  <span>{getPreviewValue('ctaText', 'Upgrade to Pro / Export Resume')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
                </button>
                <p className="text-[10px] text-slate-500">
                  {getPreviewValue('footerNote', 'Payment verification via Easypaisa, JazzCash & Bank Transfer')}
                </p>
              </div>
            )}

            {/* PREVIEW 5: Candidate Authentication Modal */}
            {activeModalDef.id === 'authModal' && (
              <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 text-white max-w-md mx-auto space-y-4">
                {/* Mode Switcher Tabs */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAuthPreviewTab('register')}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      authPreviewTab === 'register'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {getPreviewValue('registerTab', 'Create Free Account')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthPreviewTab('login')}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      authPreviewTab === 'login'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {getPreviewValue('loginTab', 'Sign In')}
                  </button>
                </div>

                {/* Header */}
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mx-auto mb-2 text-slate-950">
                    <User className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-black text-white">
                    {authPreviewTab === 'login'
                      ? getPreviewValue('loginTitle', 'Welcome Back to Career Portal')
                      : getPreviewValue('registerTitle', 'Create Candidate Profile')}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Access remote job alerts, job posting tools, and two-way messaging.
                  </p>
                </div>

                {authPreviewTab === 'register' && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-300 flex items-center space-x-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Single Registration: Full access to build CVs, browse jobs, and post jobs.</span>
                  </div>
                )}

                {/* Simulated Fields */}
                <div className="space-y-2 text-xs">
                  {authPreviewTab === 'register' && (
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-[11px]">
                      Full Name: Muhammad Ali
                    </div>
                  )}
                  <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-[11px] flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>ali@example.com</span>
                  </div>
                  <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-[11px] flex items-center space-x-2">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>••••••••</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shadow-md flex items-center justify-center space-x-1.5 cursor-default"
                >
                  <span>
                    {authPreviewTab === 'login'
                      ? getPreviewValue('loginCta', 'Sign In to Candidate Dashboard')
                      : getPreviewValue('registerCta', 'Register Free Account')}
                  </span>
                </button>
              </div>
            )}

            {/* PREVIEW 6: Admin Login Modal */}
            {activeModalDef.id === 'adminLogin' && (
              <div className="relative bg-slate-900 border border-amber-500/40 rounded-2xl shadow-xl p-5 text-white text-center max-w-sm mx-auto space-y-4">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>

                <div>
                  <h4 className="text-base font-black text-white">
                    {getPreviewValue('title', 'System Administrator Authentication')}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {getPreviewValue('subtitle', 'Restricted Portal Access')}
                  </p>
                </div>

                <div className="space-y-2 text-left text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1">Admin Email</label>
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>admin@jobportal.com</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1">Admin Password</label>
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs flex items-center space-x-2">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>••••••••••••</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-md flex items-center justify-center space-x-1.5 cursor-default"
                >
                  <span>{getPreviewValue('ctaText', 'Authenticate & Launch Dashboard')}</span>
                </button>
              </div>
            )}

            {/* PREVIEW 7: Country Selection Modal */}
            {activeModalDef.id === 'countrySelection' && (
              <div className="relative bg-slate-900 border border-amber-500/30 rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto text-white">
                <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-xs font-black text-white">
                          {getPreviewValue('title', 'Welcome to Hybrid Job Portal')}
                        </h4>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Step 1
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {getPreviewValue('subtitle', 'Select your country / region to view localized vacancies and currency.')}
                      </p>
                    </div>
                  </div>
                  <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="p-3.5 space-y-2.5 text-xs">
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-[11px] flex items-center space-x-2">
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                    <span>Search country / ملک تلاش کریں...</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2 rounded-xl border border-amber-500 bg-amber-500/10 text-white flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🇵🇰</span>
                        <div>
                          <div className="text-[11px] font-bold">Pakistan</div>
                          <div className="text-[9px] text-slate-400">پاکستان</div>
                        </div>
                      </div>
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="p-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 flex items-center space-x-2">
                      <span className="text-lg">🇸🇦</span>
                      <div>
                        <div className="text-[11px] font-bold">Saudi Arabia</div>
                        <div className="text-[9px] text-slate-400">سعودی عرب</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Header regional switcher active</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center space-x-1 cursor-default"
                  >
                    <span>{getPreviewValue('ctaText', 'Continue to Job Portal')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* PREVIEW 8: Legal Disclaimer Modal */}
            {activeModalDef.id === 'legalDisclaimer' && (
              <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto text-white">
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-xs font-black text-white">
                          {getPreviewValue('title', 'Portal Terms, Privacy & Legal Guidelines')}
                        </h4>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Verified
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {getPreviewValue('subtitle', 'Independent Listings Disclaimer & Compliance Center')}
                      </p>
                    </div>
                  </div>
                  <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center space-x-2 text-[10px] text-amber-300">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold block">Illustrative Legal Summary Preview</span>
                      <span>Full legal documentation and policies are configured in the Legal Center.</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] leading-relaxed space-y-1">
                    <div className="flex items-center space-x-1.5 text-amber-400 font-bold uppercase text-[10px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Notice</span>
                    </div>
                    <p>
                      {getPreviewValue('noticeText', 'All jobs and advertisements listed on this platform are independent of the websites and should be pursued at your own risk. We are not responsible for any investments or applications made.')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-slate-400">
                      <div className="font-bold text-white mb-0.5 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Third-Party Recruiter</span>
                      </div>
                      <span>Independent listings</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-slate-400">
                      <div className="font-bold text-white mb-0.5 flex items-center space-x-1">
                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                        <span>No Direct Affiliation</span>
                      </div>
                      <span>Trademarks belong to owners</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center space-x-1 text-[10px]">
                    <Info className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Cybersecurity guidelines</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-xs cursor-default"
                  >
                    <span>{getPreviewValue('acceptCta', 'I Understand & Accept Terms')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
