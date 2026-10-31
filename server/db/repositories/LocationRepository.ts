import fs from 'fs';
import path from 'path';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';
import { PAKISTAN_LOCATIONS } from '../../../src/data/pakistanLocations';
import { PakistanLocation } from '../../../src/types/job';
import { normalizeCityName, normalizeProvinceName } from '../../../src/utils/locationCatalog';

const COLLECTION_NAME = 'location_catalog';
const DATA_FILE = path.resolve(process.cwd(), 'data', 'location_catalog.json');

function readLocalLocations(): PakistanLocation[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error('[LocationRepository] Error reading local location_catalog.json:', err);
  }
  return JSON.parse(JSON.stringify(PAKISTAN_LOCATIONS));
}

function writeLocalLocations(locations: PakistanLocation[]): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(locations, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('[LocationRepository] Error writing local location_catalog.json:', err);
  }
}

export class LocationRepository {
  /**
   * Retrieves the current location catalog.
   * Authoritative source is MongoDB with local JSON file fallback.
   */
  static async getAll(): Promise<PakistanLocation[]> {
    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        const coll = db.collection(COLLECTION_NAME);
        const doc = await withMongoTimeout(coll.findOne({ _id: 'master_catalog' as any }));
        if (doc && Array.isArray(doc.locations) && doc.locations.length > 0) {
          return doc.locations;
        }

        // Initial Seed to MongoDB
        const defaultList = readLocalLocations();
        await withMongoTimeout(
          coll.updateOne(
            { _id: 'master_catalog' as any },
            { $set: { _id: 'master_catalog' as any, locations: defaultList, updatedAt: new Date().toISOString() } },
            { upsert: true }
          )
        );
        writeLocalLocations(defaultList);
        return defaultList;
      } catch (err) {
        console.warn('[LocationRepository] MongoDB query failed, falling back to local file storage:', err);
      }
    }

    return readLocalLocations();
  }

  /**
   * Persists the location catalog to MongoDB and local JSON fallback.
   */
  static async saveAll(locations: PakistanLocation[]): Promise<void> {
    writeLocalLocations(locations);

    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        const coll = db.collection(COLLECTION_NAME);
        await withMongoTimeout(
          coll.updateOne(
            { _id: 'master_catalog' as any },
            { $set: { _id: 'master_catalog' as any, locations, updatedAt: new Date().toISOString() } },
            { upsert: true }
          )
        );
      } catch (err) {
        console.error('[LocationRepository] Error saving location catalog to MongoDB:', err);
      }
    }
  }

  /**
   * Adds a new city under a specific province.
   * Prevents duplicate city names across the entire catalog.
   */
  static async addCity(
    provinceName: string,
    cityName: string,
    districts: string[] = []
  ): Promise<{ success: boolean; message: string; locations: PakistanLocation[] }> {
    const cleanCity = cityName.trim();
    const cleanProv = normalizeProvinceName(provinceName);

    if (!cleanCity) {
      return { success: false, message: 'City name cannot be blank.', locations: await this.getAll() };
    }
    if (!cleanProv) {
      return { success: false, message: 'Province must be selected.', locations: await this.getAll() };
    }

    const locations = await this.getAll();
    const normCity = normalizeCityName(cleanCity);

    // Check duplicate city
    for (const p of locations) {
      if (Array.isArray(p.cities)) {
        for (const c of p.cities) {
          if (normalizeCityName(c.name) === normCity) {
            return {
              success: false,
              message: `City "${cleanCity}" already exists under ${p.province}.`,
              locations
            };
          }
        }
      }
    }

    // Find target province
    let targetProv = locations.find(p => normalizeCityName(p.province) === normalizeCityName(cleanProv));
    if (!targetProv) {
      targetProv = { province: cleanProv, cities: [] };
      locations.push(targetProv);
    }

    if (!Array.isArray(targetProv.cities)) {
      targetProv.cities = [];
    }

    const defaultDistricts = districts && districts.length > 0 ? districts : [`${cleanCity} City`];
    targetProv.cities.push({
      name: cleanCity,
      districts: defaultDistricts
    });

    await this.saveAll(locations);
    return {
      success: true,
      message: `City "${cleanCity}" successfully added to ${targetProv.province}.`,
      locations
    };
  }

  /**
   * Edits an existing city name and/or reassigns it to a new province.
   * Preserves existing job location data (does not alter existing job records).
   */
  static async updateCity(
    oldCityName: string,
    newCityName: string,
    targetProvince: string,
    districts?: string[]
  ): Promise<{ success: boolean; message: string; locations: PakistanLocation[] }> {
    const cleanOld = oldCityName.trim();
    const cleanNew = newCityName.trim();
    const cleanProv = normalizeProvinceName(targetProvince);

    if (!cleanOld || !cleanNew || !cleanProv) {
      return { success: false, message: 'Existing city name, new city name, and province are required.', locations: await this.getAll() };
    }

    const locations = await this.getAll();
    const normOld = normalizeCityName(cleanOld);
    const normNew = normalizeCityName(cleanNew);

    // If changing name, ensure new name is not a duplicate elsewhere
    if (normOld !== normNew) {
      for (const p of locations) {
        for (const c of (p.cities || [])) {
          if (normalizeCityName(c.name) === normNew) {
            return {
              success: false,
              message: `Cannot rename to "${cleanNew}" because that city already exists under ${p.province}.`,
              locations
            };
          }
        }
      }
    }

    // Locate old city
    let foundCityObj: { name: string; districts: string[] } | null = null;
    let oldProvObj: PakistanLocation | null = null;

    for (const p of locations) {
      if (Array.isArray(p.cities)) {
        const idx = p.cities.findIndex(c => normalizeCityName(c.name) === normOld);
        if (idx !== -1) {
          foundCityObj = p.cities[idx];
          oldProvObj = p;
          p.cities.splice(idx, 1);
          break;
        }
      }
    }

    if (!foundCityObj || !oldProvObj) {
      return { success: false, message: `City "${cleanOld}" not found in catalog.`, locations };
    }

    // Add into target province
    let targetProvObj = locations.find(p => normalizeCityName(p.province) === normalizeCityName(cleanProv));
    if (!targetProvObj) {
      targetProvObj = { province: cleanProv, cities: [] };
      locations.push(targetProvObj);
    }
    if (!Array.isArray(targetProvObj.cities)) {
      targetProvObj.cities = [];
    }

    targetProvObj.cities.push({
      name: cleanNew,
      districts: districts && districts.length > 0 ? districts : foundCityObj.districts || [`${cleanNew} City`]
    });

    await this.saveAll(locations);
    return {
      success: true,
      message: `City "${cleanOld}" updated to "${cleanNew}" in ${cleanProv}.`,
      locations
    };
  }

  /**
   * Deletes a city from the catalog without altering existing job records.
   */
  static async deleteCity(cityName: string): Promise<{ success: boolean; message: string; locations: PakistanLocation[] }> {
    const cleanCity = cityName.trim();
    const normCity = normalizeCityName(cleanCity);

    const locations = await this.getAll();
    let removed = false;

    for (const p of locations) {
      if (Array.isArray(p.cities)) {
        const idx = p.cities.findIndex(c => normalizeCityName(c.name) === normCity);
        if (idx !== -1) {
          p.cities.splice(idx, 1);
          removed = true;
          break;
        }
      }
    }

    if (!removed) {
      return { success: false, message: `City "${cleanCity}" not found.`, locations };
    }

    await this.saveAll(locations);
    return { success: true, message: `City "${cleanCity}" removed from catalog.`, locations };
  }

  /**
   * Adds a new province to the catalog.
   */
  static async addProvince(provinceName: string): Promise<{ success: boolean; message: string; locations: PakistanLocation[] }> {
    const cleanProv = normalizeProvinceName(provinceName);
    if (!cleanProv) {
      return { success: false, message: 'Province name cannot be blank.', locations: await this.getAll() };
    }

    const locations = await this.getAll();
    const normProv = normalizeCityName(cleanProv);

    if (locations.some(p => normalizeCityName(p.province) === normProv)) {
      return { success: false, message: `Province "${cleanProv}" already exists.`, locations };
    }

    locations.push({ province: cleanProv, cities: [] });
    await this.saveAll(locations);
    return { success: true, message: `Province "${cleanProv}" added successfully.`, locations };
  }

  /**
   * Counts how many existing jobs in the database reference a given city.
   * Useful for presenting a warning to Admin before editing or remapping a city.
   */
  static async checkCityUsage(cityName: string): Promise<{ jobCount: number }> {
    const clean = cityName.trim();
    if (!clean) return { jobCount: 0 };

    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        const jobsColl = db.collection('jobs');
        const pendingColl = db.collection('pending_jobs');
        const regex = new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

        const [jobsCount, pendingCount] = await Promise.all([
          jobsColl.countDocuments({ city: regex }),
          pendingColl.countDocuments({ city: regex })
        ]);

        return { jobCount: jobsCount + pendingCount };
      } catch (err) {
        console.error('[LocationRepository] Error checking city usage in MongoDB:', err);
      }
    }

    // Local file fallback
    try {
      const jobsFile = path.resolve(process.cwd(), 'data', 'jobs.json');
      if (fs.existsSync(jobsFile)) {
        const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'));
        const count = (Array.isArray(jobs) ? jobs : []).filter(
          (j: any) => j.city && normalizeCityName(j.city) === normalizeCityName(clean)
        ).length;
        return { jobCount: count };
      }
    } catch {}

    return { jobCount: 0 };
  }
}
