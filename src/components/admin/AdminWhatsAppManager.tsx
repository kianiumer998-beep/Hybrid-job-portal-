import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Phone,
  Send,
  Save,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Copy,
  Sliders,
  Layers,
  Smartphone,
  Monitor,
  Clock,
  Bell,
  Zap,
  AlertCircle
} from 'lucide-react';
import {
  WhatsAppSupportConfig,
  DEFAULT_WHATSAPP_CONFIG,
  isSampleWhatsAppPhone,
  normalizeWhatsAppPhone,
  isValidWhatsAppPhone,
  isSampleWhatsAppGroupLink,
  isValidWhatsAppGroupLink,
  buildWhatsAppChatUrl
} from '../WhatsAppStickyButton';

interface AdminWhatsAppManagerProps {
  config: WhatsAppSupportConfig;
  onUpdateConfig: (updated: WhatsAppSupportConfig) => Promise<boolean | any> | boolean | any;
  subscribersCount?: number;
}

const isRealWhatsAppGroupLink = (link?: string | null): boolean => {
  return isValidWhatsAppGroupLink(link);
};

export const LEGACY_WHATSAPP_GROUP_LINK_KEY = 'hybrid_whatsapp_group_link';

export function resolveInitialWhatsAppFormData(
  config?: Partial<WhatsAppSupportConfig> | null
): WhatsAppSupportConfig {
  let resolvedGroupLink = isRealWhatsAppGroupLink(config?.groupLink) ? config!.groupLink!.trim() : '';
  if (!resolvedGroupLink) {
    try {
      const legacy = localStorage.getItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
      if (isRealWhatsAppGroupLink(legacy)) {
        resolvedGroupLink = legacy!.trim();
      }
    } catch {}
  }
  const safePhone = isSampleWhatsAppPhone(config?.phoneNumber)
    ? ''
    : (config?.phoneNumber || '');
  return {
    ...DEFAULT_WHATSAPP_CONFIG,
    ...(config || {}),
    phoneNumber: safePhone,
    enabled: Boolean(config?.enabled && isValidWhatsAppPhone(safePhone)),
    groupLink: resolvedGroupLink
  };
}

export function syncWhatsAppFormWithConfig(
  prev: WhatsAppSupportConfig,
  config: WhatsAppSupportConfig,
  hasAttemptedMigration: boolean
): WhatsAppSupportConfig {
  const resolvedPhone = isSampleWhatsAppPhone(config.phoneNumber)
    ? ''
    : (config.phoneNumber || '');
  const resolvedLink = isRealWhatsAppGroupLink(config.groupLink)
    ? config.groupLink!.trim()
    : (isRealWhatsAppGroupLink(prev.groupLink) && hasAttemptedMigration
        ? prev.groupLink!
        : '');
  return {
    ...DEFAULT_WHATSAPP_CONFIG,
    ...prev,
    ...config,
    phoneNumber: resolvedPhone,
    enabled: Boolean(config.enabled && isValidWhatsAppPhone(resolvedPhone)),
    groupLink: resolvedLink
  };
}

export async function runLegacyGroupMigration(params: {
  config?: WhatsAppSupportConfig | null;
  hasAttemptedMigrationRef: { current: boolean };
  isRestoringDefaultsRef?: { current: boolean };
  onUpdateConfig: (updated: WhatsAppSupportConfig) => Promise<boolean | any> | boolean | any;
  setFormData: React.Dispatch<React.SetStateAction<WhatsAppSupportConfig>>;
}): Promise<boolean> {
  const { config, hasAttemptedMigrationRef, isRestoringDefaultsRef, onUpdateConfig, setFormData } = params;
  if (hasAttemptedMigrationRef.current || isRestoringDefaultsRef?.current) return false;

  // Rule 1 & 3: Existing MongoDB saved Group Link must always take priority over legacy LocalStorage
  if (isRealWhatsAppGroupLink(config?.groupLink)) {
    return false;
  }

  let legacyLink: string | null = null;
  try {
    legacyLink = localStorage.getItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
  } catch {}

  // Rule 2 & 7: If MongoDB has no saved Group Link and a valid legacy LocalStorage value exists (not placeholder), migrate it to MongoDB
  if (isRealWhatsAppGroupLink(legacyLink)) {
    hasAttemptedMigrationRef.current = true;
    const validLink = legacyLink!.trim();
    const sanitizedPhone = normalizeWhatsAppPhone(config?.phoneNumber);
    const payload: WhatsAppSupportConfig = {
      ...DEFAULT_WHATSAPP_CONFIG,
      ...(config || {}),
      phoneNumber: sanitizedPhone,
      enabled: Boolean(config?.enabled && sanitizedPhone),
      groupLink: validLink
    };

    try {
      const res = await Promise.resolve(onUpdateConfig(payload));
      // Rule 5: Treat migration as successful only when the backend explicitly confirms success.
      // Do not delete legacy LocalStorage on undefined, malformed, or unsuccessful responses.
      const isSuccess = Boolean(
        res === true || (res && typeof res === 'object' && res.success === true)
      );
      if (isSuccess) {
        try {
          localStorage.removeItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
        } catch {}
        setFormData(prev => ({
          ...prev,
          groupLink: validLink,
          ...(res?.whatsAppSupportConfig || {})
        }));
        return true;
      } else {
        // Rule 6: Retain legacy value and report failure safely if migration fails
        console.warn('[AdminWhatsAppManager] Backend did not confirm group link migration. Legacy LocalStorage value retained.');
        return false;
      }
    } catch (err: any) {
      // Rule 6: Retain legacy value and report failure safely if migration fails
      console.warn('[AdminWhatsAppManager] Failed to migrate legacy Group Link to MongoDB:', err);
      return false;
    }
  }

  return false;
}

export async function executeRestoreWhatsAppDefaults(params: {
  onUpdateConfig: (updated: WhatsAppSupportConfig) => Promise<boolean | any> | boolean | any;
  hasAttemptedMigrationRef: { current: boolean };
  isRestoringDefaultsRef: { current: boolean };
  setFormData: React.Dispatch<React.SetStateAction<WhatsAppSupportConfig>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSavedSuccess: React.Dispatch<React.SetStateAction<boolean>>;
}): Promise<boolean> {
  const {
    onUpdateConfig,
    hasAttemptedMigrationRef,
    isRestoringDefaultsRef,
    setFormData,
    setSaveError,
    setIsSaving,
    setSavedSuccess
  } = params;

  setSaveError(null);
  setIsSaving(true);
  isRestoringDefaultsRef.current = true;
  try {
    const result = await onUpdateConfig(DEFAULT_WHATSAPP_CONFIG);
    const isRestoreSuccess = Boolean(
      result === true || (result && typeof result === 'object' && result.success === true)
    );
    if (!isRestoreSuccess) {
      setSaveError('Failed to restore defaults on server. Form values retained.');
      return false;
    }
    try {
      localStorage.removeItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
    } catch {}
    hasAttemptedMigrationRef.current = true;
    setFormData({ ...DEFAULT_WHATSAPP_CONFIG });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    return true;
  } catch (err: any) {
    setSaveError(err?.message || 'Error resetting WhatsApp configuration.');
    return false;
  } finally {
    isRestoringDefaultsRef.current = false;
    setIsSaving(false);
  }
}

export const AdminWhatsAppManager: React.FC<AdminWhatsAppManagerProps> = ({
  config,
  onUpdateConfig,
  subscribersCount = 0
}) => {
  const [formData, setFormData] = useState<WhatsAppSupportConfig>(() =>
    resolveInitialWhatsAppFormData(config)
  );

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [testUrduMessage, setTestUrduMessage] = useState(
    'السلام علیکم! کیریئر پاک پر جاب الرٹس اور اپلائی کرنے کے لیے رہنمائی درکار ہے۔'
  );

  const hasAttemptedMigrationRef = useRef(false);
  const isRestoringDefaultsRef = useRef(false);

  // Safe migration of legacy LocalStorage group link to MongoDB
  useEffect(() => {
    void runLegacyGroupMigration({
      config,
      hasAttemptedMigrationRef,
      isRestoringDefaultsRef,
      onUpdateConfig,
      setFormData
    });
  }, [config, onUpdateConfig]);

  // Keep local state in sync if parent config prop updates
  useEffect(() => {
    if (config) {
      setFormData(prev =>
        syncWhatsAppFormWithConfig(prev, config, hasAttemptedMigrationRef.current)
      );
    }
  }, [config]);

  const cleanPhone = normalizeWhatsAppPhone(formData.phoneNumber);
  const hasValidPhone = Boolean(cleanPhone);
  const testChatUrl = buildWhatsAppChatUrl(cleanPhone, formData.defaultMessage || DEFAULT_WHATSAPP_CONFIG.defaultMessage);
  const testUrduChatUrl = buildWhatsAppChatUrl(cleanPhone, testUrduMessage);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      const trimmedPhone = (formData.phoneNumber || '').trim();
      if (trimmedPhone && isSampleWhatsAppPhone(trimmedPhone)) {
        setSaveError('Validation Error: Placeholder or sample WhatsApp phone numbers are not allowed. Please enter your official WhatsApp business number.');
        setIsSaving(false);
        return;
      }

      if (formData.enabled && !isValidWhatsAppPhone(trimmedPhone)) {
        setSaveError('Validation Error: Please enter a valid international WhatsApp phone number (8-15 digits with country code) before enabling the widget.');
        setIsSaving(false);
        return;
      }

      if (!formData.enabled && trimmedPhone && !isValidWhatsAppPhone(trimmedPhone)) {
        setSaveError('Validation Error: Please enter a valid international WhatsApp phone number (8-15 digits with country code) or clear the field while disabled.');
        setIsSaving(false);
        return;
      }

      const trimmedLink = (formData.groupLink || '').trim();
      if (trimmedLink) {
        if (isSampleWhatsAppGroupLink(trimmedLink)) {
          setSaveError('Validation Error: Sample WhatsApp group invite links are not allowed.');
          setIsSaving(false);
          return;
        }
        if (!isValidWhatsAppGroupLink(trimmedLink)) {
          setSaveError('Validation Error: Please enter a valid HTTPS WhatsApp group invite link using hostname chat.whatsapp.com (e.g., https://chat.whatsapp.com/yourGroupCode).');
          setIsSaving(false);
          return;
        }
      }

      const normalizedPayload: WhatsAppSupportConfig = {
        ...formData,
        phoneNumber: trimmedPhone ? normalizeWhatsAppPhone(trimmedPhone) : '',
        groupLink: trimmedLink
      };

      const result = await onUpdateConfig(normalizedPayload);
      const isSaveSuccess = Boolean(
        result === true || (result && typeof result === 'object' && result.success === true)
      );
      if (!isSaveSuccess) {
        setSaveError(
          (result && typeof result === 'object' && result.message) ||
            'Failed to save WhatsApp support configuration to server. Form values retained.'
        );
        setIsSaving(false);
        return;
      }

      // If user saved successfully, clear legacy LocalStorage on confirmed save
      try {
        localStorage.removeItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
      } catch {}

      // Use authoritative server state returned by MongoDB if available
      if (result && typeof result === 'object') {
        const updatedCfg = result.whatsAppSupportConfig || result;
        if (updatedCfg && typeof updatedCfg === 'object') {
          setFormData(prev => ({
            ...DEFAULT_WHATSAPP_CONFIG,
            ...prev,
            ...updatedCfg
          }));
        }
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Error saving WhatsApp configuration to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefaults = async () => {
    await executeRestoreWhatsAppDefaults({
      onUpdateConfig,
      hasAttemptedMigrationRef,
      isRestoringDefaultsRef,
      setFormData,
      setSaveError,
      setIsSaving,
      setSavedSuccess
    });
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <MessageCircle className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  WhatsApp Support & Alert Streams Manager
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  واٹس ایپ ایڈمن کنٹرول
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Add, customize, and verify your official WhatsApp Support Number, Community Group Links, auto-reply greetings, bubble prompts, and floating widget sizes across the entire portal.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {testChatUrl ? (
              <a
                href={testChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center space-x-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Test Live WhatsApp Chat</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Enter a valid international WhatsApp phone number to enable live chat testing"
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-500 border border-slate-700 font-black text-xs flex items-center space-x-2 opacity-60 cursor-not-allowed"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Test Live WhatsApp Chat</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500 rounded-2xl p-4 flex items-center space-x-3 text-emerald-300 text-sm font-bold shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>WhatsApp configuration saved successfully! (سیٹنگز محفوظ ہوگئیں)</span>
        </div>
      )}

      {saveError && (
        <div className="bg-rose-950/80 border border-rose-500 rounded-2xl p-4 flex items-center space-x-3 text-rose-300 text-sm font-bold shadow-lg animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Settings Form Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1: Phone & Agent Contact Details */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>1. Official Support WhatsApp Number & Contact (واٹس ایپ نمبر)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Official WhatsApp Number (Country code included) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-500 font-bold text-xs">+</span>
                  <input
                    type="text"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="e.g. 923XXXXXXXXX (country code + number)"
                    required={Boolean(formData.enabled)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  International format without spaces or symbols (8–15 digits including country code).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Support Representative / Agent Name *
                </label>
                <input
                  type="text"
                  value={formData.agentName}
                  onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                  placeholder="e.g. Ayesha (Lead HR Advisor)"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Displayed on the floating chat tooltip bubble for visitors.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Support Hours & Availability Label
              </label>
              <input
                type="text"
                value={formData.supportHoursText}
                onChange={(e) => setFormData({ ...formData, supportHoursText: e.target.value })}
                placeholder="e.g. Online • 9:00 AM - 9:00 PM PKT"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Default Pre-Filled Message for Candidates (Sent on WhatsApp click)
              </label>
              <textarea
                rows={2}
                value={formData.defaultMessage}
                onChange={(e) => setFormData({ ...formData, defaultMessage: e.target.value })}
                placeholder="Hello! I need assistance regarding job applications on HybridJobs.pk..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                This is the pre-populated URL query message when the candidate arrives inside WhatsApp.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Official WhatsApp Community / Daily Job Alerts Group Link
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="url"
                  value={formData.groupLink || ''}
                  onChange={(e) => setFormData({ ...formData, groupLink: e.target.value })}
                  placeholder="https://chat.whatsapp.com/..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(formData.groupLink || '')}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Subscribers who purchase WhatsApp Job Alert Stream will receive this invite link upon confirmation.
              </p>
            </div>
          </div>

          {/* SECTION 2: Widget & Greeting Bubble Customization */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>2. Widget & Greeting Customization</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* WhatsApp Widget Enable/Disable */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-black text-white">WhatsApp Widget</div>
                  <div className="text-[11px] text-slate-400">Show button on public pages</div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {formData.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

              {/* Greeting Bubble Enable/Disable */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-black text-white">Greeting Bubble</div>
                  <div className="text-[11px] text-slate-400">Show prompt tooltip bubble</div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {formData.showGreetingBubble !== false ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showGreetingBubble !== false}
                      onChange={(e) => setFormData({ ...formData, showGreetingBubble: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

              {/* Screen Corner Position */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-black text-white">Screen Position</div>
                  <div className="text-[11px] text-slate-400">Corner layout position</div>
                </div>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="bottom-right">Bottom-Right (Standard)</option>
                  <option value="bottom-left">Bottom-Left</option>
                </select>
              </div>
            </div>

            {/* Visible Greeting Text & CTA Button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Greeting Bubble Message (Visible in floating prompt)
                </label>
                <textarea
                  rows={2}
                  value={formData.greetingText ?? DEFAULT_WHATSAPP_CONFIG.greetingText}
                  onChange={(e) => setFormData({ ...formData, greetingText: e.target.value })}
                  placeholder="Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Greeting CTA Button Label
                </label>
                <input
                  type="text"
                  value={formData.greetingCtaText ?? DEFAULT_WHATSAPP_CONFIG.greetingCtaText}
                  onChange={(e) => setFormData({ ...formData, greetingCtaText: e.target.value })}
                  placeholder="Start WhatsApp Chat"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors mb-2"
                />
                <p className="text-[10px] text-slate-400">
                  Button text inside the speech bubble prompt.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Behavior & Animations */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>3. Behavior, Delays & Badge Toggles</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Auto-Show Delay */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <label className="text-xs font-bold">Auto-Show Delay</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="0.5"
                    value={formData.autoShowDelaySeconds ?? 4.5}
                    onChange={(e) => setFormData({ ...formData, autoShowDelaySeconds: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs text-slate-400 font-bold">sec</span>
                </div>
                <p className="text-[10px] text-slate-500">Delay before bubble opens.</p>
              </div>

              {/* Online Notification Badge */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Bell className="w-3.5 h-3.5 text-emerald-400" />
                  <label className="text-xs font-bold">Online Badge '1'</label>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {formData.showOnlineBadge !== false ? 'SHOW BADGE' : 'HIDE BADGE'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showOnlineBadge !== false}
                      onChange={(e) => setFormData({ ...formData, showOnlineBadge: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

              {/* Pulse Aura Animation */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <label className="text-xs font-bold">Aura Pulse Animation</label>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {formData.enablePulseAnimation !== false ? 'ANIMATION ON' : 'ANIMATION OFF'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enablePulseAnimation !== false}
                      onChange={(e) => setFormData({ ...formData, enablePulseAnimation: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Size & Dimension Presets */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>4. Widget & Icon Size Customization</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Mobile Size */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <label className="text-xs font-bold">Mobile Size</label>
                </div>
                <select
                  value={formData.mobileSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, mobileSize: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (48px)</option>
                  <option value="standard">Standard (56px)</option>
                  <option value="large">Large (64px)</option>
                </select>
              </div>

              {/* Desktop Size */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                  <label className="text-xs font-bold">Desktop Size</label>
                </div>
                <select
                  value={formData.desktopSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, desktopSize: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (56px)</option>
                  <option value="standard">Standard (64px)</option>
                  <option value="large">Large (80px)</option>
                </select>
              </div>

              {/* Icon Size */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <label className="text-xs font-bold">Icon Size</label>
                </div>
                <select
                  value={formData.iconSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, iconSize: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                </select>
              </div>

              {/* Bubble Size */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <label className="text-xs font-bold">Bubble Size</label>
                </div>
                <select
                  value={formData.bubbleSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, bubbleSize: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (280px)</option>
                  <option value="standard">Standard (320px)</option>
                  <option value="large">Large (380px)</option>
                </select>
              </div>
            </div>

            {/* ACTION BUTTONS ROW */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Restore Defaults</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'Saving to Server...' : 'Save & Apply WhatsApp Configuration'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Preview & Quick Test */}
        <div className="space-y-6">
          {/* Live Mobile Widget Mockup */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Widget Preview</span>
              </h4>
              <div className="flex items-center space-x-1">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  formData.enabled 
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}>
                  {formData.enabled ? 'Widget Active' : 'Widget Off'}
                </span>
              </div>
            </div>

            {/* Bubble Mockup */}
            {formData.showGreetingBubble !== false ? (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm relative">
                    💬
                    {formData.showOnlineBadge !== false && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border border-slate-900" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">{formData.agentName || 'Career Support'}</div>
                    <div className="text-[10px] text-slate-400">{formData.supportHoursText}</div>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-snug">
                  "{formData.greetingText || DEFAULT_WHATSAPP_CONFIG.greetingText}"
                </div>

                <div className="pt-1">
                  <button type="button" className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center space-x-1">
                    <Send className="w-3 h-3" />
                    <span>{formData.greetingCtaText || 'Start WhatsApp Chat'}</span>
                  </button>
                </div>

                <div className="text-center">
                  <span className={`text-[10px] font-mono ${hasValidPhone ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {hasValidPhone ? `+${cleanPhone}` : 'No valid WhatsApp number configured'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center text-xs text-slate-400 space-y-1">
                <p className="font-bold text-amber-400">Greeting Bubble Disabled</p>
                <p className="text-[11px]">The sticky button will open WhatsApp directly without showing the speech bubble.</p>
              </div>
            )}

            {/* Urdu Quick Test Message */}
            <div className="pt-2 space-y-2 border-t border-slate-800">
              <label className="block text-[11px] font-bold text-slate-300">
                Urdu Test Message (اردو ٹیسٹ میسج)
              </label>
              <textarea
                rows={2}
                value={testUrduMessage}
                onChange={(e) => setTestUrduMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 resize-none font-urdu text-right"
                dir="rtl"
              />
              {testUrduChatUrl ? (
                <a
                  href={testUrduChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Send Urdu Greeting on WhatsApp</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Enter a valid international WhatsApp phone number to enable Urdu test chat"
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 text-slate-500 border border-slate-800 font-bold text-xs flex items-center justify-center space-x-1.5 opacity-60 cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Send Urdu Greeting on WhatsApp</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats & Help Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3 text-xs">
            <div className="flex items-center space-x-2 text-amber-400 font-black">
              <HelpCircle className="w-4 h-4" />
              <span>Admin Guidance (ایڈمن رہنمائی)</span>
            </div>
            <ul className="text-slate-400 space-y-2 text-[11px] leading-relaxed">
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-black">•</span>
                <span>The configured number receives direct candidate queries, CV reviews, and proof of payment submissions.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-black">•</span>
                <span>Greeting Bubble can be toggled on/off independently from the main floating sticky icon.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-black">•</span>
                <span>Active subscribers count: <strong className="text-white">{subscribersCount}</strong> registered users.</span>
              </li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
};

export const AdminWhatsAppSettings = AdminWhatsAppManager;
export default AdminWhatsAppManager;
