import { Database } from '../database';

export interface AdvertisementRecord {
  id: string;
  title: string;
  clientName?: string;
  clientEmail?: string;
  imageUrl?: string;
  destinationUrl?: string;
  placement: string;
  status: 'active' | 'pending' | 'expired' | 'paused' | string;
  approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
  submittedByUserId?: string;
  submittedByUserName?: string;
  submittedByUserEmail?: string;
  submittedByUserPhone?: string;
  durationUnit?: string;
  durationValue?: number;
  durationDisplay?: string;
  targetPages?: string[];
  campaignCostPkr?: number;
  paymentStatus?: 'Paid' | 'Pending Wallet Deduction' | 'Refunded' | 'Exempt';
  walletTxId?: string;
  paymentTransactionId?: string;
  transactionRef?: string;
  idempotencyKey?: string;
  startDate?: string;
  endDate?: string;
  impressions?: number;
  clicks?: number;
  budget?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

const processedClickKeys = new Map<string, number>();
const processedImpressionKeys = new Map<string, number>();
const MAX_IDEMPOTENCY_ENTRIES = 5000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hasProcessedIdempotencyKey(store: Map<string, number>, key: string): boolean {
  const timestamp = store.get(key);
  if (timestamp === undefined) return false;
  if (Date.now() - timestamp > IDEMPOTENCY_TTL_MS) {
    store.delete(key);
    return false;
  }
  return true;
}

function recordBoundedIdempotencyKey(store: Map<string, number>, key: string): void {
  const now = Date.now();
  if (store.size >= MAX_IDEMPOTENCY_ENTRIES) {
    for (const [k, ts] of store.entries()) {
      if (now - ts > IDEMPOTENCY_TTL_MS) {
        store.delete(k);
      }
    }
    while (store.size >= MAX_IDEMPOTENCY_ENTRIES) {
      const oldestKey = store.keys().next().value;
      if (oldestKey === undefined) break;
      store.delete(oldestKey);
    }
  }
  store.set(key, now);
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

  static findByWalletTxId(walletTxId: string): AdvertisementRecord | null {
    if (!walletTxId) return null;
    const ads = Database.getAds() || [];
    return (
      ads.find(
        (a: any) =>
          a &&
          (String(a.walletTxId || '') === String(walletTxId) ||
            String(a.paymentTransactionId || '') === String(walletTxId) ||
            String(a.transactionRef || '') === String(walletTxId))
      ) || null
    );
  }

  static findByIdempotencyKey(key: string): AdvertisementRecord | null {
    if (!key) return null;
    const ads = Database.getAds() || [];
    return ads.find((a: any) => a && String(a.idempotencyKey || '') === String(key)) || null;
  }

  static create(adData: Partial<AdvertisementRecord>): AdvertisementRecord {
    const ads = Database.getAds() || [];
    const newAd: AdvertisementRecord = {
      id: adData.id || `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: adData.title || 'Untitled Advertisement',
      placement: adData.placement || 'sidebar',
      status: adData.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...adData,
      clicks: 0,
      impressions: 0
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
    const idempotencyKey = typeof _options?.idempotencyKey === 'string' ? _options.idempotencyKey.trim() : '';
    if (idempotencyKey) {
      const compositeKey = `${id}:${idempotencyKey}`;
      if (hasProcessedIdempotencyKey(processedClickKeys, compositeKey)) {
        return this.getById(id);
      }
      const recorded = this.recordClick(id);
      if (recorded) {
        recordBoundedIdempotencyKey(processedClickKeys, compositeKey);
      }
      return this.getById(id);
    }

    this.recordClick(id);
    return this.getById(id);
  }

  static async trackImpressionAsync(id: string, _options?: any): Promise<AdvertisementRecord | null> {
    const idempotencyKey = typeof _options?.idempotencyKey === 'string' ? _options.idempotencyKey.trim() : '';
    if (idempotencyKey) {
      const compositeKey = `${id}:${idempotencyKey}`;
      if (hasProcessedIdempotencyKey(processedImpressionKeys, compositeKey)) {
        return this.getById(id);
      }
      const recorded = this.recordImpression(id);
      if (recorded) {
        recordBoundedIdempotencyKey(processedImpressionKeys, compositeKey);
      }
      return this.getById(id);
    }

    this.recordImpression(id);
    return this.getById(id);
  }
}
