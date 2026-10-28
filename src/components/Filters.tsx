import React, { useMemo } from 'react';
import { Search, Filter, MapPin, X, RotateCcw, ChevronDown, Sparkles, SlidersHorizontal, Globe } from 'lucide-react';
import { JobFilters, Region, JobType } from '../types/job';
import { PAKISTAN_LOCATIONS } from '../data/pakistanLocations';
import { CountryOption, SUPPORTED_COUNTRIES } from '../types/landing';

interface FiltersProps {
  filters: JobFilters;
  onChange: (updated: JobFilters) => void;
  onReset: () => void;
  totalResults: number;
  postsPerPage?: number;
  onPostsPerPageChange?: (postsPerPage: number) => void;
  userSelectedCountry?: CountryOption | null;
  onOpenCountryModal?: () => void;
}

export const Filters: React.FC<FiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalResults,
  postsPerPage = 10,
  onPostsPerPageChange,
  userSelectedCountry,
  onOpenCountryModal
}) => {
  // Compute available Cities based on selected Province
  const availableCities = useMemo(() => {
    if (!filters.province) return [];
    const provData = (PAKISTAN_LOCATIONS || []).find(p => p && p.province === filters.province);
    return provData && Array.isArray(provData.cities) ? provData.cities : [];
  }, [filters.province]);

  // Compute available Districts based on selected City
  const availableDistricts = useMemo(() => {
    if (!filters.city || !availableCities || !availableCities.length) return [];
    const cityData = (availableCities || []).find(c => c && c.name === filters.city);
    return cityData && Array.isArray(cityData.districts) ? cityData.districts : [];
  }, [filters.city, availableCities]);

  // Handle Region change
  const handleRegionChange = (newRegion: string) => {
    onChange({
      ...filters,
      region: newRegion,
      province: newRegion === 'Pakistan' ? filters.province : '',
      city: newRegion === 'Pakistan' ? filters.city : '',
      district: newRegion === 'Pakistan' ? filters.district : ''
    });
  };

  // Handle Province change
  const handleProvinceChange = (newProvince: string) => {
    onChange({
      ...filters,
      province: newProvince,
      city: '',
      district: ''
    });
  };

  // Handle City change
  const handleCityChange = (newCity: string) => {
    onChange({
      ...filters,
      city: newCity,
      district: ''
    });
  };

  // Check if any filter is active
  const hasActiveFilters =
    filters.searchQuery !== '' ||
    filters.jobType !== 'All' ||
    filters.region !== 'All' ||
    filters.province !== '' ||
    filters.city !== '' ||
    filters.district !== '' ||
    filters.experienceLevel !== 'All' ||
    filters.sortBy !== 'latest';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-6 shadow-2xl mb-3 sm:mb-8 relative z-20">
      
      {/* Top Search Bar */}
      <div className="flex flex-col md:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 sm:w-5 h-3.5 sm:h-5 text-slate-400" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            placeholder="Search job title, company name, or tech skills (e.g. React, Python, Remote)..."
            className="w-full pl-8 sm:pl-11 pr-8 sm:pr-10 py-2 sm:py-3.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-xs sm:text-sm"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ ...filters, searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Sort & Posts Per Page Controls - Side-by-side on mobile, inline on desktop */}
        <div className="grid grid-cols-2 sm:flex gap-1.5 sm:gap-2.5 w-full md:w-auto">
          {/* Quick Sort Control */}
          <div className="w-full sm:w-48">
            <select
              value={filters.sortBy}
              onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
              className="w-full px-2 sm:px-3.5 py-1.5 sm:py-3.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-slate-200 text-[11px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            >
              <option value="latest">Sort: Most Recent</option>
              <option value="salary-high">Sort: Highest Salary</option>
              <option value="salary-low">Sort: Lowest Salary</option>
              <option value="popular">Sort: Most Popular</option>
            </select>
          </div>

          {/* Posts Per Page Filter Select */}
          {onPostsPerPageChange && (
            <div className="w-full sm:w-36">
              <select
                value={postsPerPage}
                onChange={(e) => onPostsPerPageChange(Number(e.target.value))}
                className="w-full px-2 sm:px-3.5 py-1.5 sm:py-3.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-slate-200 text-[11px] sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                title="Select number of job posts per page"
              >
                <option value={10}>10 / page</option>
                <option value={15}>15 / page</option>
                <option value={20}>20 / page</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Filter Grid - 2x2 on Mobile, 4 columns on Desktop */}
      <div className="mt-2.5 sm:mt-4 pt-2.5 sm:pt-4 border-t border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        
        {/* Job Type */}
        <div>
          <label className="block text-[10px] sm:text-xs font-semibold text-slate-400 mb-1 sm:mb-1.5 uppercase tracking-wider">
            Job Type
          </label>
          <select
            value={filters.jobType}
            onChange={(e) => onChange({ ...filters, jobType: e.target.value })}
            className="w-full px-2 sm:px-3.5 py-1.5 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="All">All Types</option>
            <option value="Remote">100% Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
          </select>
        </div>

        {/* Region / Country */}
        <div>
          <div className="flex items-center justify-between mb-1 sm:mb-1.5">
            <label className="block text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
              Region
            </label>
            {onOpenCountryModal && (
              <button
                type="button"
                onClick={onOpenCountryModal}
                className="text-[10px] sm:text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-0.5 sm:space-x-1 cursor-pointer transition-colors"
                title="Open country picker dialog"
              >
                <span>{userSelectedCountry?.flag || '🌐'}</span>
                <span className="underline decoration-emerald-500/40 underline-offset-2">Switch</span>
              </button>
            )}
          </div>
          <select
            value={filters.region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="w-full px-2 sm:px-3.5 py-1.5 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="All">🌐 All Regions</option>
            <option value="Global">🌐 Global Remote</option>
            {SUPPORTED_COUNTRIES.filter(c => c.code !== 'GL').map((c) => (
              <option key={c.code} value={c.region || c.name}>
                {c.flag} {c.name} {c.code === 'PK' ? '(Provinces)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Experience Level */}
        <div>
          <label className="block text-[10px] sm:text-xs font-semibold text-slate-400 mb-1 sm:mb-1.5 uppercase tracking-wider">
            Experience
          </label>
          <select
            value={filters.experienceLevel}
            onChange={(e) => onChange({ ...filters, experienceLevel: e.target.value })}
            className="w-full px-2 sm:px-3.5 py-1.5 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="All">All Levels</option>
            <option value="Entry">Entry / Junior</option>
            <option value="Mid">Mid (2-4 yrs)</option>
            <option value="Senior">Senior (5+ yrs)</option>
            <option value="Lead">Team Lead</option>
          </select>
        </div>

        {/* Dynamic Pakistan Sub-filters container indicator / Reset */}
        <div className="flex items-end">
          {hasActiveFilters ? (
            <button
              onClick={onReset}
              className="w-full py-1.5 sm:py-2.5 px-2 sm:px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center justify-center space-x-1 sm:space-x-1.5 transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          ) : (
            <div className="w-full py-1.5 sm:py-2.5 px-2 sm:px-3 bg-slate-950/50 rounded-lg text-[11px] sm:text-xs text-slate-500 flex items-center justify-center space-x-1 border border-slate-800/40">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter instantly</span>
            </div>
          )}
        </div>

      </div>

      {/* DYNAMIC PAKISTAN SUB-DROPDOWNS (Province, City, District) */}
      {filters.region === 'Pakistan' && (
        <div className="mt-2.5 sm:mt-4 pt-2.5 sm:pt-4 border-t border-emerald-500/20 bg-emerald-950/20 rounded-lg sm:rounded-xl p-2.5 sm:p-4 border">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[11px] sm:text-xs uppercase tracking-wider mb-2 sm:mb-3">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Pakistan Detailed Location (Province → City → District)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* Province Dropdown */}
            <div>
              <label className="block text-[10px] sm:text-xs text-emerald-300 font-medium mb-1 truncate">
                1. Select Province
              </label>
              <select
                value={filters.province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-950 border border-emerald-500/30 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Provinces</option>
                {PAKISTAN_LOCATIONS.map((loc) => (
                  <option key={loc.province} value={loc.province}>
                    {loc.province}
                  </option>
                ))}
              </select>
            </div>

            {/* City Dropdown */}
            <div>
              <label className="block text-[10px] sm:text-xs text-emerald-300 font-medium mb-1 truncate">
                2. Select City
              </label>
              <select
                value={filters.city}
                onChange={(e) => handleCityChange(e.target.value)}
                disabled={!filters.province}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-950 border border-emerald-500/30 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!filters.province ? 'Province first' : 'All Cities'}
                </option>
                {availableCities.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {/* District Dropdown */}
            <div>
              <label className="block text-[10px] sm:text-xs text-emerald-300 font-medium mb-1 truncate">
                3. District / Area
              </label>
              <select
                value={filters.district}
                onChange={(e) => onChange({ ...filters, district: e.target.value })}
                disabled={!filters.city}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-950 border border-emerald-500/30 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!filters.city ? 'City first' : 'All Districts'}
                </option>
                {availableDistricts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile-only Quick Location Clear Button to balance 2x2 grid */}
            <div className="sm:hidden flex items-end">
              {(filters.province || filters.city || filters.district) ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, province: '', city: '', district: '' })}
                  className="w-full py-1.5 px-2 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition-all"
                  title="Clear selected province, city, and district"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Location</span>
                </button>
              ) : (
                <div className="w-full py-1.5 px-2 text-slate-500 text-[10px] text-center border border-dashed border-emerald-500/20 rounded-lg flex items-center justify-center">
                  <span>PK Detailed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Badges */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/80 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400">Showing <strong className="text-emerald-400 font-bold">{totalResults}</strong> job opportunities</span>
          
          {filters.jobType !== 'All' && (
            <span className="inline-flex items-center space-x-1 bg-slate-800 text-slate-200 px-2.5 py-1 rounded-full border border-slate-700">
              <span>Type: {filters.jobType}</span>
              <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-white" onClick={() => onChange({ ...filters, jobType: 'All' })} />
            </span>
          )}

          {filters.region !== 'All' && (
            <span className="inline-flex items-center space-x-1 bg-slate-800 text-slate-200 px-2.5 py-1 rounded-full border border-slate-700">
              <span>Region: {filters.region}</span>
              <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-white" onClick={() => handleRegionChange('All')} />
            </span>
          )}

          {filters.province && (
            <span className="inline-flex items-center space-x-1 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <span>Province: {filters.province}</span>
              <X className="w-3 h-3 cursor-pointer text-emerald-400 hover:text-white" onClick={() => handleProvinceChange('')} />
            </span>
          )}

          {filters.city && (
            <span className="inline-flex items-center space-x-1 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <span>City: {filters.city}</span>
              <X className="w-3 h-3 cursor-pointer text-emerald-400 hover:text-white" onClick={() => handleCityChange('')} />
            </span>
          )}

          {filters.district && (
            <span className="inline-flex items-center space-x-1 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <span>District: {filters.district}</span>
              <X className="w-3 h-3 cursor-pointer text-emerald-400 hover:text-white" onClick={() => onChange({ ...filters, district: '' })} />
            </span>
          )}

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="inline-flex items-center space-x-1 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-full border border-rose-500/20 transition-all font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
