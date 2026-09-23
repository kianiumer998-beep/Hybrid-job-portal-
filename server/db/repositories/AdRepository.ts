import { Database } from '../database';

export interface AdvertisementRecord {
  id: string;
  title: string;
  clientName?: string;
  clientEmail?: string;
  imageUrl?: string;
  destinationUrl?: string;
  placement: string;
  status: 'active' | 'pending' | 'expired' | 'paused';
  startDate?: string;
  endDate?: string;
  impressions?: number;
  clicks?: number;
  budget?: number;
  createdAt?: string;
  updatedAt?: string;
}

export class AdRepository {
  static getAll(filters?: { status?: string; placement?: string }): AdvertisementRecord[] {
    let ads = Database.getAds() || [];
    if (filters?.status) {
      ads = ads.filter(a => a.status === filters.status);
    }
    if (filters?.placement) {
      ads = ads.filter(a => a.placement === filters.placement);
    }
    return ads;
  }

  static getById(id: string): AdvertisementRecord | null {
    const ads = Database.getAds() || [];
    return ads.find(a => a.id === id) || null;
  }

  static create(adData: Partial<AdvertisementRecord>): AdvertisementRecord {
    const ads = Database.getAds() || [];
    const newAd: AdvertisementRecord = {
      id: adData.id || `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: adData.title || 'Untitled Advertisement',
      placement: adData.placement || 'sidebar',
      status: adData.status || 'active',
      impressions: adData.impressions || 0,
      clicks: adData.clicks || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...adData
    };
    ads.push(newAd);
    Database.saveAds(ads);
    return newAd;
  }

  static update(id: string, updates: Partial<AdvertisementRecord>): AdvertisementRecord | null {
    const ads = Database.getAds() || [];
    const idx = ads.findIndex(a => a.id === id);
    if (idx === -1) return null;

    const updated = {
      ...ads[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    ads[idx] = updated;
    Database.saveAds(ads);
    return updated;
  }

  static delete(id: string): boolean {
    const ads = Database.getAds() || [];
    const filtered = ads.filter(a => a.id !== id);
    if (filtered.length === ads.length) return false;
    Database.saveAds(filtered);
    return true;
  }

  static recordClick(id: string): boolean {
    const ad = this.getById(id);
    if (!ad) return false;
    this.update(id, { clicks: (ad.clicks || 0) + 1 });
    return true;
  }

  static recordImpression(id: string): boolean {
    const ad = this.getById(id);
    if (!ad) return false;
    this.update(id, { impressions: (ad.impressions || 0) + 1 });
    return true;
  }

  static async getAllAsync(filters?: { status?: string; placement?: string }): Promise<AdvertisementRecord[]> {
    return this.getAll(filters);
  }

  static async createAsync(adData: Partial<AdvertisementRecord>): Promise<AdvertisementRecord> {
    return this.create(adData);
  }

  static async updateAsync(id: string, updates: Partial<AdvertisementRecord>): Promise<AdvertisementRecord | null> {
    return this.update(id, updates);
  }

  static async deleteAsync(id: string): Promise<boolean> {
    return this.delete(id);
  }

  static async trackClickAsync(id: string, _options?: any): Promise<AdvertisementRecord | null> {
    this.recordClick(id);
    return this.getById(id);
  }

  static async trackImpressionAsync(id: string, _options?: any): Promise<AdvertisementRecord | null> {
    this.recordImpression(id);
    return this.getById(id);
  }
}
