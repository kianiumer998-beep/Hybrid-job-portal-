import { Database } from '../database';
import { getAdsCollection, isMongoConfigured, executeWithFallback } from '../mongodb';
import { PaymentRepository } from './PaymentRepository';

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
    return executeWithFallback(
      async () => {
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
        return this.getAll(options);
      },
      () => this.getAll(options),
      'AdRepository.getAllAsync'
    );
  }

  static getById(id: string): any | null {
    const ads = Database.getAds();
    return ads.find(a => a.id === id) || null;
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    return executeWithFallback(
      async () => {
        const coll = await getAdsCollection();
        const ad = await coll.findOne({ id });
        if (!ad) return this.getById(id);
        const { _id, ...safe } = ad;
        return safe;
      },
      () => this.getById(id),
      'AdRepository.getByIdAsync'
    );
  }

  static async createAsync(adData: any): Promise<any> {
    const id = adData.id || `ad-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newAd = {
      ...adData,
      id,
      impressions: Number(adData.impressions || 0),
      clicks: Number(adData.clicks || 0),
      createdAt: adData.createdAt || now,
      updatedAt: adData.updatedAt || now
    };

    try {
      const ads = Database.getAds();
      ads.unshift(newAd);
      Database.saveAds(ads);
    } catch {}

    if (isMongoConfigured()) {
      try {
        const coll = await getAdsCollection();
        await coll.insertOne({ ...newAd });
      } catch (err: any) {
        console.warn('[AdRepository] Notice saving ad in MongoDB:', err.message);
      }
    }

    return newAd;
  }

  static create(adData: any): any {
    const ads = Database.getAds();
    const newAd = {
      ...adData,
      id: adData.id || `ad-${Date.now().toString(36)}`,
      impressions: Number(adData.impressions || 0),
      clicks: Number(adData.clicks || 0),
      createdAt: new Date().toISOString()
    };
    ads.unshift(newAd);
    Database.saveAds(ads);
    return newAd;
  }

  static async updateAsync(id: string, updates: any): Promise<any | null> {
    const now = new Date().toISOString();
    const updatePayload = {
      ...updates,
      updatedAt: now
    };

    const localUpdated = this.update(id, updates);

    if (isMongoConfigured()) {
      try {
        const coll = await getAdsCollection();
        const updatedDoc = await coll.findOneAndUpdate(
          { id },
          { $set: updatePayload },
          { returnDocument: 'after' }
        );
        if (updatedDoc) {
          const { _id, ...safe } = updatedDoc;
          return safe;
        }
      } catch (err: any) {
        console.warn('[AdRepository] Notice updating ad in MongoDB:', err.message);
      }
    }

    return localUpdated;
  }

  static update(id: string, updates: any): any | null {
    const ads = Database.getAds();
    const idx = ads.findIndex(a => a.id === id);
    if (idx === -1) return null;

    ads[idx] = { ...ads[idx], ...updates, updatedAt: new Date().toISOString() };
    Database.saveAds(ads);
    return ads[idx];
  }

  static async deleteAsync(id: string): Promise<boolean> {
    const localDeleted = this.delete(id);

    if (isMongoConfigured()) {
      try {
        const coll = await getAdsCollection();
        const res = await coll.deleteOne({ id });
        return res.deletedCount > 0 || localDeleted;
      } catch (err: any) {
        console.warn('[AdRepository] Notice deleting ad in MongoDB:', err.message);
      }
    }

    return localDeleted;
  }

  static delete(id: string): boolean {
    const ads = Database.getAds();
    const filtered = ads.filter(a => a.id !== id);
    if (filtered.length === ads.length) return false;

    Database.saveAds(filtered);
    return true;
  }

  /**
   * Server-authoritative CPC click tracking & billing.
   * If ad is CPC billing, debits advertiser wallet atomically via PaymentRepository.
   */
  static async trackClickAsync(id: string, options?: { idempotencyKey?: string }): Promise<any | null> {
    const ad = await this.getByIdAsync(id);
    if (!ad) return null;

    // Keep preview / demo events unbilled
    const isPreviewOrDemo = ad.isPreview || ad.isDemo || ad.isSample || ad.id?.startsWith('demo-') || ad.id?.startsWith('sample-') || ad.placement === 'preview';
    if (isPreviewOrDemo) {
      return ad;
    }

    const isActive = ad.status === 'active' || ad.status === 'Active' || !ad.status;
    if (!isActive) {
      return ad;
    }

    const key = options?.idempotencyKey;
    if (key) {
      const existingTx = await PaymentRepository.findByIdempotencyKeyAsync(key);
      if (existingTx) {
        return ad;
      }
    }

    const advertiserId = ad.submittedByUserId || ad.userId;
    const cpcRate = Number(ad.cpcRatePkr || 0);

    if (ad.billingModel === 'cpc' && cpcRate > 0 && advertiserId) {
      if (!key) {
        // Safely reject un-keyed billable event to prevent un-idempotent duplicate charges
        return ad;
      }

      try {
        await PaymentRepository.debitWalletAsync(
          advertiserId,
          cpcRate,
          'Ad Click Billing',
          `CPC click charge for ad campaign: "${ad.title || ad.headline || ad.id}"`,
          {
            adId: ad.id,
            billingModel: 'cpc',
            ratePkr: cpcRate
          },
          key
        );

        ad.budgetSpent = Number(ad.budgetSpent || 0) + cpcRate;
        if (ad.budgetLimit) {
          ad.budgetRemaining = Math.max(0, Number(ad.budgetLimit) - ad.budgetSpent);
          if (ad.budgetSpent >= Number(ad.budgetLimit)) {
            ad.status = 'Paused';
            ad.stopReason = 'Budget Exhausted';
          }
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Insufficient wallet balance')) {
          ad.status = 'Paused';
          ad.stopReason = 'Low Wallet Balance';
          await this.updateAsync(ad.id, { status: ad.status, stopReason: ad.stopReason });
        }
        throw err;
      }
    }

    ad.clicks = Number(ad.clicks || 0) + 1;
    if (ad.clickLimit && ad.clicks >= Number(ad.clickLimit)) {
      ad.status = 'Paused';
      ad.stopReason = 'Click Limit Reached';
    }

    return this.updateAsync(ad.id, {
      clicks: ad.clicks,
      status: ad.status,
      stopReason: ad.stopReason,
      budgetSpent: ad.budgetSpent,
      budgetRemaining: ad.budgetRemaining
    });
  }

  static trackClick(id: string): any | null {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous trackClick is prohibited to ensure authoritative persistence; use trackClickAsync.');
    }
    const ads = Database.getAds();
    const idx = ads.findIndex(a => a.id === id);
    if (idx !== -1) {
      ads[idx].clicks = (ads[idx].clicks || 0) + 1;
      Database.saveAds(ads);
      return ads[idx];
    }
    return null;
  }

  /**
   * Server-authoritative CPM impression tracking & billing.
   * If ad is CPM billing, debits advertiser wallet atomically via PaymentRepository.
   */
  static async trackImpressionAsync(id: string, options?: { idempotencyKey?: string }): Promise<any | null> {
    const ad = await this.getByIdAsync(id);
    if (!ad) return null;

    // Keep preview / demo events unbilled
    const isPreviewOrDemo = ad.isPreview || ad.isDemo || ad.isSample || ad.id?.startsWith('demo-') || ad.id?.startsWith('sample-') || ad.placement === 'preview';
    if (isPreviewOrDemo) {
      return ad;
    }

    const isActive = ad.status === 'active' || ad.status === 'Active' || !ad.status;
    if (!isActive) {
      return ad;
    }

    const key = options?.idempotencyKey;
    if (key) {
      const existingTx = await PaymentRepository.findByIdempotencyKeyAsync(key);
      if (existingTx) {
        return ad;
      }
    }

    const advertiserId = ad.submittedByUserId || ad.userId;
    const cpmRate = Number(ad.cpmRatePkr || 0);

    if (ad.billingModel === 'cpm' && cpmRate > 0 && advertiserId) {
      const perImpressionCost = Number((cpmRate / 1000).toFixed(4));
      if (perImpressionCost > 0) {
        if (!key) {
          // Safely reject un-keyed billable event to prevent un-idempotent duplicate charges
          return ad;
        }

        try {
          await PaymentRepository.debitWalletAsync(
            advertiserId,
            perImpressionCost,
            'Ad Impression Billing',
            `CPM impression charge for ad campaign: "${ad.title || ad.headline || ad.id}"`,
            {
              adId: ad.id,
              billingModel: 'cpm',
              cpmRatePkr: cpmRate,
              impressionNumber: Number(ad.impressions || 0) + 1
            },
            key
          );

          ad.budgetSpent = Number(ad.budgetSpent || 0) + perImpressionCost;
          if (ad.budgetLimit) {
            ad.budgetRemaining = Math.max(0, Number(ad.budgetLimit) - ad.budgetSpent);
            if (ad.budgetSpent >= Number(ad.budgetLimit)) {
              ad.status = 'Paused';
              ad.stopReason = 'Budget Exhausted';
            }
          }
        } catch (err: any) {
          if (err.message && err.message.includes('Insufficient wallet balance')) {
            ad.status = 'Paused';
            ad.stopReason = 'Low Wallet Balance';
            await this.updateAsync(ad.id, { status: ad.status, stopReason: ad.stopReason });
          }
          throw err;
        }
      }
    }

    ad.impressions = Number(ad.impressions || 0) + 1;
    if (ad.impressionLimit && ad.impressions >= Number(ad.impressionLimit)) {
      ad.status = 'Paused';
      ad.stopReason = 'Impression Limit Reached';
    }

    return this.updateAsync(ad.id, {
      impressions: ad.impressions,
      status: ad.status,
      stopReason: ad.stopReason,
      budgetSpent: ad.budgetSpent,
      budgetRemaining: ad.budgetRemaining
    });
  }

  static trackImpression(id: string): any | null {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous trackImpression is prohibited to ensure authoritative persistence; use trackImpressionAsync.');
    }
    const ads = Database.getAds();
    const idx = ads.findIndex(a => a.id === id);
    if (idx !== -1) {
      ads[idx].impressions = (ads[idx].impressions || 0) + 1;
      Database.saveAds(ads);
      return ads[idx];
    }
    return null;
  }
}

