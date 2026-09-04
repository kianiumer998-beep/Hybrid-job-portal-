import React, { useState } from 'react';
import {
  CreditCard,
  Save,
  CheckCircle2,
  Smartphone,
  Building,
  MessageSquare,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { AdminReceivingPaymentConfig, DEFAULT_ADMIN_RECEIVING_PAYMENT_CONFIG } from '../../types/adminPayment';

interface AdminPaymentMethodsManagerProps {
  initialConfig?: AdminReceivingPaymentConfig;
  onSaveConfig?: (config: AdminReceivingPaymentConfig) => void;
}

export const AdminPaymentMethodsManager: React.FC<AdminPaymentMethodsManagerProps> = ({
  initialConfig,
  onSaveConfig
}) => {
  const [config, setConfig] = useState<AdminReceivingPaymentConfig>(() => {
    try {
      const saved = localStorage.getItem('admin_receiving_payment_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return initialConfig || DEFAULT_ADMIN_RECEIVING_PAYMENT_CONFIG;
  });

  const [activeSubTab, setActiveSubTab] = useState<'methods' | 'durations'>('methods');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newDurationDays, setNewDurationDays] = useState('');
  const [newDurationLabel, setNewDurationLabel] = useState('');
  const [newDurationPrice, setNewDurationPrice] = useState('');

  const handleSave = () => {
    localStorage.setItem('admin_receiving_payment_config', JSON.stringify(config));
    if (onSaveConfig) {
      onSaveConfig(config);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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

    setConfig({
      ...config,
      activeDurationOptions: [...config.activeDurationOptions, newOption]
    });

    setNewDurationDays('');
    setNewDurationLabel('');
    setNewDurationPrice('');
  };

  const handleToggleDurationApproval = (id: string) => {
    setConfig({
      ...config,
      activeDurationOptions: config.activeDurationOptions.map((opt) =>
        opt.id === id
          ? { ...opt, isApprovedForDisplay: !opt.isApprovedForDisplay, enabled: !opt.isApprovedForDisplay }
          : opt
      )
    });
  };

  const handleDeleteDuration = (id: string) => {
    setConfig({
      ...config,
      activeDurationOptions: config.activeDurationOptions.filter((opt) => opt.id !== id)
    });
  };

  return (
    <div className="space-y-6 text-white max-w-5xl">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Payment Collection & Duration Approval Engine</span>
          </div>
          <h2 className="text-xl font-black text-white">Admin Payment Accounts & Campaign Durations</h2>
          <p className="text-xs text-slate-400 mt-1">
            Set your receiving EasyPaisa, JazzCash, Bank IBAN, and WhatsApp details. Approve allowed campaign duration packages (1 Day, 1 Week, 15 Days, 20 Days).
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>Save Payment Settings</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 font-bold text-xs flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>✅ Admin payment accounts and campaign duration presets saved and synchronized successfully!</span>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('methods')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'methods'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>EasyPaisa, JazzCash & Bank Accounts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('durations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'durations'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Campaign Duration Presets (1-Day, 1-Week, 15-Days, 20-Days)</span>
        </button>
      </div>

      {/* TAB 1: PAYMENT CHANNELS */}
      {activeSubTab === 'methods' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* EasyPaisa Account */}
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm">
                  EP
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">EasyPaisa Account</h3>
                  <span className="text-[10px] text-emerald-400 font-semibold">Telenor Microfinance</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    easypaisa: { ...config.easypaisa, enabled: !config.easypaisa.enabled }
                  })
                }
                className="cursor-pointer"
              >
                {config.easypaisa.enabled ? (
                  <ToggleRight className="w-7 h-7 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-600" />
                )}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Account Title (اکاؤنٹ کا نام)</label>
                <input
                  type="text"
                  value={config.easypaisa.accountTitle}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      easypaisa: { ...config.easypaisa, accountTitle: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  placeholder="e.g. Muhammad Ali"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">EasyPaisa Mobile Number (موبائل نمبر)</label>
                <input
                  type="text"
                  value={config.easypaisa.accountNumber}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      easypaisa: { ...config.easypaisa, accountNumber: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 font-mono font-bold outline-none focus:border-emerald-500"
                  placeholder="e.g. 0345-1234567"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Instructions for User (ہدایات)</label>
                <textarea
                  rows={2}
                  value={config.easypaisa.instructions}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      easypaisa: { ...config.easypaisa, instructions: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-emerald-500 text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* JazzCash Account */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-lg space-y-4">
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
                onClick={() =>
                  setConfig({
                    ...config,
                    jazzcash: { ...config.jazzcash, enabled: !config.jazzcash.enabled }
                  })
                }
                className="cursor-pointer"
              >
                {config.jazzcash.enabled ? (
                  <ToggleRight className="w-7 h-7 text-amber-400" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-600" />
                )}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Account Title (اکاؤنٹ کا نام)</label>
                <input
                  type="text"
                  value={config.jazzcash.accountTitle}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      jazzcash: { ...config.jazzcash, accountTitle: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                  placeholder="e.g. Jobs Portal Admin"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">JazzCash Mobile Number (موبائل نمبر)</label>
                <input
                  type="text"
                  value={config.jazzcash.accountNumber}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      jazzcash: { ...config.jazzcash, accountNumber: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-mono font-bold outline-none focus:border-amber-500"
                  placeholder="e.g. 0300-1234567"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Instructions for User (ہدایات)</label>
                <textarea
                  rows={2}
                  value={config.jazzcash.instructions}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      jazzcash: { ...config.jazzcash, instructions: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-amber-500 text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Bank Transfer / Raast / IBAN */}
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Bank Account / Raast ID / IBAN</h3>
                  <span className="text-[10px] text-indigo-400 font-semibold">Direct IBFT Deposit</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    bank: { ...config.bank, enabled: !config.bank.enabled }
                  })
                }
                className="cursor-pointer"
              >
                {config.bank.enabled ? (
                  <ToggleRight className="w-7 h-7 text-indigo-400" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-600" />
                )}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Bank Name (بینک کا نام)</label>
                <input
                  type="text"
                  value={config.bank.bankName}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bank: { ...config.bank, bankName: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                  placeholder="e.g. Meezan Bank, HBL, Allied Bank"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Account Title (اکاؤنٹ ٹائٹل)</label>
                <input
                  type="text"
                  value={config.bank.accountTitle}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bank: { ...config.bank, accountTitle: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                  placeholder="e.g. Pakistan Jobs Media"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">IBAN / Raast ID (آئی بی اے این نمبر)</label>
                <input
                  type="text"
                  value={config.bank.iban}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bank: { ...config.bank, iban: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-indigo-300 font-mono font-bold outline-none focus:border-indigo-500"
                  placeholder="PK45MEZN0001020304050607"
                />
              </div>
            </div>
          </div>

          {/* Official WhatsApp Support & Proof Verification */}
          <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-sm">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Admin WhatsApp Support & Proofs</h3>
                  <span className="text-[10px] text-teal-400 font-semibold">Direct Chat & Receipt Receiving</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    whatsapp: { ...config.whatsapp, enabled: !config.whatsapp.enabled }
                  })
                }
                className="cursor-pointer"
              >
                {config.whatsapp.enabled ? (
                  <ToggleRight className="w-7 h-7 text-teal-400" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-600" />
                )}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Admin WhatsApp Number (واٹس ایپ نمبر)</label>
                <input
                  type="text"
                  value={config.whatsapp.phoneNumber}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsapp: { ...config.whatsapp, phoneNumber: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-teal-300 font-mono font-bold outline-none focus:border-teal-500"
                  placeholder="+923001234567"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Pre-filled Chat Greeting Message</label>
                <textarea
                  rows={2}
                  value={config.whatsapp.messageTemplate}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsapp: { ...config.whatsapp, messageTemplate: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-teal-500 text-[11px]"
                />
              </div>

              <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl text-[11px] text-teal-300">
                💡 When users click &quot;Pay via WhatsApp&quot; or need proof verification, this number opens directly in their WhatsApp with their transaction info.
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
                    {config.activeDurationOptions.filter((d) => d.isApprovedForDisplay).length} Approved & Live
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toggle which run periods are approved for advertisers (1-day, 1-week, 15-days, 20-days). Any approved option will appear on the campaign creation form.
                </p>
              </div>
            </div>

            {/* List of Durations with Approval Toggles */}
            <div className="space-y-2.5">
              {config.activeDurationOptions.map((opt) => (
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
                          setConfig({
                            ...config,
                            activeDurationOptions: config.activeDurationOptions.map((d) =>
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
                      <span>{opt.isApprovedForDisplay ? 'Approved (منظور شدہ)' : 'Disabled (بند)'}</span>
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
              <span>Add Another Duration Package (نیا دورانیہ شامل کریں)</span>
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
