import React, { useState, useMemo } from 'react';
import { Globe, Search, Check, MapPin, Sparkles, X, ChevronRight } from 'lucide-react';
import { CountryOption, SUPPORTED_COUNTRIES } from '../types/landing';

interface CountrySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCountry: (country: CountryOption) => void;
  currentSelectedCode?: string;
  isInitialRequired?: boolean;
}

export const CountrySelectionModal: React.FC<CountrySelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectCountry,
  currentSelectedCode,
  isInitialRequired = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState<string>(currentSelectedCode || 'PK');

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return SUPPORTED_COUNTRIES;
    const q = searchQuery.toLowerCase();
    return SUPPORTED_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameUrdu.includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleConfirm = (country: CountryOption) => {
    setSelectedCode(country.code);
    onSelectCountry(country);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        id="country-selection-modal"
        className="relative w-full max-w-xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden text-slate-100 max-h-[90vh] flex flex-col"
      >
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-white">Select Your Country / ملک منتخب کریں</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Step 1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                آپ جس ملک کی جابز دیکھنا چاہتے ہیں وہ منتخب کریں (Personalized Job Feed)
              </p>
            </div>
          </div>

          {!isInitialRequired && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search country / ملک تلاش کریں (e.g. Pakistan, Saudi Arabia, UAE, UK...)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Popular Chips */}
          <div className="flex items-center space-x-1.5 mt-3 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap mr-1">Popular:</span>
            {SUPPORTED_COUNTRIES.filter((c) => c.popular && c.code !== 'GL').slice(0, 5).map((c) => (
              <button
                key={c.code}
                onClick={() => handleConfirm(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 whitespace-nowrap cursor-pointer ${
                  selectedCode === c.code
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/50'
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Country Grid / List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1 scrollbar-thin">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredCountries.map((country) => {
              const isSelected = selectedCode === country.code;
              return (
                <button
                  key={country.code}
                  onClick={() => handleConfirm(country)}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-amber-500 shadow-md shadow-amber-500/10 text-white'
                      : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="text-2xl shrink-0 drop-shadow-sm">{country.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-black text-white group-hover:text-amber-400 transition-colors truncate">
                          {country.name}
                        </span>
                        {country.code === 'PK' && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                            Primary
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium font-urdu block truncate">
                        {country.nameUrdu}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredCountries.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm font-semibold">No country matching "{searchQuery}" found.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-amber-400 font-bold hover:underline"
              >
                Reset Search
              </button>
            </div>
          )}
        </div>

        {/* Footer info & Confirmation */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>You can change your country anytime from the header switch.</span>
          </div>

          <button
            onClick={() => {
              const c = SUPPORTED_COUNTRIES.find((x) => x.code === selectedCode) || SUPPORTED_COUNTRIES[0];
              handleConfirm(c);
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <span>Confirm Selection</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
