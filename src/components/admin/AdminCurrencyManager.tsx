import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Globe,
  RefreshCw,
  Save,
  CheckCircle2,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react';
import { Currency } from '../../types/job';
import { CurrencyExchangeConfig } from '../../types/adminSuite';

interface AdminCurrencyManagerProps {
  currencyConfig: CurrencyExchangeConfig;
  onUpdateCurrencyConfig: (updated: CurrencyExchangeConfig) => Promise<any> | void;
  isLoading?: boolean;
  loadError?: string | null;
  migrationError?: string | null;
}

const TIER_DEFINITIONS: {
  key: keyof CurrencyExchangeConfig['internationalPricingTiers'];
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: 'featuredJobFee', label: 'Featured Job Badge (30 Days)', icon: '⭐', color: 'text-amber-400' },
  { key: 'urgentBadgeFee', label: 'Urgent Hiring Badge (15 Days)', icon: '⚡', color: 'text-rose-400' },
  { key: 'verifiedCompanyBadgeFee', label: 'Verified Employer KYC Checkmark', icon: '🛡️', color: 'text-cyan-400' },
  { key: 'unlimitedMonthlySlotFee', label: 'Unlimited Monthly Employer Plan', icon: '👑', color: 'text-emerald-400' },
  { key: 'candidateDatabaseAccessFee', label: 'Candidate Database Access Fee', icon: '📂', color: 'text-purple-400' },
];

const ACTIVE_SUPPORTED_CURRENCIES: Currency[] = ['PKR', 'USD', 'AED', 'SAR', 'GBP', 'EUR', 'CAD', 'AUD'];

export const AdminCurrencyManager: React.FC<AdminCurrencyManagerProps> = ({
  currencyConfig,
  onUpdateCurrencyConfig,
  isLoading = false,
  loadError = null,
  migrationError = null
}) => {
  const [config, setConfig] = useState<CurrencyExchangeConfig>(currencyConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state if parent prop updates
  useEffect(() => {
    if (currencyConfig) {
      setConfig({
        ...currencyConfig,
        supportedCurrencies: ACTIVE_SUPPORTED_CURRENCIES
      });
    }
  }, [currencyConfig]);

  // Conversion test calculator state
  const [calcAmount, setCalcAmount] = useState<number>(10000);
  const [calcFrom, setCalcFrom] = useState<Currency>('PKR');
  const [calcTo, setCalcTo] = useState<Currency>('USD');

  const handleManualNotice = () => {
    alert('Notice: Live Forex provider integration is not connected in this phase. Exchange rates are maintained manually by system administrators below.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      // Ensure PKR rate is always 1.0 and all 8 currencies are included on save
      const payload: CurrencyExchangeConfig = {
        ...config,
        baseCurrency: 'PKR',
        supportedCurrencies: ACTIVE_SUPPORTED_CURRENCIES,
        rates: {
          ...config.rates,
          PKR: 1.0
        }
      };
      await onUpdateCurrencyConfig(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save currency configuration to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateConverted = (): { value: number | null; error?: string } => {
    if (calcFrom === calcTo) return { value: calcAmount };
    const fromRate = config.rates?.[calcFrom];
    const toRate = config.rates?.[calcTo];
    if (typeof fromRate !== 'number' || !Number.isFinite(fromRate) || fromRate <= 0) {
      return { value: null, error: `Rate for ${calcFrom} is not available or invalid.` };
    }
    if (typeof toRate !== 'number' || !Number.isFinite(toRate) || toRate <= 0) {
      return { value: null, error: `Rate for ${calcTo} is not available or invalid.` };
    }
    const inPkr = calcFrom === 'PKR' ? calcAmount : calcAmount / fromRate;
    const result = calcTo === 'PKR' ? inPkr : inPkr * toRate;
    return { value: result };
  };

  const conversionResult = calculateConverted();

  return (
    <form onSubmit={handleSave} className="space-y-6 text-white">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Globe className="w-4 h-4" />
            <span>International Multi-Currency & Forex Engine</span>
          </div>
          <h2 className="text-xl font-black text-white">Global Pricing Matrix & Exchange Rates</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure currency conversion rates, manual rate overrides, and regional employer package tiers.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleManualNotice}
            disabled={isLoading || isSaving}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
            title="Live Forex integration not connected in this phase"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Forex Live Sync (Manual Mode)</span>
          </button>

          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : 'Save Currency Config'}</span>
          </button>
        </div>
      </div>

      {/* Honest Forex Notice Banner */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-300 text-xs flex items-center space-x-3">
        <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <span>
          Notice: Live Forex provider integration is not connected in this phase. Exchange rates are maintained manually by system administrators below.
        </span>
      </div>

      {/* Loading state indicator */}
      {isLoading && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 font-semibold text-xs flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Loading currency configuration from database... Editing is disabled while loading.</span>
        </div>
      )}

      {/* Backend Load Error Banner */}
      {loadError && (
        <div className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-bold text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Database Load Warning: {loadError}</span>
        </div>
      )}

      {/* Legacy Migration Notice/Error */}
      {migrationError && (
        <div className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 font-bold text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Migration Notice: {migrationError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Currency exchange rates and international tier matrices saved successfully to database!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-bold text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Grid: Rates on Left, Conversion Tester on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* EXCHANGE RATES TABLE */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Interbank Conversion Rates (Base: PKR)</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Status: {config.lastSyncedAt || 'Manual Configuration'}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {ACTIVE_SUPPORTED_CURRENCIES.map((curr) => {
              const isBase = curr === 'PKR';
              const rate = isBase ? 1.0 : (config.rates[curr] ?? 0);
              const inverse = isBase ? 1 : (rate > 0 ? Math.round(1 / rate) : 'N/A');
              return (
                <div key={curr} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{curr}</span>
                    <span className="text-[10px] text-slate-500">
                      {isBase ? 'Base (1.0)' : `1 ${curr} = Rs ${inverse}`}
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                      {isBase ? 'Fixed Base Multiplier' : 'Rate Multiplier'}
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      disabled={isBase || isLoading || isSaving}
                      value={rate}
                      onChange={(e) => {
                        if (isBase) return;
                        const val = parseFloat(e.target.value) || 0;
                        setConfig({
                          ...config,
                          rates: {
                            ...config.rates,
                            [curr]: val
                          }
                        });
                      }}
                      className={`w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-xs font-bold ${
                        isBase ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LIVE CONVERSION SIMULATOR */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold border-b border-slate-800 pb-2 flex items-center space-x-2">
            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
            <span>Exchange Simulator</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Amount to Convert</label>
              <input
                type="number"
                disabled={isLoading || isSaving}
                value={calcAmount}
                onChange={(e) => setCalcAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-300 mb-1">From Currency</label>
                <select
                  disabled={isLoading || isSaving}
                  value={calcFrom}
                  onChange={(e) => setCalcFrom(e.target.value as Currency)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  {ACTIVE_SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">To Currency</label>
                <select
                  disabled={isLoading || isSaving}
                  value={calcTo}
                  onChange={(e) => setCalcTo(e.target.value as Currency)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  {ACTIVE_SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Calculated Conversion</span>
              {conversionResult.error ? (
                <div className="text-xs font-semibold text-rose-400 py-2">
                  {conversionResult.error}
                </div>
              ) : (
                <>
                  <div className="text-xl font-black font-mono text-emerald-400">
                    {calcTo} {(conversionResult.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Applied rate: 1 {calcFrom} = {((conversionResult.value ?? 0) / (calcAmount || 1)).toFixed(4)} {calcTo}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 2: INTERNATIONAL PRICING TIERS MATRIX */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>International Employer Monetization Tiers</span>
            </h3>
            <p className="text-xs text-slate-400">Set customized regional checkout prices for each product in local currencies.</p>
          </div>
          <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/30 w-fit">
            Multi-Currency Matrix ({ACTIVE_SUPPORTED_CURRENCIES.length} Currencies)
          </span>
        </div>

        {/* Pricing matrix checkout notice */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs flex items-center space-x-2">
          <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span>
            Notice: The international pricing matrix is currently a stored configuration and does not automatically change actual checkout/payment calculations in this phase.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3 min-w-[220px]">Product / Feature</th>
                {ACTIVE_SUPPORTED_CURRENCIES.map((curr) => (
                  <th key={curr} className="p-3 min-w-[90px]">{curr}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {TIER_DEFINITIONS.map((tier) => (
                <tr key={tier.key}>
                  <td className={`p-3 font-sans font-bold ${tier.color}`}>
                    {tier.icon} {tier.label}
                  </td>
                  {ACTIVE_SUPPORTED_CURRENCIES.map((curr) => {
                    const currentVal = config.internationalPricingTiers?.[tier.key]?.[curr] ?? 0;
                    return (
                      <td key={curr} className="p-3">
                        <input
                          type="number"
                          disabled={isLoading || isSaving}
                          value={currentVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setConfig({
                              ...config,
                              internationalPricingTiers: {
                                ...config.internationalPricingTiers,
                                [tier.key]: {
                                  ...(config.internationalPricingTiers?.[tier.key] || {}),
                                  [curr]: val
                                }
                              }
                            });
                          }}
                          className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  );
};
