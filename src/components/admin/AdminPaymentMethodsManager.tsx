import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Save,
  CheckCircle2,
  Smartphone,
  Building,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Info,
  RefreshCw
} from 'lucide-react';
import {
  AdminReceivingPaymentConfig,
  DEFAULT_ADMIN_RECEIVING_PAYMENT_CONFIG,
  PublicPaymentMethodConfig,
  PublicPaymentSettings
} from '../../types/adminPayment';
import { api } from '../../services/api';

interface AdminPaymentMethodsManagerProps {
  initialConfig?: AdminReceivingPaymentConfig;
  onSaveConfig?: (config: AdminReceivingPaymentConfig) => void;
}

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
  proofNoteRequired: false,
  proofNoteLabel: 'Deposit Note / Sender Remarks',
  proofNotePlaceholder: 'Add any specific notes or depositor reference'
});

export const AdminPaymentMethodsManager: React.FC<AdminPaymentMethodsManagerProps> = ({
  initialConfig,
  onSaveConfig
}) => {
  // Campaign duration preset configuration (kept separate from payment accounts)
  const [durationConfig, setDurationConfig] = useState<AdminReceivingPaymentConfig>(() => {
    try {
      const saved = localStorage.getItem('admin_receiving_payment_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return initialConfig || DEFAULT_ADMIN_RECEIVING_PAYMENT_CONFIG;
  });

  const [activeSubTab, setActiveSubTab] = useState<'methods' | 'durations'>('methods');

  // Server-Persisted Payment Methods State
  const [methods, setMethods] = useState<{
    easypaisa: PublicPaymentMethodConfig;
    jazzcash: PublicPaymentMethodConfig;
    bank: PublicPaymentMethodConfig;
  }>({
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
  const [durationSaveSuccess, setDurationSaveSuccess] = useState<boolean>(false);

  // New duration preset inputs
  const [newDurationDays, setNewDurationDays] = useState('');
  const [newDurationLabel, setNewDurationLabel] = useState('');
  const [newDurationPrice, setNewDurationPrice] = useState('');

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
          setMethods({
            easypaisa: s.methods.easypaisa || createDefaultMethod('easypaisa', 'EasyPaisa'),
            jazzcash: s.methods.jazzcash || createDefaultMethod('jazzcash', 'JazzCash'),
            bank: {
              ...(s.methods.bank || createDefaultMethod('bank', 'Bank Transfer / Raast / IBAN')),
              bankName: s.methods.bank?.bankName || '',
              iban: s.methods.bank?.iban || ''
            }
          });
          if (s.defaultMethod) {
            setDefaultMethod(s.defaultMethod);
          }
          setIsConfiguredOnServer(true);
        } else {
          // If server is unconfigured, check if legacy draft exists in localStorage to ease migration
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

  const handleUpdateMethod = (key: 'easypaisa' | 'jazzcash' | 'bank', updates: Partial<PublicPaymentMethodConfig>) => {
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

  // Save public payment instructions to the authoritative server
  const handleSavePaymentSettings = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    // Client-side validation: Check that for each enabled method, required fields and at least one proof mechanism are set
    const keys: ('easypaisa' | 'jazzcash' | 'bank')[] = ['easypaisa', 'jazzcash', 'bank'];
    for (const k of keys) {
      const m = methods[k];
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
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        methods: {
          easypaisa: methods.easypaisa,
          jazzcash: methods.jazzcash,
          bank: methods.bank
        },
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

  // Save campaign duration presets locally
  const handleSaveDurations = () => {
    try {
      localStorage.setItem('admin_receiving_payment_config', JSON.stringify(durationConfig));
      if (onSaveConfig) {
        onSaveConfig(durationConfig);
      }
      setDurationSaveSuccess(true);
      setTimeout(() => setDurationSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCustomDuration = (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(newDurationDays);
    const price = parseInt(newDurationPrice) || 0;
    if (isNaN(days) || days <= 0 || !newDurationLabel.trim()) return;

    const newOption = {
      id: `custom-${Date.now()}`,
      label: newDurationLabel.trim(),
      days,
      enabled: true,
      pricePkr: price,
      isApprovedForDisplay: true,
      badge: 'Custom'
    };

    setDurationConfig({
      ...durationConfig,
      activeDurationOptions: [...durationConfig.activeDurationOptions, newOption]
    });

    setNewDurationDays('');
    setNewDurationLabel('');
    setNewDurationPrice('');
  };

  const handleToggleDurationApproval = (id: string) => {
    setDurationConfig({
      ...durationConfig,
      activeDurationOptions: durationConfig.activeDurationOptions.map((opt) =>
        opt.id === id
          ? { ...opt, isApprovedForDisplay: !opt.isApprovedForDisplay, enabled: !opt.isApprovedForDisplay }
          : opt
      )
    });
  };

  const handleDeleteDuration = (id: string) => {
    setDurationConfig({
      ...durationConfig,
      activeDurationOptions: durationConfig.activeDurationOptions.filter((opt) => opt.id !== id)
    });
  };

  return (
    <div className="space-y-6 text-white max-w-5xl">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Server-Persisted Payment Methods & Duration Presets</span>
          </div>
          <h2 className="text-xl font-black text-white">Public Receiving Payment Accounts</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure authoritative manual receiving accounts (EasyPaisa, JazzCash, Bank / Raast) shown to jobseekers and advertisers.
          </p>
        </div>

        {activeSubTab === 'methods' ? (
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
        ) : (
          <button
            type="button"
            onClick={handleSaveDurations}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Duration Presets</span>
          </button>
        )}
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

      {durationSaveSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 font-bold text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Campaign duration presets saved successfully!</span>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('methods')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'methods'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Manual Payment Accounts (EasyPaisa, JazzCash, Bank / Raast)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('durations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'durations'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Campaign Duration Presets</span>
        </button>
      </div>

      {/* TAB 1: PAYMENT CHANNELS */}
      {activeSubTab === 'methods' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EasyPaisa Account Card */}
            <div className={`bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-4 transition-all ${
              methods.easypaisa.enabled ? 'border-emerald-500/40' : 'border-slate-800 opacity-70'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm">
                    EP
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">EasyPaisa Mobile Account</h3>
                    <span className="text-[10px] text-emerald-400 font-semibold">Telenor Microfinance</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateMethod('easypaisa', { enabled: !methods.easypaisa.enabled })}
                  className="cursor-pointer"
                  title={methods.easypaisa.enabled ? 'Disable EasyPaisa' : 'Enable EasyPaisa'}
                >
                  {methods.easypaisa.enabled ? (
                    <ToggleRight className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-600" />
                  )}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Display Name</label>
                  <input
                    type="text"
                    value={methods.easypaisa.name}
                    onChange={(e) => handleUpdateMethod('easypaisa', { name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                    placeholder="EasyPaisa"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Account Title *</label>
                  <input
                    type="text"
                    value={methods.easypaisa.accountTitle}
                    onChange={(e) => handleUpdateMethod('easypaisa', { accountTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. Official Portal Account"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">EasyPaisa Mobile Number *</label>
                  <input
                    type="text"
                    value={methods.easypaisa.accountNumber}
                    onChange={(e) => handleUpdateMethod('easypaisa', { accountNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 font-mono font-bold outline-none focus:border-emerald-500"
                    placeholder="e.g. 0345-XXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">User-Facing Instructions *</label>
                  <textarea
                    rows={2}
                    value={methods.easypaisa.instructions}
                    onChange={(e) => handleUpdateMethod('easypaisa', { instructions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-emerald-500 text-[11px]"
                  />
                </div>

                {/* Proof Requirements */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">Proof Requirements</span>
                  <div className="space-y-1.5">
                    <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={methods.easypaisa.transactionIdRequired}
                        onChange={(e) => handleUpdateMethod('easypaisa', { transactionIdRequired: e.target.checked })}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Require Transaction ID (TID)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={methods.easypaisa.screenshotRequired}
                        onChange={(e) => handleUpdateMethod('easypaisa', { screenshotRequired: e.target.checked })}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Require Receipt Screenshot</span>
                    </label>
                    <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(methods.easypaisa.proofNoteRequired)}
                        onChange={(e) => handleUpdateMethod('easypaisa', { proofNoteRequired: e.target.checked })}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Require Sender Note</span>
                    </label>
                  </div>
                  {methods.easypaisa.enabled && !methods.easypaisa.transactionIdRequired && !methods.easypaisa.screenshotRequired && (
                    <p className="text-[10px] text-rose-400 font-bold">
                      ⚠️ At least one proof mechanism (TID or Screenshot) must be checked.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* JazzCash Account Card */}
            <div className={`bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-4 transition-all ${
              methods.jazzcash.enabled ? 'border-amber-500/40' : 'border-slate-800 opacity-70'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-sm">
                    JC
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">JazzCash Account</h3>
                    <span className="text-[10px] text-amber-400 font-semibold">Mobilink Microfinance</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateMethod('jazzcash', { enabled: !methods.jazzcash.enabled })}
                  className="cursor-pointer"
                  title={methods.jazzcash.enabled ? 'Disable JazzCash' : 'Enable JazzCash'}
                >
                  {methods.jazzcash.enabled ? (
                    <ToggleRight className="w-8 h-8 text-amber-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-600" />
                  )}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Display Name</label>
                  <input
                    type="text"
                    value={methods.jazzcash.name}
                    onChange={(e) => handleUpdateMethod('jazzcash', { name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                    placeholder="JazzCash"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Account Title *</label>
                  <input
                    type="text"
                    value={methods.jazzcash.accountTitle}
                    onChange={(e) => handleUpdateMethod('jazzcash', { accountTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                    placeholder="e.g. Official Portal Account"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">JazzCash Mobile Number *</label>
                  <input
                    type="text"
                    value={methods.jazzcash.accountNumber}
                    onChange={(e) => handleUpdateMethod('jazzcash', { accountNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-mono font-bold outline-none focus:border-amber-500"
                    placeholder="e.g. 0300-XXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">User-Facing Instructions *</label>
                  <textarea
                    rows={2}
                    value={methods.jazzcash.instructions}
                    onChange={(e) => handleUpdateMethod('jazzcash', { instructions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-amber-500 text-[11px]"
                  />
                </div>

                {/* Proof Requirements */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">Proof Requirements</span>
                  <div className="space-y-1.5">
                    <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={methods.jazzcash.transactionIdRequired}
                        onChange={(e) => handleUpdateMethod('jazzcash', { transactionIdRequired: e.target.checked })}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0"
                      />
                      <span>Require Transaction ID (TID)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={methods.jazzcash.screenshotRequired}
                        onChange={(e) => handleUpdateMethod('jazzcash', { screenshotRequired: e.target.checked })}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0"
                      />
                      <span>Require Receipt Screenshot</span>
                    </label>
                    <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(methods.jazzcash.proofNoteRequired)}
                        onChange={(e) => handleUpdateMethod('jazzcash', { proofNoteRequired: e.target.checked })}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0"
                      />
                      <span>Require Sender Note</span>
                    </label>
                  </div>
                  {methods.jazzcash.enabled && !methods.jazzcash.transactionIdRequired && !methods.jazzcash.screenshotRequired && (
                    <p className="text-[10px] text-rose-400 font-bold">
                      ⚠️ At least one proof mechanism (TID or Screenshot) must be checked.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bank Transfer / Raast / IBAN Card */}
            <div className={`md:col-span-2 bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-4 transition-all ${
              methods.bank.enabled ? 'border-indigo-500/40' : 'border-slate-800 opacity-70'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Bank Account / Raast ID / IBAN</h3>
                    <span className="text-[10px] text-indigo-400 font-semibold">Direct IBFT / Raast Wire</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateMethod('bank', { enabled: !methods.bank.enabled })}
                  className="cursor-pointer"
                  title={methods.bank.enabled ? 'Disable Bank' : 'Enable Bank'}
                >
                  {methods.bank.enabled ? (
                    <ToggleRight className="w-8 h-8 text-indigo-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-600" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Bank Name *</label>
                  <input
                    type="text"
                    value={methods.bank.bankName || ''}
                    onChange={(e) => handleUpdateMethod('bank', { bankName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                    placeholder="e.g. Meezan Bank, HBL, Bank Alfalah"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Account Title *</label>
                  <input
                    type="text"
                    value={methods.bank.accountTitle}
                    onChange={(e) => handleUpdateMethod('bank', { accountTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                    placeholder="e.g. Pakistan Jobs Portal"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Account / IBAN Number *</label>
                  <input
                    type="text"
                    value={methods.bank.accountNumber}
                    onChange={(e) => handleUpdateMethod('bank', { accountNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-indigo-300 font-mono font-bold outline-none focus:border-indigo-500"
                    placeholder="e.g. PKXXMEZN0000000000000000"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Raast ID / Secondary IBAN</label>
                  <input
                    type="text"
                    value={methods.bank.iban || ''}
                    onChange={(e) => handleUpdateMethod('bank', { iban: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-indigo-300 font-mono font-bold outline-none focus:border-indigo-500"
                    placeholder="Optional Raast phone or IBAN"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Transfer Instructions *</label>
                  <textarea
                    rows={2}
                    value={methods.bank.instructions}
                    onChange={(e) => handleUpdateMethod('bank', { instructions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-indigo-500 text-[11px]"
                  />
                </div>
              </div>

              {/* Bank Proof Requirements */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="text-[11px] font-bold text-slate-300 block">Bank Transfer Proof Requirements</span>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={methods.bank.transactionIdRequired}
                      onChange={(e) => handleUpdateMethod('bank', { transactionIdRequired: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-500 focus:ring-0"
                    />
                    <span>Require IBFT Reference / Transaction ID</span>
                  </label>
                  <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={methods.bank.screenshotRequired}
                      onChange={(e) => handleUpdateMethod('bank', { screenshotRequired: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-500 focus:ring-0"
                    />
                    <span>Require Bank Receipt / Screenshot</span>
                  </label>
                  <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(methods.bank.proofNoteRequired)}
                      onChange={(e) => handleUpdateMethod('bank', { proofNoteRequired: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-500 focus:ring-0"
                    />
                    <span>Require Sender Remarks</span>
                  </label>
                </div>
                {methods.bank.enabled && !methods.bank.transactionIdRequired && !methods.bank.screenshotRequired && (
                  <p className="text-[10px] text-rose-400 font-bold">
                    ⚠️ At least one proof mechanism (Transaction ID or Screenshot) must be checked.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAMPAIGN DURATION OPTIONS */}
      {activeSubTab === 'durations' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Approved Campaign Duration Packages</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {durationConfig.activeDurationOptions.filter((d) => d.isApprovedForDisplay).length} Approved &amp; Live
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toggle which run periods are approved for advertisers (1-day, 1-week, 15-days, 20-days). Any approved option will appear on the campaign creation form.
                </p>
              </div>
            </div>

            {/* List of Durations with Approval Toggles */}
            <div className="space-y-2.5">
              {durationConfig.activeDurationOptions.map((opt) => (
                <div
                  key={opt.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    opt.isApprovedForDisplay
                      ? 'bg-slate-950/80 border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                      : 'bg-slate-950/40 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        opt.isApprovedForDisplay
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {opt.days}d
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {opt.days} Calendar Days Run • PKR {opt.pricePkr.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Status & Approval Toggle */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-slate-400">Price PKR:</span>
                      <input
                        type="number"
                        value={opt.pricePkr}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setDurationConfig({
                            ...durationConfig,
                            activeDurationOptions: durationConfig.activeDurationOptions.map((d) =>
                              d.id === opt.id ? { ...d, pricePkr: val } : d
                            )
                          });
                        }}
                        className="w-24 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-emerald-400 font-bold outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleDurationApproval(opt.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all ${
                        opt.isApprovedForDisplay
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{opt.isApprovedForDisplay ? 'Approved' : 'Disabled'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteDuration(opt.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete Duration"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Custom Duration Form */}
          <form
            onSubmit={handleAddCustomDuration}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Another Duration Package</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Package Name</label>
                <input
                  type="text"
                  value={newDurationLabel}
                  onChange={(e) => setNewDurationLabel(e.target.value)}
                  placeholder="e.g. 10 Days Sprint"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Days Count</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newDurationDays}
                  onChange={(e) => setNewDurationDays(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Price (PKR)</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    min="0"
                    value={newDurationPrice}
                    onChange={(e) => setNewDurationPrice(e.target.value)}
                    placeholder="e.g. 8000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shrink-0 cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
