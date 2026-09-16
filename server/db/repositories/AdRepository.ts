import { Database } from '../database';
import { getAdsCollection, isMongoConfigured } from '../mongodb';

export class AdRepository {
  static getAll(options?: { status?: string; placement?: string }): any[] {
    let ads = Database.getAds();
    if (options?.status) {
      ads = ads.filter(a => a.status === options.status);
    }
    if (options?.placement) {
      ads = ads.filter(a => a.placement === options.placement);
    }
    return ads;
  }

  static async getAllAsync(options?: { status?: string; placement?: string }): Promise<any[]> {
    if (isMongoConfigured()) {
      try {
        const coll = await getAdsCollection();
        const query: any = {};
        if (options?.status) query.status = options.status;
        if (options?.placement) query.placement = options.placement;

        const ads = await coll.find(query).sort({ createdAt: -1 }).toArray();
        if (ads && ads.length > 0) {
          return ads.map(doc => {
            const { _id, ...safe } = doc;
            return safe;
          });
        }
      } catch (err: any) {
        console.warn('[MongoDB] getAllAsync ads fallback:', err.message);
      }
    }
    return this.getAll(options);
  }

  static getById(id: string): any | null {
    const ads = Database.getAds();
    return ads.find(a => a.id === id) || null;
  }

  static create(adData: any): any {
    const ads = Database.getAds();
    const newAd = {
      ...adData,
      id: adData.id || `ad-${Date.now().toString(36)}`,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    };
    ads.unshift(newAd);
    Database.saveAds(ads);
    this.syncMongoAd(newAd);
    return newAd;
  }

  static update(id: string, updates: any): any | null {
    const ads = Database.getAds();
    const idx = ads.findIndex(a => a.id === id);
    if (idx === -1) return null;

    ads[idx] = { ...ads[idx], ...updates, updatedAt: new Date().toISOString() };
    Database.saveAds(ads);
    this.syncMongoAd(ads[idx]);
    return ads[idx];
  }

  static delete(id: string): boolean {
    const ads = Database.getAds();
    const filtered = ads.filter(a => a.id !== id);
    if (filtered.length === ads.length) return false;

    Database.saveAds(filtered);
    if (isMongoConfigured()) {
      getAdsCollection()
        .then(coll => coll.deleteOne({ id }))
        .catch(err => console.warn('[MongoDB] Delete ad notice:', err.message));
    }
    return true;
  }

  static trackClick(id: string): any | null {
    const ads = Database.getAds();
    const idx = ads.findIndex(a => a.id === id);
    if (idx !== -1) {
      ads[idx].clicks = (ads[idx].clicks || 0) + 1;
      Database.saveAds(ads);
      this.syncMongoAd(ads[idx]);
      return ads[idx];
    }
    return null;
  }

  static trackImpression(id: string): any | null {
    const ads = Database.getAds();
    const idx = ads.findIndex(a => a.id === id);
    if (idx !== -1) {
      ads[idx].impressions = (ads[idx].impressions || 0) + 1;
      Database.saveAds(ads);
      this.syncMongoAd(ads[idx]);
      return ads[idx];
    }
    return null;
  }

  private static syncMongoAd(ad: any): void {
    if (!isMongoConfigured() || !ad?.id) return;
    getAdsCollection()
      .then(coll => {
        coll.updateOne(
          { id: ad.id },
          { $set: ad },
          { upsert: true }
        ).catch(err => console.warn('[MongoDB] Sync ad notice:', err.message));
      })
      .catch(() => {});
  }
}
