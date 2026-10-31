import { PakistanLocation } from '../types/job';
import { PAKISTAN_LOCATIONS } from '../data/pakistanLocations';

export interface CityProvinceMapping {
  city: string;
  province: string;
}

/**
 * Standard authoritative mappings required at minimum:
 * Lahore -> Punjab
 * Rawalpindi -> Punjab
 * Faisalabad -> Punjab
 * Gujranwala -> Punjab
 * Karachi -> Sindh
 * Islamabad -> Islamabad Capital Territory
 */
export const CORE_VERIFIED_CITY_MAP: Record<string, string> = {
  'lahore': 'Punjab',
  'rawalpindi': 'Punjab',
  'faisalabad': 'Punjab',
  'gujranwala': 'Punjab',
  'karachi': 'Sindh',
  'islamabad': 'Islamabad Capital Territory',
  'multan': 'Punjab',
  'sialkot': 'Punjab',
  'hyderabad': 'Sindh',
  'sukkur': 'Sindh',
  'peshawar': 'Khyber Pakhtunkhwa (KPK)',
  'abbottabad': 'Khyber Pakhtunkhwa (KPK)',
  'mardan': 'Khyber Pakhtunkhwa (KPK)',
  'quetta': 'Balochistan',
  'gwadar': 'Balochistan'
};

/**
 * Normalizes a city name by trimming whitespace and lowercasing for reliable case-insensitive matching.
 */
export function normalizeCityName(cityName?: string | null): string {
  if (!cityName || typeof cityName !== 'string') return '';
  return cityName.trim().toLowerCase();
}

/**
 * Normalizes a province name by trimming whitespace.
 */
export function normalizeProvinceName(provinceName?: string | null): string {
  if (!provinceName || typeof provinceName !== 'string') return '';
  return provinceName.trim();
}

/**
 * Looks up the authoritative province for a given city from the location catalog or default catalog.
 * Returns null if the city is unknown or blank (never fabricates or guesses a province).
 */
export function getProvinceForCity(
  cityName?: string | null,
  catalog: PakistanLocation[] = PAKISTAN_LOCATIONS
): string | null {
  const normalized = normalizeCityName(cityName);
  if (!normalized) return null;

  // 1. Check in core verified map first for instant precision
  if (CORE_VERIFIED_CITY_MAP[normalized]) {
    return CORE_VERIFIED_CITY_MAP[normalized];
  }

  // 2. Search dynamically across the provided catalog
  for (const prov of catalog) {
    if (!prov || !Array.isArray(prov.cities)) continue;
    for (const c of prov.cities) {
      if (c && normalizeCityName(c.name) === normalized) {
        return prov.province;
      }
    }
  }

  // Unknown city - return null (strictly do not invent a province)
  return null;
}

/**
 * Checks whether a city is known in the catalog.
 */
export function isKnownCity(
  cityName?: string | null,
  catalog: PakistanLocation[] = PAKISTAN_LOCATIONS
): boolean {
  return getProvinceForCity(cityName, catalog) !== null;
}

/**
 * Flattens the catalog into a simple array of all cities.
 */
export function getAllCatalogCities(catalog: PakistanLocation[] = PAKISTAN_LOCATIONS): string[] {
  const cities: string[] = [];
  for (const prov of catalog) {
    if (prov && Array.isArray(prov.cities)) {
      for (const c of prov.cities) {
        if (c && c.name && !cities.includes(c.name)) {
          cities.push(c.name);
        }
      }
    }
  }
  return cities.sort((a, b) => a.localeCompare(b));
}

/**
 * Returns all unique province names from the catalog.
 */
export function getAllCatalogProvinces(catalog: PakistanLocation[] = PAKISTAN_LOCATIONS): string[] {
  const provinces: string[] = [];
  for (const prov of catalog) {
    if (prov && prov.province && !provinces.includes(prov.province)) {
      provinces.push(prov.province);
    }
  }
  return provinces;
}
