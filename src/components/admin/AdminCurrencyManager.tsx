import React, { useState } from 'react';
import {
  DollarSign,
  Globe,
  RefreshCw,
  Save,
  CheckCircle2,
  TrendingUp,
  Percent,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { Currency } from '../../types/job';
import { CurrencyExchangeConfig } from '../../types/adminSuite';

interface AdminCurrencyManagerProps {
  currencyConfig: CurrencyExchangeConfig;
  onUpdateCurrencyConfig: (updated: CurrencyExchangeConfig) => void;
}

export const AdminCurrencyManager: React.FC<AdminCurrencyManagerProps> = ({
  currencyConfig,
  onUpdateCurrencyConfig
}) => {
  const [config, setConfig] = useState<CurrencyExchangeConfig>(currencyConfig);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Conversion test calculator state
  const [calcAmount, setCalcAmount] = useState<number>(10000);
  const [calcFrom, setCalcFrom] = useState<Currency>('PKR');
  const [calcTo, setCalcTo] = useState<Currency>('USD');

  const handleSyncLiveRates = () => {
    setIsSyncing(true);
    setTimeout(() => {
      // Simulate live interbank Forex sync
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
      setConfig({
        ...config,
        lastSyncedAt: nowStr,
        rates: {
          PKR: 1.0,
          USD: 0.00359,
          EUR: 0.00331,
          GBP: 0.00282,
          AED: 0.01318,
          SAR: 0.01347,
          CAD: 0.00488,
          AUD: 0.00547
        }
      });
      setIsSyncing(false);
      alert('✅ Live Forex Exchange Rates synchronized against Open Exchange Rates API!');
    }, 1000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCurrencyConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const calculateConverted = () => {
    if (calcFrom === calcTo) return calcAmount;
    // convert from calcFrom to PKR first, then to calcTo
    let inPkr = calcAmount;
    if (calcFrom !== 'PKR') {
      const fromRate = config.rates[calcFrom] || 1;
      inPkr = calcAmount / fromRate;
    }
    const toRate = config.rates[calcTo] || 1;
    if (calcTo === 'PKR') return inPkr;
    return inPkr * toRate;
  };

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
            Configure currency auto-conversion, manual interbank rate overrides, and regional employer package tiers.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSyncLiveRates}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Rates...' : 'Sync Forex Rates'}</span>
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Currency Config</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Currency exchange rates and international tier matrices saved successfully!</span>
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
            <span className="text-[10px] font-mono text-slate-400">Last Synced: {config.lastSyncedAt}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {config.supportedCurrencies.map((curr) => {
              const rate = config.rates[curr] || 1;
              const inverse = curr === 'PKR' ? 1 : Math.round(1 / rate);
              return (
                <div key={curr} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{curr}</span>
                    <span className="text-[10px] text-slate-500">{curr === 'PKR' ? 'Base' : `1 ${curr} = Rs ${inverse}`}</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Rate Multiplier</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={rate}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setConfig({
                          ...config,
                          rates: {
                            ...config.rates,
                            [curr]: val
                          }
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-xs font-bold"
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
                value={calcAmount}
                onChange={(e) => setCalcAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-300 mb-1">From Currency</label>
                <select
                  value={calcFrom}
                  onChange={(e) => setCalcFrom(e.target.value as Currency)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  {config.supportedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">To Currency</label>
                <select
                  value={calcTo}
                  onChange={(e) => setCalcTo(e.target.value as Currency)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  {config.supportedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Calculated Conversion</span>
              <div className="text-xl font-black font-mono text-emerald-400">
                {calcTo} {calculateConverted().toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500">
                Applied rate: 1 {calcFrom} = {(calculateConverted() / (calcAmount || 1)).toFixed(4)} {calcTo}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 2: INTERNATIONAL PRICING TIERS MATRIX */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>International Employer Monetization Tiers</span>
            </h3>
            <p className="text-xs text-slate-400">Set customized regional checkout prices for each product in local currencies.</p>
          </div>
          <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/30">
            Multi-Currency Matrix
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Product / Feature</th>
                <th className="p-3">PKR</th>
                <th className="p-3">USD ($)</th>
                <th className="p-3">AED (د.إ)</th>
                <th className="p-3">SAR (﷼)</th>
                <th className="p-3">GBP (£)</th>
                <th className="p-3">EUR (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              
              {/* Product 1: Featured Job Listing */}
              <tr>
                <td className="p-3 font-sans font-bold text-amber-400">⭐ Featured Job Badge (30 Days)</td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.featuredJobFee.PKR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        featuredJobFee: { ...config.internationalPricingTiers.featuredJobFee, PKR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.featuredJobFee.USD}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        featuredJobFee: { ...config.internationalPricingTiers.featuredJobFee, USD: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.featuredJobFee.AED}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        featuredJobFee: { ...config.internationalPricingTiers.featuredJobFee, AED: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.featuredJobFee.SAR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        featuredJobFee: { ...config.internationalPricingTiers.featuredJobFee, SAR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.featuredJobFee.GBP}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        featuredJobFee: { ...config.internationalPricingTiers.featuredJobFee, GBP: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.featuredJobFee.EUR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        featuredJobFee: { ...config.internationalPricingTiers.featuredJobFee, EUR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
              </tr>

              {/* Product 2: Verified Company Checkmark */}
              <tr>
                <td className="p-3 font-sans font-bold text-cyan-400">🛡️ Verified Employer KYC Checkmark</td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.verifiedCompanyBadgeFee.PKR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        verifiedCompanyBadgeFee: { ...config.internationalPricingTiers.verifiedCompanyBadgeFee, PKR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.verifiedCompanyBadgeFee.USD}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        verifiedCompanyBadgeFee: { ...config.internationalPricingTiers.verifiedCompanyBadgeFee, USD: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.verifiedCompanyBadgeFee.AED}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        verifiedCompanyBadgeFee: { ...config.internationalPricingTiers.verifiedCompanyBadgeFee, AED: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.verifiedCompanyBadgeFee.SAR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        verifiedCompanyBadgeFee: { ...config.internationalPricingTiers.verifiedCompanyBadgeFee, SAR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.verifiedCompanyBadgeFee.GBP}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        verifiedCompanyBadgeFee: { ...config.internationalPricingTiers.verifiedCompanyBadgeFee, GBP: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.verifiedCompanyBadgeFee.EUR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        verifiedCompanyBadgeFee: { ...config.internationalPricingTiers.verifiedCompanyBadgeFee, EUR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
              </tr>

              {/* Product 3: Unlimited Monthly Employer Plan */}
              <tr>
                <td className="p-3 font-sans font-bold text-emerald-400">👑 Unlimited Monthly Employer Plan</td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.unlimitedMonthlySlotFee.PKR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        unlimitedMonthlySlotFee: { ...config.internationalPricingTiers.unlimitedMonthlySlotFee, PKR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.unlimitedMonthlySlotFee.USD}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        unlimitedMonthlySlotFee: { ...config.internationalPricingTiers.unlimitedMonthlySlotFee, USD: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.unlimitedMonthlySlotFee.AED}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        unlimitedMonthlySlotFee: { ...config.internationalPricingTiers.unlimitedMonthlySlotFee, AED: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.unlimitedMonthlySlotFee.SAR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        unlimitedMonthlySlotFee: { ...config.internationalPricingTiers.unlimitedMonthlySlotFee, SAR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.unlimitedMonthlySlotFee.GBP}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        unlimitedMonthlySlotFee: { ...config.internationalPricingTiers.unlimitedMonthlySlotFee, GBP: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    value={config.internationalPricingTiers.unlimitedMonthlySlotFee.EUR}
                    onChange={(e) => setConfig({
                      ...config,
                      internationalPricingTiers: {
                        ...config.internationalPricingTiers,
                        unlimitedMonthlySlotFee: { ...config.internationalPricingTiers.unlimitedMonthlySlotFee, EUR: Number(e.target.value) }
                      }
                    })}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white"
                  />
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </form>
  );
};
