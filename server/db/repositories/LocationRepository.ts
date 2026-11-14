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
        if (Array.isArray(parsed)) {
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
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(locations, null, 2), 'utf-8');
  fs.renameSync(tempFile, DATA_FILE);
}

export class LocationRepository {
  private static mockCollection: any = null;
  private static mockJobsCollection: any = null;
  private static mockPendingJobsCollection: any = null;

  /**
   * Test-only helper to exercise MongoDB read/save/failure behavior without touching live MongoDB or local JSON.
   * Strictly rejected outside test mode (IS_TEST !== 'true').
   */
  static setMockCollection(coll: any): void {
    if (coll !== null && process.env.IS_TEST !== 'true') {
      throw new Error('Security violation: Mock collection injection is strictly prohibited outside test mode (IS_TEST !== true).');
    }
    LocationRepository.mockCollection = coll;
  }

  static setMockUsageCollections(jobsColl: any, pendingJobsColl: any = null): void {
    if ((jobsColl !== null || pendingJobsColl !== null) && process.env.IS_TEST !== 'true') {
      throw new Error('Security violation: Mock usage collections injection is strictly prohibited outside test mode (IS_TEST !== true).');
    }
    LocationRepository.mockJobsCollection = jobsColl;
    LocationRepository.mockPendingJobsCollection = pendingJobsColl;
  }

  private static useMongoBackend(): boolean {
    return isMongoConfigured() || (process.env.IS_TEST === 'true' && LocationRepository.mockCollection !== null);
  }

  private static async getCatalogCollection(): Promise<any> {
    if (process.env.IS_TEST === 'true' && LocationRepository.mockCollection !== null) {
      return LocationRepository.mockCollection;
    }
    const db = await getMongoDb();
    return db.collection(COLLECTION_NAME);
  }

  /**
   * Retrieves the current location catalog.
   * When MongoDB is configured, MongoDB is the strict single source of truth and errors fail closed.
   * Empty catalogs (`locations: []`) are respected without reseeding defaults.
   */
  static async getAll(): Promise<PakistanLocation[]> {
    if (LocationRepository.useMongoBackend()) {
      try {
        const coll = await LocationRepository.getCatalogCollection();
        const doc = await withMongoTimeout<any>(
          coll.findOne({ _id: 'master_catalog' as any }),
          10000,
          'fetch location catalog'
        );
        if (doc && Array.isArray(doc.locations)) {
          return doc.locations;
        }

        // First-run atomic seed when document is genuinely missing
        const defaultList = readLocalLocations();
        const seedRes = await withMongoTimeout<any>(
          coll.updateOne(
            { _id: 'master_catalog' as any },
            {
              $setOnInsert: {
                _id: 'master_catalog' as any,
                locations: defaultList,
                updatedAt: new Date().toISOString()
              }
            },
            { upsert: true }
          ),
          10000,
          'seed initial location catalog'
        );
        if (seedRes && seedRes.acknowledged === false) {
          throw new Error('Initial location catalog seed was not acknowledged by MongoDB.');
        }

        const confirmed = await withMongoTimeout<any>(
          coll.findOne({ _id: 'master_catalog' as any }),
          10000,
          'confirm seeded location catalog'
        );
        if (confirmed && Array.isArray(confirmed.locations)) {
          return confirmed.locations;
        }
        return defaultList;
      } catch (err: any) {
        console.error('[LocationRepository] MongoDB read failed:', err?.message || err);
        throw new Error(`Authoritative location database is unavailable: ${err?.message || err}`);
      }
    }

    return readLocalLocations();
  }

  /**
   * Persists the location catalog.
   * When MongoDB is configured, persists ONLY to MongoDB and fails closed on any error
   * without touching data/location_catalog.json.
   * When MongoDB is unconfigured, persists to data/location_catalog.json and throws on write failure.
   */
  static async saveAll(locations: PakistanLocation[]): Promise<void> {
    if (LocationRepository.useMongoBackend()) {
      try {
        const coll = await LocationRepository.getCatalogCollection();
        const result = await withMongoTimeout<any>(
          coll.updateOne(
            { _id: 'master_catalog' as any },
            { $set: { _id: 'master_catalog' as any, locations, updatedAt: new Date().toISOString() } },
            { upsert: true }
          ),
          12000,
          'save location catalog'
        );
        if (result && result.acknowledged === false) {
          throw new Error('Write not acknowledged by MongoDB.');
        }
        return;
      } catch (err: any) {
        console.error('[LocationRepository] Error saving location catalog to MongoDB:', err?.message || err);
        throw new Error(`Durable location persistence failed: ${err?.message || err}`);
      }
    }

    writeLocalLocations(locations);
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

    const useMockUsage =
      process.env.IS_TEST === 'true' &&
      (LocationRepository.mockJobsCollection !== null || LocationRepository.mockPendingJobsCollection !== null);

    if (isMongoConfigured() || useMockUsage) {
      try {
        let jobsColl = LocationRepository.mockJobsCollection;
        let pendingColl = LocationRepository.mockPendingJobsCollection;
        if (!useMockUsage) {
          const db = await getMongoDb();
          jobsColl = db.collection('jobs');
          pendingColl = db.collection('pending_jobs');
        }
        const regex = new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

        const [jobsCount, pendingCount] = await Promise.all([
          jobsColl ? withMongoTimeout(jobsColl.countDocuments({ city: regex }), 10000, 'count live jobs by city') : Promise.resolve(0),
          pendingColl ? withMongoTimeout(pendingColl.countDocuments({ city: regex }), 10000, 'count pending jobs by city') : Promise.resolve(0)
        ]);

        return { jobCount: Number(jobsCount || 0) + Number(pendingCount || 0) };
      } catch (err: any) {
        console.error('[LocationRepository] Error checking city usage in MongoDB:', err?.message || err);
        throw new Error(`Authoritative location usage check failed: ${err?.message || err}`);
      }
    }

    // Local file storage when MongoDB is not configured
    const jobsFile = path.resolve(process.cwd(), 'data', 'jobs.json');
    if (fs.existsSync(jobsFile)) {
      const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'));
      const count = (Array.isArray(jobs) ? jobs : []).filter(
        (j: any) => j.city && normalizeCityName(j.city) === normalizeCityName(clean)
      ).length;
      return { jobCount: count };
    }

    return { jobCount: 0 };
  }
}
