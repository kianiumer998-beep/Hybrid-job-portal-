import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Save,
  CheckCircle2,
  Smartphone,
  Building,
  Plus,
  Trash2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  RefreshCw,
  Sliders,
  HelpCircle,
  FileText,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  PublicPaymentMethodConfig,
  CustomProofField,
  PublicPaymentSettings
} from '../../types/adminPayment';
import { api } from '../../services/api';

const createDefaultMethod = (id: string, name: string): PublicPaymentMethodConfig => ({
  id,
  name,
  enabled: false,
  heading: `${name} Official Account`,
  accountTitle: '',
  accountNumber: '',
  instructions: `Transfer required fee to this official ${name} account. Submit your Transaction ID or receipt screenshot for administrator review.`,
  formTitle: `${name} Transfer`,
  formSubtitle: 'Manual verification by portal administrators',
  transactionIdRequired: true,
  transactionIdLabel: 'Transaction ID / Reference',
  transactionIdPlaceholder: 'e.g. 11-digit TID',
  transactionIdHelpText: 'Enter the reference/TID from your SMS or app receipt',
  screenshotRequired: true,
  screenshotLabel: 'Payment Receipt Screenshot',
  screenshotHelpText: 'Upload clear photo or screenshot of transaction receipt (max 5MB)',
  senderNameRequired: false,
  senderNameLabel: 'Sender Name / Account Holder',
  senderPhoneRequired: false,
  senderPhoneLabel: 'Sender Mobile / Account Number',
  senderPhonePlaceholder: 'e.g. 0300-1234567',
  proofNoteRequired: false,
  proofNoteLabel: 'Deposit Note / Sender Remarks',
  proofNotePlaceholder: 'Add any specific notes or depositor reference',
  customFields: []
});

export const AdminPaymentMethodsManager: React.FC = () => {
  // Server-Persisted Payment Methods State (includes base + any custom methods)
  const [methods, setMethods] = useState<Record<string, PublicPaymentMethodConfig>>({
    easypaisa: createDefaultMethod('easypaisa', 'EasyPaisa'),
    jazzcash: createDefaultMethod('jazzcash', 'JazzCash'),
    bank: {
      ...createDefaultMethod('bank', 'Bank Transfer / Raast / IBAN'),
      bankName: '',
      iban: ''
    }
  });

  const [defaultMethod, setDefaultMethod] = useState<string>('easypaisa');
  const [isConfiguredOnServer, setIsConfiguredOnServer] = useState<boolean>(false);
  const [isLoadingServerSettings, setIsLoadingServerSettings] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Expanded card sections tracking (which method has its advanced proof fields visible)
  const [expandedProofSections, setExpandedProofSections] = useState<Record<string, boolean>>({});
  const [depositAmountDrafts, setDepositAmountDrafts] = useState<Record<string, string>>({});

  const toggleProofSection = (methodId: string) => {
    setExpandedProofSections((prev) => ({
      ...prev,
      [methodId]: !prev[methodId]
    }));
  };

  // Load public payment settings from server on mount
  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      setIsLoadingServerSettings(true);
      try {
        const res = await api.paymentSettings.get();
        if (!isMounted) return;

        if (res && res.success && res.configured && res.settings && res.settings.methods) {
          const s = res.settings;
          const loaded: Record<string, PublicPaymentMethodConfig> = { ...s.methods };

          // Guarantee base methods exist
          if (!loaded.easypaisa) loaded.easypaisa = createDefaultMethod('easypaisa', 'EasyPaisa');
          if (!loaded.jazzcash) loaded.jazzcash = createDefaultMethod('jazzcash', 'JazzCash');
          if (!loaded.bank) {
            loaded.bank = {
              ...createDefaultMethod('bank', 'Bank Transfer / Raast / IBAN'),
              bankName: '',
              iban: ''
            };
          }

          // If customMethods array was returned, merge any not already in loaded
          if (Array.isArray(s.customMethods)) {
            for (const cm of s.customMethods) {
              if (cm && cm.id && !loaded[cm.id]) {
                loaded[cm.id] = cm;
              }
            }
          }

          setMethods(loaded);
          if (s.defaultMethod) {
            setDefaultMethod(s.defaultMethod);
          }
          setIsConfiguredOnServer(true);
        } else {
          // If server is unconfigured, check legacy localStorage draft to ease migration
          setIsConfiguredOnServer(false);
          try {
            const legacy = localStorage.getItem('admin_receiving_payment_config');
            if (legacy) {
              const parsed = JSON.parse(legacy);
              if (parsed.easypaisa || parsed.jazzcash || parsed.bank) {
                setMethods({
                  easypaisa: {
                    ...createDefaultMethod('easypaisa', 'EasyPaisa'),
                    enabled: Boolean(parsed.easypaisa?.enabled),
                    accountTitle: parsed.easypaisa?.accountTitle || '',
                    accountNumber: parsed.easypaisa?.accountNumber || '',
                    instructions: parsed.easypaisa?.instructions || ''
                  },
                  jazzcash: {
                    ...createDefaultMethod('jazzcash', 'JazzCash'),
                    enabled: Boolean(parsed.jazzcash?.enabled),
                    accountTitle: parsed.jazzcash?.accountTitle || '',
                    accountNumber: parsed.jazzcash?.accountNumber || '',
                    instructions: parsed.jazzcash?.instructions || ''
                  },
                  bank: {
                    ...createDefaultMethod('bank', 'Bank Transfer / Raast / IBAN'),
                    enabled: Boolean(parsed.bank?.enabled),
                    bankName: parsed.bank?.bankName || '',
                    accountTitle: parsed.bank?.accountTitle || '',
                    accountNumber: parsed.bank?.accountNumber || '',
                    iban: parsed.bank?.iban || '',
                    instructions: parsed.bank?.instructions || ''
                  }
                });
              }
            }
          } catch {}
        }
      } catch (err: any) {
        if (!isMounted) return;
        setSaveError('Could not reach backend payment settings service.');
      } finally {
        if (isMounted) setIsLoadingServerSettings(false);
      }
    };

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateMethod = (key: string, updates: Partial<PublicPaymentMethodConfig>) => {
    setMethods((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...updates
      }
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleAddCustomMethod = () => {
    const newId = `custom_${Date.now()}`;
    const newMethod: PublicPaymentMethodConfig = {
      ...createDefaultMethod(newId, 'Custom Payment Method'),
      isCustom: true,
      heading: 'Custom Payment Channel',
      instructions: 'Transfer required fee to this official account and submit proof below.'
    };
    setMethods((prev) => ({
      ...prev,
      [newId]: newMethod
    }));
    setExpandedProofSections((prev) => ({ ...prev, [newId]: true }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleRemoveCustomMethod = (methodId: string) => {
    if (methodId === 'easypaisa' || methodId === 'jazzcash' || methodId === 'bank') {
      return; // Base methods cannot be removed, only disabled
    }
    setMethods((prev) => {
      const next = { ...prev };
      delete next[methodId];
      return next;
    });
    if (defaultMethod === methodId) {
      setDefaultMethod('easypaisa');
    }
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Custom Proof Fields Management
  const handleAddCustomProofField = (methodId: string) => {
    const currentFields = methods[methodId]?.customFields || [];
    if (currentFields.length >= 20) {
      setSaveError(`Maximum limit of 20 custom proof fields reached for ${methods[methodId]?.name || 'this method'}.`);
      return;
    }
    const newField: CustomProofField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'Reference Detail',
      type: 'text',
      placeholder: 'e.g. CNIC, Branch Code, or Tracking #',
      helpText: '',
      required: false,
      order: currentFields.length
    };
    handleUpdateMethod(methodId, {
      customFields: [...currentFields, newField]
    });
  };

  const handleUpdateCustomProofField = (
    methodId: string,
    fieldId: string,
    updates: Partial<CustomProofField>
  ) => {
    const currentFields = methods[methodId]?.customFields || [];
    const nextFields = currentFields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f));
    handleUpdateMethod(methodId, { customFields: nextFields });
  };

  const handleMoveCustomProofField = (
    methodId: string,
    index: number,
    direction: 'up' | 'down'
  ) => {
    const currentFields = [...(methods[methodId]?.customFields || [])];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentFields.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentFields[index];
    currentFields[index] = currentFields[targetIndex];
    currentFields[targetIndex] = temp;

    // Recalculate order index cleanly while preserving original field IDs and properties
    const reorderedFields = currentFields.map((f, idx) => ({
      ...f,
      order: idx
    }));

    handleUpdateMethod(methodId, { customFields: reorderedFields });
  };

  const handleRemoveCustomProofField = (methodId: string, fieldId: string) => {
    const currentFields = methods[methodId]?.customFields || [];
    const nextFields = currentFields
      .filter((f) => f.id !== fieldId)
      .map((f, idx) => ({ ...f, order: idx }));
    handleUpdateMethod(methodId, { customFields: nextFields });
  };

  // Save public payment instructions to the authoritative server
  const handleSavePaymentSettings = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    // Client-side validation: Check that for each enabled method, required fields and at least one proof mechanism are set
    for (const [k, m] of Object.entries(methods)) {
      if (m.enabled) {
        if (!m.accountTitle.trim()) {
          setSaveError(`Account Title is required for enabled method "${m.name}".`);
          return;
        }
        if (!m.accountNumber.trim()) {
          setSaveError(`Account / Mobile Number is required for enabled method "${m.name}".`);
          return;
        }
        if (k === 'bank' && (!m.bankName || !m.bankName.trim())) {
          setSaveError('Bank Name is required for enabled Bank Transfer method.');
          return;
        }
        if (!m.instructions.trim()) {
          setSaveError(`Transfer instructions are required for enabled method "${m.name}".`);
          return;
        }
        if (!m.transactionIdRequired && !m.screenshotRequired) {
          setSaveError(
            `At least one proof mechanism (Transaction ID or Screenshot) must be required for enabled method "${m.name}".`
          );
          return;
        }
        if (m.customFields && m.customFields.length > 0) {
          if (m.customFields.length > 20) {
            setSaveError(`A maximum of 20 custom proof fields are allowed for "${m.name}".`);
            return;
          }
          const seenIds = new Set<string>();
          for (let i = 0; i < m.customFields.length; i++) {
            const cf = m.customFields[i];
            const cleanLabel = (cf.label || '').trim();
            if (!cleanLabel) {
              setSaveError(`Custom proof field #${i + 1} in "${m.name}" must have a label.`);
              return;
            }
            if (cleanLabel.length > 100) {
              setSaveError(`Custom proof field #${i + 1} label in "${m.name}" cannot exceed 100 characters.`);
              return;
            }
            if (!cf.id || seenIds.has(cf.id)) {
              setSaveError(`Custom proof field #${i + 1} in "${m.name}" has an invalid or duplicate field ID.`);
              return;
            }
            seenIds.add(cf.id);
            if (cf.type !== 'text' && cf.type !== 'number') {
              setSaveError(`Custom proof field "${cleanLabel}" has an unsupported input type.`);
              return;
            }
          }
        }
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        methods,
        defaultMethod
      };

      const res = await api.paymentSettings.update(payload);
      if (res && res.success && res.settings) {
        setSaveSuccess(true);
        setIsConfiguredOnServer(res.configured !== false);
        // Clean legacy local storage draft now that it's persisted to server
        try {
          localStorage.removeItem('admin_receiving_payment_config_draft');
        } catch {}
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        setSaveError(res?.message || 'Server rejected payment settings update.');
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Network error saving payment settings to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const baseKeys = ['easypaisa', 'jazzcash', 'bank'];
  const customKeys = Object.keys(methods).filter((k) => !baseKeys.includes(k));

  return (
    <div className="admin-settings-mobile-compact space-y-6 text-white max-w-5xl">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Server-Persisted Payment Accounts &amp; Proof Configuration</span>
          </div>
          <h2 className="text-xl font-black text-white">Public Receiving Payment Accounts</h2>
          <p className="text-xs text-slate-400 mt-1">
            Payment account details and receipt-proof requirements are saved on the backend and synchronized across users.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSavePaymentSettings}
          disabled={isSaving || isLoadingServerSettings}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Saving to Server...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save & Publish Payment Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Server Configuration Status Alert */}
      {!isLoadingServerSettings && (
        <>
          {isConfiguredOnServer ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 font-semibold text-xs flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Live & Synchronized: Public payment instructions are published in MongoDB and active on user deposit forms.</span>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 font-semibold text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Unconfigured on Server: Payment instructions are not yet published. Configure your verified accounts and click &quot;Save &amp; Publish Payment Settings&quot; to make them live.
              </span>
            </div>
          )}
        </>
      )}

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 font-bold text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Payment accounts successfully saved to MongoDB and synchronized across all user devices!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-300 font-bold text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* TAB 1: PAYMENT CHANNELS & PROOF CONFIGURATION */}
      <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400">
              Default Recommended Channel:{' '}
              <span className="text-white font-bold">{methods[defaultMethod]?.name || defaultMethod}</span>
            </div>
            <select
              value={defaultMethod}
              onChange={(e) => setDefaultMethod(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1 outline-none font-semibold"
            >
              {Object.entries(methods).map(([key, m]) => (
                <option key={key} value={key}>
                  {m.name} ({m.enabled ? 'Enabled' : 'Disabled'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Render all methods (Base + Custom) */}
            {Object.entries(methods).map(([key, method]) => {
              const isBase = baseKeys.includes(key);
              const isExpanded = Boolean(expandedProofSections[key]);

              return (
                <div
                  key={key}
                  className={`bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-4 transition-all ${
                    method.enabled
                      ? key === 'easypaisa'
                        ? 'border-emerald-500/40'
                        : key === 'jazzcash'
                        ? 'border-amber-500/40'
                        : key === 'bank'
                        ? 'border-indigo-500/40 md:col-span-2'
                        : 'border-cyan-500/40'
                      : 'border-slate-800 opacity-70'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                          key === 'easypaisa'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : key === 'jazzcash'
                            ? 'bg-amber-500/20 text-amber-400'
                            : key === 'bank'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-cyan-500/20 text-cyan-400'
                        }`}
                      >
                        {key === 'easypaisa' ? (
                          'EP'
                        ) : key === 'jazzcash' ? (
                          'JC'
                        ) : key === 'bank' ? (
                          <Building className="w-4 h-4" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-white">{method.name || 'Payment Method'}</h3>
                          {method.isCustom && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                              Custom
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {key === 'easypaisa'
                            ? 'Telenor Microfinance'
                            : key === 'jazzcash'
                            ? 'Mobilink Microfinance'
                            : key === 'bank'
                            ? 'Direct IBFT / Raast Wire'
                            : 'Custom Portal Gateway'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {!isBase && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomMethod(key)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Custom Method"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleUpdateMethod(key, { enabled: !method.enabled })}
                        className="cursor-pointer"
                        title={method.enabled ? `Disable ${method.name}` : `Enable ${method.name}`}
                      >
                        {method.enabled ? (
                          <ToggleRight
                            className={`w-8 h-8 ${
                              key === 'easypaisa'
                                ? 'text-emerald-400'
                                : key === 'jazzcash'
                                ? 'text-amber-400'
                                : key === 'bank'
                                ? 'text-indigo-400'
                                : 'text-cyan-400'
                            }`}
                          />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Core Method Credentials */}
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Display Name *</label>
                        <input
                          type="text"
                          value={method.name}
                          onChange={(e) => handleUpdateMethod(key, { name: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                          placeholder="e.g. EasyPaisa, Nayapay, UBL Omni"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Display Heading</label>
                        <input
                          type="text"
                          value={method.heading || ''}
                          onChange={(e) => handleUpdateMethod(key, { heading: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                          placeholder="e.g. Official Business Account"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Account Title *</label>
                        <input
                          type="text"
                          value={method.accountTitle}
                          onChange={(e) => handleUpdateMethod(key, { accountTitle: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                          placeholder="e.g. Pakistan Jobs Official"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Account / Mobile Number *</label>
                        <input
                          type="text"
                          value={method.accountNumber}
                          onChange={(e) => handleUpdateMethod(key, { accountNumber: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 font-mono font-bold outline-none focus:border-emerald-500"
                          placeholder="e.g. 0345-XXXXXXX or Account #"
                        />
                      </div>
                    </div>

                    {(key === 'bank' || method.isCustom) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1 font-semibold">
                            Bank / Institution Name {key === 'bank' && '*'}
                          </label>
                          <input
                            type="text"
                            value={method.bankName || ''}
                            onChange={(e) => handleUpdateMethod(key, { bankName: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                            placeholder="e.g. Meezan Bank, HBL, Bank Alfalah"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-semibold">IBAN / Raast ID</label>
                          <input
                            type="text"
                            value={method.iban || ''}
                            onChange={(e) => handleUpdateMethod(key, { iban: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-indigo-300 font-mono font-bold outline-none focus:border-emerald-500"
                            placeholder="Optional IBAN or Raast number"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">User-Facing Instructions *</label>
                      <textarea
                        rows={2}
                        value={method.instructions}
                        onChange={(e) => handleUpdateMethod(key, { instructions: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-emerald-500 text-[11px]"
                        placeholder="Instructions displayed to users on the deposit & subscription modals"
                      />
                    </div>

                    {/* Wallet Deposit Amount Controls — specific to this payment method */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/20 space-y-3">
                    <div>
                      <div className="text-[11px] font-black text-emerald-300">Wallet Deposit Amounts</div>
                      <p className="text-[10px] text-slate-500 mt-1">These settings affect wallet deposits only. Other payment types are unchanged.</p>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={method.walletDepositAllowCustomAmount !== false}
                        onChange={(e) => handleUpdateMethod(key, { walletDepositAllowCustomAmount: e.target.checked })}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Allow users to enter a custom amount for {method.name}</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="block text-[10px] font-bold text-slate-400">Custom deposit minimum (PKR)
                        <input type="number" min="1" max="100000000" step="1" value={method.walletDepositMinimumAmount ?? ''} onChange={(e) => handleUpdateMethod(key, { walletDepositMinimumAmount: e.target.value === '' ? undefined : Math.max(1, Math.floor(Number(e.target.value) || 1)) })} placeholder="No minimum" className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono" />
                      </label>
                      <label className="block text-[10px] font-bold text-slate-400">Custom deposit maximum (PKR)
                        <input type="number" min="1" max="100000000" step="1" value={method.walletDepositMaximumAmount ?? ''} onChange={(e) => handleUpdateMethod(key, { walletDepositMaximumAmount: e.target.value === '' ? undefined : Math.max(1, Math.floor(Number(e.target.value) || 1)) })} placeholder="No maximum" className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono" />
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-500">Limits apply to custom deposits only. Fixed amounts must be paid exactly as configured; package purchases from wallet balance are not affected.</p>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400">Add / update fixed amounts (PKR, comma separated)</label>
                      <input
                        type="text"
                        value={depositAmountDrafts[key] ?? (method.walletDepositFixedAmounts || []).map((item) => item.amount).join(', ')}
                        onChange={(e) => setDepositAmountDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        onBlur={() => {
                          const currentAmountsText = (method.walletDepositFixedAmounts || []).map((item) => item.amount).join(', ');
                          const draftText = depositAmountDrafts[key] ?? currentAmountsText;
                          const parsed = draftText.split(',').map((value) => value.trim()).filter(Boolean);
                          const nextAmounts: Array<{ amount: number; enabled: boolean }> = [];
                          for (const value of parsed) {
                            const amount = Number(value);
                            if (!Number.isSafeInteger(amount) || amount <= 0 || nextAmounts.some((item) => item.amount === amount)) continue;
                            const existing = (method.walletDepositFixedAmounts || []).find((item) => item.amount === amount);
                            nextAmounts.push({ amount, enabled: existing?.enabled ?? true });
                          }
                          handleUpdateMethod(key, { walletDepositFixedAmounts: nextAmounts });
                          setDepositAmountDrafts((prev) => ({ ...prev, [key]: nextAmounts.map((item) => item.amount).join(', ') }));
                        }}
                        placeholder="e.g. 500, 1000, 1500, 2000"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                      />
                      {(method.walletDepositFixedAmounts || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {(method.walletDepositFixedAmounts || []).map((item) => (
                            <label key={item.amount} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] cursor-pointer ${item.enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-500'}`}>
                              <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={(e) => handleUpdateMethod(key, { walletDepositFixedAmounts: (method.walletDepositFixedAmounts || []).map((current) => current.amount === item.amount ? { ...current, enabled: e.target.checked } : current) })}
                                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                              />
                              PKR {item.amount.toLocaleString()}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {!method.walletDepositAllowCustomAmount && !(method.walletDepositFixedAmounts || []).some((item) => item.enabled) && (
                      <p className="text-[10px] text-rose-300">Strict mode needs at least one enabled fixed amount before saving.</p>
                    )}
                  </div>

                  {/* Proof Requirements & Custom Fields Collapsible */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-[11px] font-bold text-slate-200">
                            Proof Requirements & Custom Fields
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleProofSection(key)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                        >
                          {isExpanded ? 'Hide Details' : 'Configure Proof Fields'}
                        </button>
                      </div>

                      {/* Summary Badges when collapsed */}
                      {!isExpanded && (
                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              method.transactionIdRequired
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            TID: {method.transactionIdRequired ? 'Required' : 'Optional'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded ${
                              method.screenshotRequired
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            Screenshot: {method.screenshotRequired ? 'Required' : 'Optional'}
                          </span>
                          {method.proofNoteRequired && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                              Note Required
                            </span>
                          )}
                          {method.customFields && method.customFields.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                              {method.customFields.length} Custom Field(s)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Detailed Editor when expanded */}
                      {isExpanded && (
                        <div className="space-y-4 pt-2 border-t border-slate-800/80">
                          {/* 1. Transaction ID Settings */}
                          <div className="space-y-2 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                            <label className="flex items-center space-x-2 text-[11px] text-slate-200 cursor-pointer font-bold">
                              <input
                                type="checkbox"
                                checked={method.transactionIdRequired}
                                onChange={(e) =>
                                  handleUpdateMethod(key, { transactionIdRequired: e.target.checked })
                                }
                                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                              />
                              <span>Require Transaction ID (TID)</span>
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <label className="text-slate-400 text-[10px] block">TID Input Label</label>
                                <input
                                  type="text"
                                  value={method.transactionIdLabel || ''}
                                  onChange={(e) =>
                                    handleUpdateMethod(key, { transactionIdLabel: e.target.value })
                                  }
                                  placeholder="Transaction ID / Reference"
                                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 text-[10px] block">TID Placeholder</label>
                                <input
                                  type="text"
                                  value={method.transactionIdPlaceholder || ''}
                                  onChange={(e) =>
                                    handleUpdateMethod(key, { transactionIdPlaceholder: e.target.value })
                                  }
                                  placeholder="e.g. 11-digit TID"
                                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 2. Receipt Screenshot Settings */}
                          <div className="space-y-2 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                            <label className="flex items-center space-x-2 text-[11px] text-slate-200 cursor-pointer font-bold">
                              <input
                                type="checkbox"
                                checked={method.screenshotRequired}
                                onChange={(e) =>
                                  handleUpdateMethod(key, { screenshotRequired: e.target.checked })
                                }
                                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                              />
                              <span>Require Receipt Screenshot</span>
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <label className="text-slate-400 text-[10px] block">Screenshot Label</label>
                                <input
                                  type="text"
                                  value={method.screenshotLabel || ''}
                                  onChange={(e) =>
                                    handleUpdateMethod(key, { screenshotLabel: e.target.value })
                                  }
                                  placeholder="Payment Receipt Screenshot"
                                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 text-[10px] block">Help Instructions</label>
                                <input
                                  type="text"
                                  value={method.screenshotHelpText || ''}
                                  onChange={(e) =>
                                    handleUpdateMethod(key, { screenshotHelpText: e.target.value })
                                  }
                                  placeholder="Upload clear photo or screenshot (max 5MB)"
                                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 3. Sender Name & Phone */}
                          <div className="space-y-2 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-300 block uppercase">
                              Sender Contact Requirements
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(method.senderNameRequired)}
                                  onChange={(e) =>
                                    handleUpdateMethod(key, { senderNameRequired: e.target.checked })
                                  }
                                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                                />
                                <span>Require Sender Name</span>
                              </label>

                              <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(method.senderPhoneRequired)}
                                  onChange={(e) =>
                                    handleUpdateMethod(key, { senderPhoneRequired: e.target.checked })
                                  }
                                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                                />
                                <span>Require Sender Mobile / Phone</span>
                              </label>
                            </div>
                          </div>

                          {/* 4. Sender Remarks / Note */}
                          <div className="space-y-2 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                            <label className="flex items-center space-x-2 text-[11px] text-slate-200 cursor-pointer font-bold">
                              <input
                                type="checkbox"
                                checked={Boolean(method.proofNoteRequired)}
                                onChange={(e) =>
                                  handleUpdateMethod(key, { proofNoteRequired: e.target.checked })
                                }
                                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                              />
                              <span>Require Depositor Note / Remarks</span>
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <label className="text-slate-400 text-[10px] block">Note Field Label</label>
                                <input
                                  type="text"
                                  value={method.proofNoteLabel || ''}
                                  onChange={(e) =>
                                    handleUpdateMethod(key, { proofNoteLabel: e.target.value })
                                  }
                                  placeholder="Deposit Remarks / Note"
                                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 text-[10px] block">Note Placeholder</label>
                                <input
                                  type="text"
                                  value={method.proofNotePlaceholder || ''}
                                  onChange={(e) =>
                                    handleUpdateMethod(key, { proofNotePlaceholder: e.target.value })
                                  }
                                  placeholder="e.g. Deposited via personal mobile account"
                                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 5. Arbitrary Configurable Custom Proof Fields */}
                          <div className="space-y-2.5 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center space-x-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                <span>Configurable Custom Proof Fields (CNIC, Branch, etc.)</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddCustomProofField(key)}
                                className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-all"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Custom Field</span>
                              </button>
                            </div>

                            {(!method.customFields || method.customFields.length === 0) ? (
                              <p className="text-[10px] text-slate-500 italic">
                                No custom fields configured for this method yet. Click &quot;Add Custom Field&quot; to require items like CNIC or Branch Code.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {method.customFields.map((field, idx) => (
                                  <div
                                    key={field.id}
                                    className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] font-bold text-slate-300">
                                          Field #{idx + 1}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-500">
                                          (ID: {field.id})
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        {/* Safe Up/Down Ordering Controls */}
                                        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-md p-0.5">
                                          <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => handleMoveCustomProofField(key, idx, 'up')}
                                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer"
                                            title="Move Up"
                                          >
                                            <ArrowUp className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            disabled={idx === (method.customFields?.length || 0) - 1}
                                            onClick={() => handleMoveCustomProofField(key, idx, 'down')}
                                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer"
                                            title="Move Down"
                                          >
                                            <ArrowDown className="w-3 h-3" />
                                          </button>
                                        </div>

                                        <label className="flex items-center space-x-1 text-[10px] text-slate-300 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={field.required}
                                            onChange={(e) =>
                                              handleUpdateCustomProofField(key, field.id, {
                                                required: e.target.checked
                                              })
                                            }
                                            className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                                          />
                                          <span>Required</span>
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveCustomProofField(key, field.id)}
                                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                                          title="Remove field"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[10px]">
                                      <div>
                                        <label className="text-slate-400 block mb-0.5 font-semibold">Field Label *</label>
                                        <input
                                          type="text"
                                          value={field.label}
                                          onChange={(e) =>
                                            handleUpdateCustomProofField(key, field.id, {
                                              label: e.target.value
                                            })
                                          }
                                          placeholder="e.g. CNIC Number"
                                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white outline-none focus:border-cyan-500"
                                        />
                                      </div>

                                      <div>
                                        <label className="text-slate-400 block mb-0.5 font-semibold">Input Type</label>
                                        <select
                                          value={field.type}
                                          onChange={(e) =>
                                            handleUpdateCustomProofField(key, field.id, {
                                              type: e.target.value as 'text' | 'number'
                                            })
                                          }
                                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white outline-none focus:border-cyan-500"
                                        >
                                          <option value="text">Text (String)</option>
                                          <option value="number">Number (Digits)</option>
                                        </select>
                                      </div>

                                      <div>
                                        <label className="text-slate-400 block mb-0.5 font-semibold">Placeholder</label>
                                        <input
                                          type="text"
                                          value={field.placeholder || ''}
                                          onChange={(e) =>
                                            handleUpdateCustomProofField(key, field.id, {
                                              placeholder: e.target.value
                                            })
                                          }
                                          placeholder="e.g. 12345-1234567-1"
                                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white outline-none focus:border-cyan-500"
                                        />
                                      </div>

                                      <div>
                                        <label className="text-slate-400 block mb-0.5 font-semibold">Help Text / Instruction</label>
                                        <input
                                          type="text"
                                          value={field.helpText || ''}
                                          onChange={(e) =>
                                            handleUpdateCustomProofField(key, field.id, {
                                              helpText: e.target.value
                                            })
                                          }
                                          placeholder="e.g. Without dashes"
                                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white outline-none focus:border-cyan-500"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Rule enforcement warning */}
                      {method.enabled && !method.transactionIdRequired && !method.screenshotRequired && (
                        <p className="text-[10px] text-rose-400 font-bold">
                          ⚠️ At least one proof mechanism (Transaction ID or Screenshot) must be checked.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Custom Payment Method Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAddCustomMethod}
              className="w-full py-3 bg-slate-900 hover:bg-slate-850 border border-dashed border-cyan-500/50 hover:border-cyan-400 rounded-2xl text-cyan-300 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Add Custom Payment Gateway (e.g. Nayapay, Sadapay, UBL Omni, Western Union)</span>
            </button>
          </div>
        </div>


    </div>
  );
};
