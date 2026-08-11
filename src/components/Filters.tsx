import React, { useMemo } from 'react';
import { Search, Filter, MapPin, X, RotateCcw, ChevronDown, Sparkles, SlidersHorizontal } from 'lucide-react';
import { JobFilters, Region, JobType } from '../types/job';
import { PAKISTAN_LOCATIONS } from '../data/pakistanLocations';

interface FiltersProps {
  filters: JobFilters;
  onChange: (updated: JobFilters) => void;
  onReset: () => void;
  totalResults: number;
}

export const Filters: React.FC<FiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalResults
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl mb-8 relative z-20">
      
      {/* Top Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            placeholder="Search job title, company name, or tech skills (e.g. React, Python, Remote)..."
            className="w-full pl-11 pr-10 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ ...filters, searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Sort Control */}
        <div className="w-full md:w-56">
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
            className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          >
            <option value="latest">Sort: Most Recent</option>
            <option value="salary-high">Sort: Highest Salary</option>
            <option value="salary-low">Sort: Lowest Salary</option>
            <option value="popular">Sort: Most Popular</option>
          </select>
        </div>
      </div>

      {/* Main Filter Grid */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Job Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Job Type
          </label>
          <select
            value={filters.jobType}
            onChange={(e) => onChange({ ...filters, jobType: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="All">All Job Types</option>
            <option value="Remote">100% Remote</option>
            <option value="Hybrid">Hybrid (Office + Remote)</option>
            <option value="On-site">On-site Office</option>
          </select>
        </div>

        {/* Region */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Region / Location
          </label>
          <select
            value={filters.region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="All">All Regions Worldwide</option>
            <option value="Global">Global International Remote</option>
            <option value="Pakistan">🇵🇰 Pakistan (Sub-Districts Unlocked)</option>
            <option value="US">🇺🇸 United States</option>
            <option value="UK">🇬🇧 United Kingdom</option>
          </select>
        </div>

        {/* Experience Level */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Experience Level
          </label>
          <select
            value={filters.experienceLevel}
            onChange={(e) => onChange({ ...filters, experienceLevel: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="All">All Levels</option>
            <option value="Entry">Entry Level / Junior</option>
            <option value="Mid">Mid Level (2-4 yrs)</option>
            <option value="Senior">Senior Level (5+ yrs)</option>
            <option value="Lead">Team Lead / Principal</option>
          </select>
        </div>

        {/* Dynamic Pakistan Sub-filters container indicator */}
        <div className="flex items-end">
          {hasActiveFilters ? (
            <button
              onClick={onReset}
              className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          ) : (
            <div className="w-full py-2.5 px-3 bg-slate-950/50 rounded-lg text-xs text-slate-500 flex items-center justify-center space-x-1 border border-slate-800/40">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter instantly</span>
            </div>
          )}
        </div>

      </div>

      {/* DYNAMIC PAKISTAN SUB-DROPDOWNS (Province, City, District) */}
      {filters.region === 'Pakistan' && (
        <div className="mt-4 pt-4 border-t border-emerald-500/20 bg-emerald-950/20 rounded-xl p-4 border">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-3">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Pakistan Detailed Location Filtering (Province → City → District)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Province Dropdown */}
            <div>
              <label className="block text-xs text-emerald-300 font-medium mb-1">
                1. Select Province
              </label>
              <select
                value={filters.province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <label className="block text-xs text-emerald-300 font-medium mb-1">
                2. Select City
              </label>
              <select
                value={filters.city}
                onChange={(e) => handleCityChange(e.target.value)}
                disabled={!filters.province}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!filters.province ? 'Select Province first' : 'All Cities'}
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
              <label className="block text-xs text-emerald-300 font-medium mb-1">
                3. Select District / Area
              </label>
              <select
                value={filters.district}
                onChange={(e) => onChange({ ...filters, district: e.target.value })}
                disabled={!filters.city}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!filters.city ? 'Select City first' : 'All Districts'}
                </option>
                {availableDistricts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Badges */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400">Showing <strong className="text-emerald-400">{totalResults}</strong> job opportunities</span>
          
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
        </div>
      </div>

    </div>
  );
};
