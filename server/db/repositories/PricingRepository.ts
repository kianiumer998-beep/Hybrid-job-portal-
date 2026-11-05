import { Database } from '../database';
import {
  AdPlacement,
  AdDurationUnit,
  AdTargetPage,
  AdType,
  AdPricingConfig,
  CampaignCustomizationConfig,
  DEFAULT_AD_PRICING_CONFIG,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  calculateCampaignCost,
  resolveCampaignDuration,
  getPlacementDisplayName
} from '../../../src/types/ad';

export interface JobPriceCalculationRequest {
  jobPlan?: 'Standard' | 'Urgent' | 'Featured' | 'Top' | 'Future' | 'VIP Bundle';
  durationDays?: number;
  highlightColor?: boolean;
  whatsappBlast?: boolean;
  socialShare?: boolean;
  discountCode?: string;
}

export interface AdPriceCalculationRequest {
  placement?: AdPlacement | 'Banner' | 'Top Banner' | 'Popup' | 'Feed Ad' | 'Featured Employer' | string;
  type?: AdType | string;
  durationUnit?: AdDurationUnit;
  durationValue?: number;
  durationPresetId?: string;
  selectedDurationId?: string;
  durationDays?: number;
  targetPages?: AdTargetPage[] | string[];
  smsRecipientsCount?: number;
  targetedRegion?: string;
  impressionsCap?: number;
}
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

export class PricingRepository {
  static async get(): Promise<any> {
    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        const coll = db.collection('payment_settings');
        const doc = await withMongoTimeout(
          coll.findOne({ key: 'authoritative_pricing_config' }),
          10000,
          'fetch authoritative pricing config'
        );
        if (doc && doc.settings) {
          return {
            ...Database.getPricing(),
            ...doc.settings,
            isPersistedToMongo: true
          };
        }
      } catch (err: any) {
        console.warn('[PricingRepository] MongoDB fetch failed, serving local fallback:', err.message);
      }
    }
    return Database.getPricing();
  }

  static async update(updates: any): Promise<any> {
    const current = await this.get();

    if (updates?.jobPosting?.homepagePrioritySlotConfig) {
      const slotCfg = updates.jobPosting.homepagePrioritySlotConfig;
      const sanitizeSlot = (tierCfg: any, defaultMax: number) => {
        let max = tierCfg?.maxSlots;
        if (typeof max !== 'number' || !Number.isFinite(max) || max < 0) {
          max = Math.max(0, Math.min(100, Math.floor(Number(max) || defaultMax)));
        } else {
          max = Math.min(100, Math.max(0, Math.floor(max)));
        }
        return {
          enabled: tierCfg?.enabled !== false,
          maxSlots: max
        };
      };
      updates.jobPosting.homepagePrioritySlotConfig = {
        enabled: slotCfg.enabled !== false,
        vip: sanitizeSlot(slotCfg.vip, 2),
        pinned: sanitizeSlot(slotCfg.pinned, 2),
        featured: sanitizeSlot(slotCfg.featured, 4),
        urgent: sanitizeSlot(slotCfg.urgent, 4)
      };
    }

    const updated = {
      ...current,
      ...updates,
      jobPosting: {
        ...(current.jobPosting || {}),
        ...(updates?.jobPosting || {})
      },
      updatedAt: new Date().toISOString()
    };

    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        const coll = db.collection('payment_settings');
        const result = await withMongoTimeout(
          coll.updateOne(
            { key: 'authoritative_pricing_config' },
            { 
              $set: { 
                key: 'authoritative_pricing_config',
                settings: updated,
                updatedAt: updated.updatedAt
              } 
            },
            { upsert: true }
          ),
          12000,
          'save authoritative pricing config'
        );
        if (result && result.acknowledged === false) {
           throw new Error('Write not acknowledged by MongoDB');
        }
      } catch (err: any) {
        console.error('[PricingRepository] Failed to persist pricing to MongoDB:', err.message);
        throw new Error(`Durable persistence failed: ${err.message}`);
      }
    }

    Database.savePricing(updated);
    return updated;
  }

  static async calculateJobPostingPrice(req: JobPriceCalculationRequest): Promise<{
    basePrice: number;
    addonsTotal: number;
    discountAmount: number;
    finalPrice: number;
    currency: string;
    breakdown: Array<{ name: string; amount: number }>;
  }> {
    const pricing = await this.get();
    const currency = pricing.currency || 'PKR';
    const breakdown: Array<{ name: string; amount: number }> = [];

    // Base plan price
    let basePrice = 0;
    const plan = req.jobPlan || 'Standard';
    switch (plan) {
      case 'Standard':
        basePrice = pricing.jobPosting?.standardFeePkr ?? pricing.jobPosting?.standard ?? 0;
        break;
      case 'Urgent':
        basePrice = pricing.jobPosting?.urgentFeePkr ?? pricing.jobPosting?.urgent ?? 2500;
        break;
      case 'Featured':
        basePrice = pricing.jobPosting?.featuredTopFeePkr ?? pricing.jobPosting?.featured ?? 4500;
        break;
      case 'Top':
        basePrice = pricing.jobPosting?.featuredTopFeePkr ?? pricing.jobPosting?.topOfWeek ?? 7000;
        break;
      case 'Future':
        basePrice = pricing.jobPosting?.futureJobFeePkr ?? pricing.jobPosting?.futureListing ?? 12000;
        break;
      case 'VIP Bundle':
        basePrice = pricing.jobPosting?.vipBundleFeePkr ?? pricing.jobPosting?.vipBundle ?? 15000;
        break;
      default:
        basePrice = pricing.jobPosting?.standardFeePkr ?? pricing.jobPosting?.standard ?? 0;
    }
    breakdown.push({ name: `${plan} Listing Base`, amount: basePrice });

    // Addons
    let addonsTotal = 0;
    if (req.highlightColor) {
      const addonFee = pricing.addons?.highlightColor || 1000;
      addonsTotal += addonFee;
      breakdown.push({ name: 'Highlight Color Accent', amount: addonFee });
    }
    if (req.whatsappBlast) {
      const addonFee = pricing.addons?.whatsappBlast || 3000;
      addonsTotal += addonFee;
      breakdown.push({ name: 'WhatsApp Broadcast to Candidates', amount: addonFee });
    }
    if (req.socialShare) {
      const addonFee = pricing.addons?.socialShare || 2000;
      addonsTotal += addonFee;
      breakdown.push({ name: 'Social Media Distribution', amount: addonFee });
    }

    // Extended duration calculation (if over 30 days)
    const duration = Math.max(1, Math.min(180, req.durationDays || 30));
    if (duration > 30) {
      const extraWeeks = Math.ceil((duration - 30) / 7);
      const weeklyRate = pricing.jobPosting?.extraWeekRate || 500;
      const extraDurationFee = extraWeeks * weeklyRate;
      addonsTotal += extraDurationFee;
      breakdown.push({ name: `Extended Duration (${extraWeeks} extra week(s))`, amount: extraDurationFee });
    }

    let discountAmount = 0;
    if (req.discountCode && req.discountCode.toUpperCase() === 'LAUNCH50') {
      discountAmount = Math.round((basePrice + addonsTotal) * 0.5);
      breakdown.push({ name: 'Promo Discount (LAUNCH50 - 50% Off)', amount: -discountAmount });
    }

    const finalPrice = Math.max(0, basePrice + addonsTotal - discountAmount);

    return {
      basePrice,
      addonsTotal,
      discountAmount,
      finalPrice,
      currency,
      breakdown
    };
  }

  static async calculateAdPrice(req: AdPriceCalculationRequest): Promise<{
    basePrice: number;
    baseCost: number;
    placement: AdPlacement;
    durationUnit: AdDurationUnit;
    durationValue: number;
    durationHours: number;
    durationDays: number;
    durationDisplay: string;
    placementMultiplier: number;
    pageMultiplier: number;
    targetPages: AdTargetPage[];
    smsRecipientsCount: number;
    smsFee: number;
    isFreeOverride?: boolean;
    fixedPriceOverridePkr?: number;
    totalCostPkr: number;
    finalPrice: number;
    currency: string;
    breakdown: Array<{ name: string; amount: number }>;
  }> {
    const pricing = await this.get();
    const currency = pricing.currency || 'PKR';
    const adPricingConfig: AdPricingConfig = pricing.adPricingConfig || DEFAULT_AD_PRICING_CONFIG;
    const campaignConfig: CampaignCustomizationConfig =
      pricing.campaignCustomizationConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG;

    const validPlacements: AdPlacement[] = [
      'top-header',
      'feed-inline',
      'sidebar',
      'popup-modal',
      'toast-float',
      'sms-broadcast'
    ];

    let resolvedPlacement: AdPlacement = 'top-header';
    const rawPlacement = typeof req?.placement === 'string' ? req.placement.trim() : '';
    if (validPlacements.includes(rawPlacement as AdPlacement)) {
      resolvedPlacement = rawPlacement as AdPlacement;
    } else if (req?.type === 'sms') {
      resolvedPlacement = 'sms-broadcast';
    } else if (rawPlacement === 'Top Banner' || rawPlacement === 'Banner') {
      resolvedPlacement = 'top-header';
    } else if (rawPlacement === 'Feed Ad') {
      resolvedPlacement = 'feed-inline';
    } else if (rawPlacement === 'Popup') {
      resolvedPlacement = 'popup-modal';
    } else if (rawPlacement === 'Featured Employer') {
      resolvedPlacement = 'sidebar';
    } else if (req?.type === 'popup') {
      resolvedPlacement = 'popup-modal';
    } else if (req?.type === 'notification') {
      resolvedPlacement = 'toast-float';
    } else if (req?.type === 'text') {
      resolvedPlacement = 'sidebar';
    }

    const presetId =
      typeof req?.durationPresetId === 'string' && req.durationPresetId.trim()
        ? req.durationPresetId.trim()
        : typeof req?.selectedDurationId === 'string' && req.selectedDurationId.trim()
        ? req.selectedDurationId.trim()
        : undefined;

    const validUnits: AdDurationUnit[] = ['hours', 'days', 'weeks', 'months'];
    const rawUnit: AdDurationUnit =
      req?.durationUnit && validUnits.includes(req.durationUnit) ? req.durationUnit : 'days';
    const rawValue: number =
      req?.durationValue !== undefined && req?.durationValue !== null
        ? Number(req.durationValue)
        : req?.durationDays !== undefined && req?.durationDays !== null
        ? Number(req.durationDays)
        : 1;

    const resolvedDuration = resolveCampaignDuration(presetId, rawUnit, rawValue, campaignConfig);

    const resolvedTargetPages: AdTargetPage[] =
      Array.isArray(req?.targetPages) && req.targetPages.length > 0
        ? (req.targetPages
            .map((p) => (typeof p === 'string' ? p.trim() : ''))
            .filter(Boolean) as AdTargetPage[])
        : ['all'];
    if (resolvedTargetPages.length === 0) {
      resolvedTargetPages.push('all');
    }

    const resolvedSmsRecipientsCount =
      resolvedPlacement === 'sms-broadcast' || req?.type === 'sms'
        ? Math.max(0, Math.round(Number(req?.smsRecipientsCount) || 0))
        : 0;

    const calc = calculateCampaignCost(
      adPricingConfig,
      resolvedDuration.unit,
      resolvedDuration.value,
      resolvedPlacement,
      resolvedTargetPages,
      resolvedSmsRecipientsCount,
      {
        campaignConfig,
        durationPresetId: presetId
      }
    );

    const breakdown: Array<{ name: string; amount: number }> = [];
    const placementLabel = getPlacementDisplayName(resolvedPlacement);
    const subtotal = Math.max(0, calc.totalCostPkr - calc.smsFee);

    if (calc.isFreeOverride) {
      breakdown.push({
        name: `${placementLabel} (${calc.durationDisplay}) - Free Placement Override`,
        amount: 0
      });
    } else if (calc.fixedPriceOverridePkr && calc.fixedPriceOverridePkr > 0) {
      breakdown.push({
        name: `${placementLabel} (${calc.durationDisplay}) - Fixed Price Override`,
        amount: subtotal
      });
    } else {
      breakdown.push({
        name: `${placementLabel} (${calc.durationDisplay} @ ${calc.placementMultiplier}x placement, ${calc.pageMultiplier}x pages)`,
        amount: subtotal
      });
    }

    if (calc.smsFee > 0) {
      breakdown.push({
        name: `SMS Contacts Dispatch Fee (${resolvedSmsRecipientsCount} recipients)`,
        amount: calc.smsFee
      });
    }

    return {
      basePrice: calc.baseCost,
      baseCost: calc.baseCost,
      placement: resolvedPlacement,
      durationUnit: resolvedDuration.unit,
      durationValue: resolvedDuration.value,
      durationHours: calc.durationHours,
      durationDays: Math.max(1, Math.ceil(calc.durationHours / 24)),
      durationDisplay: calc.durationDisplay,
      placementMultiplier: calc.placementMultiplier,
      pageMultiplier: calc.pageMultiplier,
      targetPages: resolvedTargetPages,
      smsRecipientsCount: resolvedSmsRecipientsCount,
      smsFee: calc.smsFee,
      isFreeOverride: calc.isFreeOverride,
      fixedPriceOverridePkr: calc.fixedPriceOverridePkr,
      totalCostPkr: calc.totalCostPkr,
      finalPrice: calc.totalCostPkr,
      currency,
      breakdown
    };
  }
}
