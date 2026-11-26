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

export type LegacyMigrationStatus = 'idle' | 'in_flight' | 'failed' | 'succeeded' | 'restored';

interface AdminWhatsAppManagerProps {
  config: WhatsAppSupportConfig;
  onUpdateConfig: (updated: WhatsAppSupportConfig) => Promise<boolean | any> | boolean | any;
  subscribersCount?: number;
  initialMigrationStatus?: LegacyMigrationStatus;
  initialMigrationError?: string | null;
}

const isRealWhatsAppGroupLink = (link?: string | null): boolean => {
  return isValidWhatsAppGroupLink(link);
};

export const LEGACY_WHATSAPP_GROUP_LINK_KEY = 'hybrid_whatsapp_group_link';

export function getStoredValidLegacyGroupLink(): string {
  try {
    const legacy = localStorage.getItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
    return isRealWhatsAppGroupLink(legacy) ? legacy!.trim() : '';
  } catch {
    return '';
  }
}

export function canShowLegacyMigrationRetry(params: {
  config?: Partial<WhatsAppSupportConfig> | null;
  legacyLink?: string | null;
  migrationStatus: LegacyMigrationStatus;
  hasAttemptedMigration?: boolean;
}): boolean {
  const { config, legacyLink, migrationStatus, hasAttemptedMigration } = params;
  if (hasAttemptedMigration) return false;
  if (migrationStatus !== 'failed') return false;
  if (isRealWhatsAppGroupLink(config?.groupLink)) return false;
  if (!isRealWhatsAppGroupLink(legacyLink)) return false;
  return true;
}

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

const fallbackMigrationInFlightMap = new WeakMap<{ current: boolean }, { current: boolean }>();
const fallbackSavingConfigMap = new WeakMap<{ current: boolean }, { current: boolean }>();

function getFallbackMigrationInFlightRef(hasAttemptedMigrationRef: { current: boolean }): { current: boolean } {
  let ref = fallbackMigrationInFlightMap.get(hasAttemptedMigrationRef);
  if (!ref) {
    ref = { current: false };
    fallbackMigrationInFlightMap.set(hasAttemptedMigrationRef, ref);
  }
  return ref;
}

function getFallbackSavingConfigRef(hasAttemptedMigrationRef: { current: boolean }): { current: boolean } {
  let ref = fallbackSavingConfigMap.get(hasAttemptedMigrationRef);
  if (!ref) {
    ref = { current: false };
    fallbackSavingConfigMap.set(hasAttemptedMigrationRef, ref);
  }
  return ref;
}

export async function runLegacyGroupMigration(params: {
  config?: WhatsAppSupportConfig | null;
  hasAttemptedMigrationRef: { current: boolean };
  isRestoringDefaultsRef?: { current: boolean };
  migrationInFlightRef?: { current: boolean };
  isSavingConfigRef?: { current: boolean };
  onUpdateConfig: (updated: WhatsAppSupportConfig) => Promise<boolean | any> | boolean | any;
  setFormData: React.Dispatch<React.SetStateAction<WhatsAppSupportConfig>>;
  onMigrationStart?: () => void;
  onMigrationSuccess?: () => void;
  onMigrationFailure?: (message: string) => void;
  onMigrationFinish?: () => void;
}): Promise<boolean> {
  const {
    config,
    hasAttemptedMigrationRef,
    isRestoringDefaultsRef,
    migrationInFlightRef,
    isSavingConfigRef,
    onUpdateConfig,
    setFormData,
    onMigrationStart,
    onMigrationSuccess,
    onMigrationFailure,
    onMigrationFinish
  } = params;

  const fallbackInFlightRef = getFallbackMigrationInFlightRef(hasAttemptedMigrationRef);
  const fallbackSavingRef = getFallbackSavingConfigRef(hasAttemptedMigrationRef);
  const activeInFlightRef = migrationInFlightRef || fallbackInFlightRef;

  if (
    hasAttemptedMigrationRef.current ||
    isRestoringDefaultsRef?.current ||
    isSavingConfigRef?.current ||
    fallbackSavingRef.current ||
    activeInFlightRef.current ||
    fallbackInFlightRef.current
  ) {
    return false;
  }

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
    const validLink = legacyLink!.trim();
    const sanitizedPhone = normalizeWhatsAppPhone(config?.phoneNumber);
    const payload: WhatsAppSupportConfig = {
      ...DEFAULT_WHATSAPP_CONFIG,
      ...(config || {}),
      phoneNumber: sanitizedPhone,
      enabled: Boolean(config?.enabled && sanitizedPhone),
      groupLink: validLink
    };

    activeInFlightRef.current = true;
    fallbackInFlightRef.current = true;
    onMigrationStart?.();
    try {
      const res = await Promise.resolve(onUpdateConfig(payload));
      // Rule 5: Treat migration as successful only when the backend explicitly confirms success.
      // Do not delete legacy LocalStorage or mark migration completed on undefined, malformed, false, or rejected responses.
      const isSuccess = Boolean(
        res === true || (res && typeof res === 'object' && res.success === true)
      );
      if (isSuccess) {
        hasAttemptedMigrationRef.current = true;
        try {
          localStorage.removeItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
        } catch {}
        setFormData(prev => ({
          ...prev,
          groupLink: validLink,
          ...(res?.whatsAppSupportConfig || {})
        }));
        onMigrationSuccess?.();
        return true;
      } else {
        // Rule 6: Retain legacy value and keep eligible for controlled retry if migration fails
        const failMsg =
          (res && typeof res === 'object' && typeof res.message === 'string' && res.message) ||
          'Legacy WhatsApp group link migration could not be saved on server. Your saved link is preserved—click Retry Migration to try again.';
        console.warn('[AdminWhatsAppManager] Backend did not confirm group link migration. Legacy LocalStorage value retained.');
        onMigrationFailure?.(failMsg);
        return false;
      }
    } catch (err: any) {
      // Rule 6: Retain legacy value and keep eligible for controlled retry if migration fails
      const errMsg =
        err?.message ||
        'Failed to migrate legacy WhatsApp group link to server. Your saved link is preserved—click Retry Migration to try again.';
      console.warn('[AdminWhatsAppManager] Failed to migrate legacy Group Link to MongoDB:', err);
      onMigrationFailure?.(errMsg);
      return false;
    } finally {
      activeInFlightRef.current = false;
      fallbackInFlightRef.current = false;
      onMigrationFinish?.();
    }
  }

  return false;
}

export async function executeRestoreWhatsAppDefaults(params: {
  onUpdateConfig: (updated: WhatsAppSupportConfig) => Promise<boolean | any> | boolean | any;
  hasAttemptedMigrationRef: { current: boolean };
  isRestoringDefaultsRef: { current: boolean };
  migrationInFlightRef?: { current: boolean };
  isSavingConfigRef?: { current: boolean };
  setFormData: React.Dispatch<React.SetStateAction<WhatsAppSupportConfig>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSavedSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  onRestoreStart?: () => void;
  onRestoreSuccess?: () => void;
  onRestoreFailure?: (message: string) => void;
  onRestoreFinish?: () => void;
}): Promise<boolean> {
  const {
    onUpdateConfig,
    hasAttemptedMigrationRef,
    isRestoringDefaultsRef,
    migrationInFlightRef,
    isSavingConfigRef,
    setFormData,
    setSaveError,
    setIsSaving,
    setSavedSuccess,
    onRestoreStart,
    onRestoreSuccess,
    onRestoreFailure,
    onRestoreFinish
  } = params;

  // Mutual exclusion & duplicate-restore guard before mutating state or calling backend
  if (isRestoringDefaultsRef.current) {
    return false;
  }

  const fallbackSavingRef = getFallbackSavingConfigRef(hasAttemptedMigrationRef);
  if (isSavingConfigRef?.current || fallbackSavingRef.current) {
    const busySaveMsg =
      'Cannot restore defaults while WhatsApp configuration is being saved. Please wait for it to finish and try again.';
    setSaveError(busySaveMsg);
    onRestoreFailure?.(busySaveMsg);
    return false;
  }

  const fallbackInFlightRef = getFallbackMigrationInFlightRef(hasAttemptedMigrationRef);
  if (migrationInFlightRef?.current || fallbackInFlightRef.current) {
    const busyMsg =
      'Cannot restore defaults while legacy WhatsApp group link migration is in progress. Please wait for it to finish and try again.';
    setSaveError(busyMsg);
    onRestoreFailure?.(busyMsg);
    return false;
  }

  setSaveError(null);
  setIsSaving(true);
  isRestoringDefaultsRef.current = true;
  onRestoreStart?.();
  try {
    const result = await Promise.resolve(onUpdateConfig(DEFAULT_WHATSAPP_CONFIG));
    const isRestoreSuccess = Boolean(
      result === true || (result && typeof result === 'object' && result.success === true)
    );
    if (!isRestoreSuccess) {
      const failMsg =
        (result && typeof result === 'object' && typeof result.message === 'string' && result.message) ||
        'Failed to restore defaults on server. Form values retained.';
      setSaveError(failMsg);
      onRestoreFailure?.(failMsg);
      return false;
    }
    try {
      localStorage.removeItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
    } catch {}
    hasAttemptedMigrationRef.current = true;
    setFormData({ ...DEFAULT_WHATSAPP_CONFIG });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    onRestoreSuccess?.();
    return true;
  } catch (err: any) {
    const errMsg = err?.message || 'Error resetting WhatsApp configuration.';
    setSaveError(errMsg);
    onRestoreFailure?.(errMsg);
    return false;
  } finally {
    isRestoringDefaultsRef.current = false;
    setIsSaving(false);
    onRestoreFinish?.();
  }
}

export async function executeSaveWhatsAppConfig(params: {
  formData: WhatsAppSupportConfig;
  onUpdateConfig: (updated: WhatsAppSupportConfig) => Promise<boolean | any> | boolean | any;
  hasAttemptedMigrationRef: { current: boolean };
  isRestoringDefaultsRef: { current: boolean };
  migrationInFlightRef?: { current: boolean };
  isSavingConfigRef: { current: boolean };
  setFormData: React.Dispatch<React.SetStateAction<WhatsAppSupportConfig>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSavedSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  onSaveSuccess?: () => void;
}): Promise<boolean> {
  const {
    formData,
    onUpdateConfig,
    hasAttemptedMigrationRef,
    isRestoringDefaultsRef,
    migrationInFlightRef,
    isSavingConfigRef,
    setFormData,
    setSaveError,
    setIsSaving,
    setSavedSuccess,
    onSaveSuccess
  } = params;

  const fallbackSavingRef = getFallbackSavingConfigRef(hasAttemptedMigrationRef);
  const fallbackMigrationRef = getFallbackMigrationInFlightRef(hasAttemptedMigrationRef);

  // Synchronous defensive concurrency & mutual exclusion guards before mutating state or calling backend
  if (isSavingConfigRef.current || fallbackSavingRef.current) {
    return false;
  }

  if (migrationInFlightRef?.current || fallbackMigrationRef.current) {
    setSaveError(
      'Cannot save WhatsApp configuration while legacy WhatsApp group link migration is in progress. Please wait for it to finish and try again.'
    );
    return false;
  }

  if (isRestoringDefaultsRef.current) {
    setSaveError(
      'Cannot save WhatsApp configuration while Restore Defaults is in progress. Please wait for it to finish and try again.'
    );
    return false;
  }

  isSavingConfigRef.current = true;
  fallbackSavingRef.current = true;
  setSaveError(null);
  setSavedSuccess(false);
  setIsSaving(true);
  try {
    const trimmedPhone = (formData.phoneNumber || '').trim();
    if (trimmedPhone && isSampleWhatsAppPhone(trimmedPhone)) {
      setSaveError(
        'Validation Error: Placeholder or sample WhatsApp phone numbers are not allowed. Please enter your official WhatsApp business number.'
      );
      return false;
    }

    if (formData.enabled && !isValidWhatsAppPhone(trimmedPhone)) {
      setSaveError(
        'Validation Error: Please enter a valid international WhatsApp phone number (8-15 digits with country code) before enabling the widget.'
      );
      return false;
    }

    if (!formData.enabled && trimmedPhone && !isValidWhatsAppPhone(trimmedPhone)) {
      setSaveError(
        'Validation Error: Please enter a valid international WhatsApp phone number (8-15 digits with country code) or clear the field while disabled.'
      );
      return false;
    }

    const trimmedLink = (formData.groupLink || '').trim();
    if (trimmedLink) {
      if (isSampleWhatsAppGroupLink(trimmedLink)) {
        setSaveError('Validation Error: Sample WhatsApp group invite links are not allowed.');
        return false;
      }
      if (!isValidWhatsAppGroupLink(trimmedLink)) {
        setSaveError(
          'Validation Error: Please enter a valid HTTPS WhatsApp group invite link using hostname chat.whatsapp.com (e.g., https://chat.whatsapp.com/yourGroupCode).'
        );
        return false;
      }
    }

    const normalizedPayload: WhatsAppSupportConfig = {
      ...formData,
      phoneNumber: trimmedPhone ? normalizeWhatsAppPhone(trimmedPhone) : '',
      groupLink: trimmedLink
    };

    const result = await Promise.resolve(onUpdateConfig(normalizedPayload));
    const isSaveSuccess = Boolean(
      result === true || (result && typeof result === 'object' && result.success === true)
    );
    if (!isSaveSuccess) {
      setSaveError(
        (result && typeof result === 'object' && typeof result.message === 'string' && result.message) ||
          'Failed to save WhatsApp support configuration to server. Form values retained.'
      );
      return false;
    }

    // If user saved successfully, clear legacy LocalStorage only after confirmed backend success
    try {
      localStorage.removeItem(LEGACY_WHATSAPP_GROUP_LINK_KEY);
    } catch {}
    hasAttemptedMigrationRef.current = true;
    onSaveSuccess?.();

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
    return true;
  } catch (err: any) {
    setSaveError(err?.message || 'Error saving WhatsApp configuration to server.');
    return false;
  } finally {
    isSavingConfigRef.current = false;
    fallbackSavingRef.current = false;
    setIsSaving(false);
  }
}

export const AdminWhatsAppManager: React.FC<AdminWhatsAppManagerProps> = ({
  config,
  onUpdateConfig,
  subscribersCount = 0,
  initialMigrationStatus = 'idle',
  initialMigrationError = null
}) => {
  const [formData, setFormData] = useState<WhatsAppSupportConfig>(() =>
    resolveInitialWhatsAppFormData(config)
  );

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [testUrduMessage, setTestUrduMessage] = useState(
    'السلام علیکم! کیریئر پاک پر جاب الرٹس اور اپلائی کرنے کے لیے رہنمائی درکار ہے۔'
  );
  const [migrationStatus, setMigrationStatus] = useState<LegacyMigrationStatus>(initialMigrationStatus);
  const [migrationError, setMigrationError] = useState<string | null>(initialMigrationError);
  const [isRestoringDefaults, setIsRestoringDefaults] = useState(false);

  const hasAttemptedMigrationRef = useRef(
    initialMigrationStatus === 'succeeded' || initialMigrationStatus === 'restored'
  );
  const isRestoringDefaultsRef = useRef(false);
  const migrationInFlightRef = useRef(initialMigrationStatus === 'in_flight');
  const isSavingConfigRef = useRef(false);

  const executeControlledLegacyMigration = () =>
    runLegacyGroupMigration({
      config,
      hasAttemptedMigrationRef,
      isRestoringDefaultsRef,
      migrationInFlightRef,
      isSavingConfigRef,
      onUpdateConfig,
      setFormData,
      onMigrationStart: () => {
        setMigrationError(null);
        setMigrationStatus('in_flight');
      },
      onMigrationSuccess: () => {
        setMigrationError(null);
        setMigrationStatus('succeeded');
      },
      onMigrationFailure: (message: string) => {
        setMigrationError(message);
        setMigrationStatus('failed');
      },
      onMigrationFinish: () => {
        setMigrationStatus(prev => (prev === 'in_flight' ? 'idle' : prev));
      }
    });

  // Safe migration of legacy LocalStorage group link to MongoDB
  useEffect(() => {
    void executeControlledLegacyMigration();
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

  const storedLegacyLink = getStoredValidLegacyGroupLink();
  const hasValidMongoGroupLink = isRealWhatsAppGroupLink(config?.groupLink);
  const isMigrationInFlight = migrationStatus === 'in_flight';
  const showRetryMigration = canShowLegacyMigrationRetry({
    config,
    legacyLink: storedLegacyLink,
    migrationStatus,
    hasAttemptedMigration: hasAttemptedMigrationRef.current
  });

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await executeSaveWhatsAppConfig({
      formData,
      onUpdateConfig,
      hasAttemptedMigrationRef,
      isRestoringDefaultsRef,
      migrationInFlightRef,
      isSavingConfigRef,
      setFormData,
      setSaveError,
      setIsSaving,
      setSavedSuccess,
      onSaveSuccess: () => {
        setMigrationError(null);
        setMigrationStatus('succeeded');
      }
    });
  };

  const handleRestoreDefaults = async () => {
    await executeRestoreWhatsAppDefaults({
      onUpdateConfig,
      hasAttemptedMigrationRef,
      isRestoringDefaultsRef,
      migrationInFlightRef,
      isSavingConfigRef,
      setFormData,
      setSaveError,
      setIsSaving,
      setSavedSuccess,
      onRestoreStart: () => setIsRestoringDefaults(true),
      onRestoreSuccess: () => {
        setMigrationError(null);
        setMigrationStatus('restored');
      },
      onRestoreFinish: () => setIsRestoringDefaults(false)
    });
  };

  const handleRetryMigration = async () => {
    await executeControlledLegacyMigration();
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="admin-settings-mobile-compact space-y-4 animate-in fade-in duration-300">
      {/* Compact Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 relative z-10">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
              <MessageCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-black text-white leading-tight">
                  WhatsApp Support &amp; Alerts Hub
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  formData.enabled && hasValidPhone
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {formData.enabled && hasValidPhone ? 'Widget Live' : 'Widget Paused'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700">
                  {subscribersCount} Subscribers
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
                Manage official WhatsApp support number, community alert group link, and the public floating chat widget.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {testChatUrl ? (
              <a
                href={testChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Live WhatsApp Chat</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Enter a valid international WhatsApp phone number to enable live chat testing"
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-500 border border-slate-700 font-bold text-xs flex items-center gap-1.5 opacity-60 cursor-not-allowed"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Live WhatsApp Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || isRestoringDefaults || isMigrationInFlight}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Clear Scope Note so Payment Proofs & API Providers are not mixed up */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl px-3.5 py-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong className="text-slate-200">Note:</strong> Candidate payment proof receipts are reviewed in <strong className="text-amber-300">Finance &amp; Payments → Payment Proofs</strong>, while automated WhatsApp/Email/SMS broadcast APIs are in <strong className="text-emerald-300">Broadcast Campaigns</strong>.
        </span>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500 rounded-xl p-3 flex items-center gap-2.5 text-emerald-300 text-xs sm:text-sm font-bold shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>WhatsApp configuration saved successfully! (سیٹنگز محفوظ ہوگئیں)</span>
        </div>
      )}

      {saveError && (
        <div className="bg-rose-950/80 border border-rose-500 rounded-xl p-3 flex items-center gap-2.5 text-rose-300 text-xs sm:text-sm font-bold shadow-lg animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {showRetryMigration && (
        <div
          data-testid="legacy-migration-retry-banner"
          className="bg-amber-950/80 border border-amber-500/70 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-amber-200 text-xs font-bold shadow-lg animate-in fade-in"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              {migrationError ||
                'Legacy WhatsApp group link migration could not be saved on server. Your saved link is preserved—click Retry Migration to try again.'}
            </div>
          </div>
          <button
            type="button"
            data-testid="retry-legacy-migration-btn"
            onClick={handleRetryMigration}
            disabled={isSaving || isRestoringDefaults || isMigrationInFlight}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Migration</span>
          </button>
        </div>
      )}

      {isMigrationInFlight && !hasValidMongoGroupLink && (
        <div
          data-testid="legacy-migration-in-flight-banner"
          className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-2.5 text-emerald-300 text-xs font-bold shadow-lg"
        >
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          <span>Migrating legacy WhatsApp group link to server...</span>
        </div>
      )}

      {/* Main Compact Settings Form Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left 8 Cols: Compact Configuration Cards */}
        <div className="lg:col-span-8 space-y-4">
          {/* SECTION 1: Phone, Agent & Alerts Group Link */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>1. Support Number &amp; Alerts Group (واٹس ایپ رابطہ)</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Official WhatsApp Number *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 font-bold text-xs">+</span>
                  <input
                    type="text"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="923XXXXXXXXX"
                    required={Boolean(formData.enabled)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">8–15 digits with country code.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Support Representative Name *
                </label>
                <input
                  type="text"
                  value={formData.agentName}
                  onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                  placeholder="Ayesha (Lead HR Advisor)"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Shown on chat bubble header.</p>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Availability Hours Label
                </label>
                <input
                  type="text"
                  value={formData.supportHoursText}
                  onChange={(e) => setFormData({ ...formData, supportHoursText: e.target.value })}
                  placeholder="Online • 9:00 AM - 9:00 PM PKT"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Daily Job Alerts Group Invite Link
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    value={formData.groupLink || ''}
                    onChange={(e) => setFormData({ ...formData, groupLink: e.target.value })}
                    placeholder="https://chat.whatsapp.com/..."
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(formData.groupLink || '')}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Sent to confirmed WhatsApp Job Alert subscribers.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Pre-Filled Chat Message (Inside WhatsApp App)
                </label>
                <input
                  type="text"
                  value={formData.defaultMessage}
                  onChange={(e) => setFormData({ ...formData, defaultMessage: e.target.value })}
                  placeholder="Hello! I need assistance regarding job applications..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Auto-typed in WhatsApp when user clicks Start Chat.</p>
              </div>
            </div>
          </div>

          {/* SECTION 2: Floating Widget Behavior, Bubble & Sizing */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>2. Floating Widget, Greeting Bubble &amp; Layout</span>
              </h4>
            </div>

            {/* Compact 4-Toggle Switch Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                {
                  label: 'Show Widget',
                  sub: 'Public pages',
                  checked: Boolean(formData.enabled),
                  onChange: (val: boolean) => setFormData({ ...formData, enabled: val })
                },
                {
                  label: 'Greeting Bubble',
                  sub: 'Popup tooltip',
                  checked: formData.showGreetingBubble !== false,
                  onChange: (val: boolean) => setFormData({ ...formData, showGreetingBubble: val })
                },
                {
                  label: "Online Badge '1'",
                  sub: 'Unread dot',
                  checked: formData.showOnlineBadge !== false,
                  onChange: (val: boolean) => setFormData({ ...formData, showOnlineBadge: val })
                },
                {
                  label: 'Pulse Aura',
                  sub: 'Glow effect',
                  checked: formData.enablePulseAnimation !== false,
                  onChange: (val: boolean) => setFormData({ ...formData, enablePulseAnimation: val })
                }
              ].map((toggle) => (
                <label
                  key={toggle.label}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:border-emerald-500/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-white truncate">{toggle.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{toggle.sub}</div>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <input
                      type="checkbox"
                      checked={toggle.checked}
                      onChange={(e) => toggle.onChange(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </div>
                </label>
              ))}
            </div>

            {/* Greeting Bubble Copy & Delay */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Site Greeting Bubble Text (Visible on Website)
                </label>
                <input
                  type="text"
                  value={formData.greetingText ?? DEFAULT_WHATSAPP_CONFIG.greetingText}
                  onChange={(e) => setFormData({ ...formData, greetingText: e.target.value })}
                  placeholder="Need help applying for jobs or setting alerts?"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  CTA Button Label
                </label>
                <input
                  type="text"
                  value={formData.greetingCtaText ?? DEFAULT_WHATSAPP_CONFIG.greetingCtaText}
                  onChange={(e) => setFormData({ ...formData, greetingCtaText: e.target.value })}
                  placeholder="Start WhatsApp Chat"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Auto-Show Delay (sec)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  value={formData.autoShowDelaySeconds ?? 4.5}
                  onChange={(e) => setFormData({ ...formData, autoShowDelaySeconds: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Position & 4 Compact Size Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Corner Position</label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="bottom-right">Bottom-Right</option>
                  <option value="bottom-left">Bottom-Left</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-emerald-400" />
                  <span>Mobile Size</span>
                </label>
                <select
                  value={formData.mobileSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, mobileSize: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (48px)</option>
                  <option value="standard">Standard (56px)</option>
                  <option value="large">Large (64px)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <Monitor className="w-3 h-3 text-cyan-400" />
                  <span>Desktop Size</span>
                </label>
                <select
                  value={formData.desktopSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, desktopSize: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (56px)</option>
                  <option value="standard">Standard (64px)</option>
                  <option value="large">Large (80px)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-amber-400" />
                  <span>Icon Size</span>
                </label>
                <select
                  value={formData.iconSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, iconSize: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3 text-indigo-400" />
                  <span>Bubble Width</span>
                </label>
                <select
                  value={formData.bubbleSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, bubbleSize: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (280px)</option>
                  <option value="standard">Standard (320px)</option>
                  <option value="large">Large (380px)</option>
                </select>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-3 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="button"
                data-testid="restore-whatsapp-defaults-btn"
                onClick={handleRestoreDefaults}
                disabled={isSaving || isRestoringDefaults || isMigrationInFlight}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRestoringDefaults ? 'animate-spin' : ''}`} />
                <span>{isRestoringDefaults ? 'Restoring Defaults...' : 'Restore Defaults'}</span>
              </button>

              <button
                type="submit"
                disabled={isSaving || isRestoringDefaults || isMigrationInFlight}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'Saving to Server...' : 'Save & Apply WhatsApp Configuration'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Compact Live Preview & Urdu Test */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Widget Preview</span>
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                formData.enabled
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              }`}>
                {formData.enabled ? 'Widget Active' : 'Widget Off'}
              </span>
            </div>

            {formData.showGreetingBubble !== false ? (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs relative shrink-0">
                    💬
                    {formData.showOnlineBadge !== false && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-white truncate">{formData.agentName || 'Career Support'}</div>
                    <div className="text-[10px] text-slate-400 truncate">{formData.supportHoursText}</div>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-[11px] text-slate-300 leading-snug">
                  "{formData.greetingText || DEFAULT_WHATSAPP_CONFIG.greetingText}"
                </div>

                <button type="button" className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1">
                  <Send className="w-3 h-3" />
                  <span>{formData.greetingCtaText || 'Start WhatsApp Chat'}</span>
                </button>

                <div className="text-center">
                  <span className={`text-[10px] font-mono ${hasValidPhone ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {hasValidPhone ? `+${cleanPhone}` : 'No valid WhatsApp number configured'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center text-xs text-slate-400 space-y-1">
                <p className="font-bold text-amber-400">Greeting Bubble Disabled</p>
                <p className="text-[11px]">Sticky icon opens WhatsApp directly without speech bubble.</p>
              </div>
            )}

            {/* Urdu Quick Test */}
            <div className="pt-2.5 space-y-2 border-t border-slate-800">
              <label className="block text-[11px] font-bold text-slate-300">
                Urdu Quick Test (اردو ٹیسٹ میسج)
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
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 text-slate-500 border border-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Send Urdu Greeting on WhatsApp</span>
                </button>
              )}
            </div>
          </div>

          {/* Compact Help Tips */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-amber-400 font-black text-xs">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Quick Tips (رہنمائی)</span>
            </div>
            <p>• Floating icon opens wa.me chat with your pre-filled message.</p>
            <p>• Group invite link is shared only with paid/confirmed alert subscribers.</p>
          </div>
        </div>
      </form>
    </div>
  );
};

export const AdminWhatsAppSettings = AdminWhatsAppManager;
export default AdminWhatsAppManager;
