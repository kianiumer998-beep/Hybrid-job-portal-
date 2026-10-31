import React, { useState, useEffect } from 'react';
import { PakistanLocation } from '../../types/job';
import { api } from '../../services/api';
import { 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Building, 
  X, 
  Check, 
  Globe 
} from 'lucide-react';
import { normalizeCityName } from '../../utils/locationCatalog';

export const AdminLocationManager: React.FC = () => {
  const [locations, setLocations] = useState<PakistanLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvinceFilter, setSelectedProvinceFilter] = useState('All');
  
  // Feedback notices
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Add City Modal State
  const [isAddCityOpen, setIsAddCityOpen] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [newCityProvince, setNewCityProvince] = useState('');
  const [newCityDistricts, setNewCityDistricts] = useState('');
  const [isAddingCity, setIsAddingCity] = useState(false);

  // Edit City Modal State
  const [editingCity, setEditingCity] = useState<{ oldName: string; currentProvince: string } | null>(null);
  const [editCityName, setEditCityName] = useState('');
  const [editCityProvince, setEditCityProvince] = useState('');
  const [editCityDistricts, setEditCityDistricts] = useState('');
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [cityUsageCount, setCityUsageCount] = useState<number | null>(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  // Add Province Modal State
  const [isAddProvinceOpen, setIsAddProvinceOpen] = useState(false);
  const [newProvinceName, setNewProvinceName] = useState('');
  const [isAddingProvince, setIsAddingProvince] = useState(false);

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const res = await api.locations.getAll();
      if (res?.success && Array.isArray(res.locations)) {
        setLocations(res.locations);
        if (res.locations.length > 0 && !newCityProvince) {
          setNewCityProvince(res.locations[0].province);
        }
      }
    } catch (err: any) {
      console.error('Error fetching locations:', err);
      setStatusMessage({ text: 'Failed to load location catalog.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const clearNotice = () => {
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Add City Handler
  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim() || !newCityProvince.trim()) return;

    setIsAddingCity(true);
    setStatusMessage(null);
    try {
      const districtsArr = newCityDistricts
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);

      const res = await api.locations.addCity({
        cityName: newCityName.trim(),
        provinceName: newCityProvince.trim(),
        districts: districtsArr.length > 0 ? districtsArr : undefined
      });

      if (res?.success) {
        if (Array.isArray(res.locations)) setLocations(res.locations);
        setStatusMessage({ text: res.message || `City "${newCityName.trim()}" added successfully.`, type: 'success' });
        setNewCityName('');
        setNewCityDistricts('');
        setIsAddCityOpen(false);
        clearNotice();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to add city.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Error adding city.', type: 'error' });
    } finally {
      setIsAddingCity(false);
    }
  };

  // Start Edit City (with usage check)
  const handleStartEdit = async (cityName: string, currentProv: string, currentDistricts: string[] = []) => {
    setEditingCity({ oldName: cityName, currentProvince: currentProv });
    setEditCityName(cityName);
    setEditCityProvince(currentProv);
    setEditCityDistricts(currentDistricts.join(', '));
    setCityUsageCount(null);
    setIsCheckingUsage(true);

    try {
      const usageRes = await api.locations.getCityUsage(cityName);
      if (usageRes?.success && typeof usageRes.jobCount === 'number') {
        setCityUsageCount(usageRes.jobCount);
      }
    } catch (err) {
      console.error('Error checking city usage:', err);
    } finally {
      setIsCheckingUsage(false);
    }
  };

  // Save Edit City
  const handleSaveEditCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity || !editCityName.trim() || !editCityProvince.trim()) return;

    setIsEditingCity(true);
    setStatusMessage(null);
    try {
      const districtsArr = editCityDistricts
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);

      const res = await api.locations.updateCity(editingCity.oldName, {
        newCityName: editCityName.trim(),
        targetProvince: editCityProvince.trim(),
        districts: districtsArr.length > 0 ? districtsArr : undefined
      });

      if (res?.success) {
        if (Array.isArray(res.locations)) setLocations(res.locations);
        setStatusMessage({ text: res.message || `City updated to "${editCityName.trim()}".`, type: 'success' });
        setEditingCity(null);
        clearNotice();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to update city.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Error updating city.', type: 'error' });
    } finally {
      setIsEditingCity(false);
    }
  };

  // Delete City
  const handleDeleteCity = async (cityName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${cityName}" from the location catalog?\n\nNote: Existing jobs with this location will preserve their historical data.`
    );
    if (!confirmed) return;

    setStatusMessage(null);
    try {
      const res = await api.locations.deleteCity(cityName);
      if (res?.success) {
        if (Array.isArray(res.locations)) setLocations(res.locations);
        setStatusMessage({ text: `City "${cityName}" removed from catalog.`, type: 'success' });
        clearNotice();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to remove city.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Error deleting city.', type: 'error' });
    }
  };

  // Add Province Handler
  const handleAddProvince = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvinceName.trim()) return;

    setIsAddingProvince(true);
    setStatusMessage(null);
    try {
      const res = await api.locations.addProvince(newProvinceName.trim());
      if (res?.success) {
        if (Array.isArray(res.locations)) setLocations(res.locations);
        setStatusMessage({ text: `Province "${newProvinceName.trim()}" added successfully.`, type: 'success' });
        setNewProvinceName('');
        setIsAddProvinceOpen(false);
        clearNotice();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to add province.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Error adding province.', type: 'error' });
    } finally {
      setIsAddingProvince(false);
    }
  };

  // Filtered Cities
  const filteredProvinces = locations.filter(p => {
    if (selectedProvinceFilter !== 'All' && p.province !== selectedProvinceFilter) {
      return false;
    }
    return true;
  });

  const allFilteredCities = filteredProvinces.flatMap(p => 
    (p.cities || []).map(c => ({
      cityName: c.name,
      provinceName: p.province,
      districts: c.districts || []
    }))
  ).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return item.cityName.toLowerCase().includes(q) || item.provinceName.toLowerCase().includes(q);
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              Location Catalog & City/Province Management
            </h3>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              Authorized Admin
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative Pakistan location master catalog. Maps cities to provinces, validates duplicate prevention, and powers automatic job location detection.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsAddCityOpen(true)}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add City</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddProvinceOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-semibold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Add Province</span>
          </button>

          <button
            type="button"
            onClick={fetchLocations}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
          statusMessage.type === 'success'
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
            : statusMessage.type === 'warning'
            ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog cities or provinces..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-400 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 shrink-0">Filter Province:</span>
          <select
            value={selectedProvinceFilter}
            onChange={(e) => setSelectedProvinceFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-semibold outline-none flex-1 sm:flex-none"
          >
            <option value="All">All Provinces ({locations.length})</option>
            {locations.map(p => (
              <option key={p.province} value={p.province}>
                {p.province} ({p.cities?.length || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cities Catalog Grid */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">
            Available Cities ({allFilteredCities.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Case-insensitive unique indexing enforced
          </span>
        </div>

        {allFilteredCities.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No matching cities found in location catalog.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
            {allFilteredCities.map((item) => (
              <div
                key={`${item.provinceName}-${item.cityName}`}
                className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-white block truncate">
                      {item.cityName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Province: <strong className="text-emerald-400">{item.provinceName}</strong>
                      {item.districts.length > 0 && ` • Areas: ${item.districts.slice(0, 3).join(', ')}${item.districts.length > 3 ? ` (+${item.districts.length - 3})` : ''}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item.cityName, item.provinceName, item.districts)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Edit City or Change Province"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCity(item.cityName)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors cursor-pointer"
                    title="Remove City from Catalog"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: ADD CITY */}
      {isAddCityOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add New City to Catalog</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddCityOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCity} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  City Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  placeholder="e.g. Sahiwal, Kasur, Jhelum"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Province Selection *
                </label>
                <select
                  required
                  value={newCityProvince}
                  onChange={(e) => setNewCityProvince(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-semibold focus:border-emerald-400 outline-none"
                >
                  <option value="">-- Select Province --</option>
                  {locations.map(p => (
                    <option key={p.province} value={p.province}>{p.province}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Districts / Sub-areas (Optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={newCityDistricts}
                  onChange={(e) => setNewCityDistricts(e.target.value)}
                  placeholder="e.g. Civil Lines, Cantt, Satellite Town"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-emerald-400 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCityOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingCity}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAddingCity && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save City to Catalog</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CITY (WITH USAGE WARNING) */}
      {editingCity && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <span>Edit City Mapping</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingCity(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning if jobs already use this city */}
            {cityUsageCount !== null && cityUsageCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl text-xs text-amber-300 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">City In Use Warning</strong>
                  <span>
                    <strong>{cityUsageCount}</strong> job(s) in the database currently reference "{editingCity.oldName}". Existing job records will preserve their location data.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveEditCity} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  City Name *
                </label>
                <input
                  type="text"
                  required
                  value={editCityName}
                  onChange={(e) => setEditCityName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Province Selection *
                </label>
                <select
                  required
                  value={editCityProvince}
                  onChange={(e) => setEditCityProvince(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-semibold focus:border-amber-400 outline-none"
                >
                  {locations.map(p => (
                    <option key={p.province} value={p.province}>{p.province}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Districts / Sub-areas (Comma-separated)
                </label>
                <input
                  type="text"
                  value={editCityDistricts}
                  onChange={(e) => setEditCityDistricts(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-amber-400 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCity(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditingCity}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isEditingCity && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD PROVINCE */}
      {isAddProvinceOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>Add New Province / Territory</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddProvinceOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProvince} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Province / Territory Name *
                </label>
                <input
                  type="text"
                  required
                  value={newProvinceName}
                  onChange={(e) => setNewProvinceName(e.target.value)}
                  placeholder="e.g. Gilgit-Baltistan, Azad Kashmir (AJK)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-400 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddProvinceOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingProvince}
                  className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAddingProvince && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Province</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
