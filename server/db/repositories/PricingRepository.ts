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
import { DEFAULT_CATEGORY_POSTING_FEES } from '../../../src/types/landing';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

export interface JobPriceCalculationRequest {
  jobPlan?: 'Standard' | 'Urgent' | 'Featured' | 'Top' | 'Future' | 'VIP Bundle' | string;
  priorityTier?: 'standard' | 'urgent' | 'featured_top' | 'future_job' | 'vip_bundle' | string;
  featured?: boolean;
  urgent?: boolean;
  pinnedTop?: boolean;
  futureJob?: boolean;
  vipBundle?: boolean;
  government?: boolean;
  newspaper?: boolean;
  jobCategory?: string;
  categoryId?: string;
  userEmail?: string;
  userId?: string;
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

function validateNonNegativeNumber(val: any, fieldName: string, max?: number): number {
  if (val === undefined || val === null) return 0;
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid value for "${fieldName}": must be a finite number >= 0 (received ${val})`);
  }
  if (max !== undefined && num > max) {
    throw new Error(`Invalid value for "${fieldName}": exceeds maximum allowed ${max} (received ${val})`);
  }
  return num;
}

function sanitizeSlotLimit(tierCfg: any, defaultMax: number): { enabled: boolean; maxSlots: number } {
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
}

export class PricingRepository {
  /**
   * Retrieves complete authoritative pricing configuration.
   * Single source of truth is MongoDB payment_settings collection (key: 'authoritative_pricing_config').
   */
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
        return {
          ...Database.getPricing(),
          isPersistedToMongo: false,
          isFirstRun: true
        };
      } catch (err: any) {
        console.warn('[PricingRepository] MongoDB fetch failed:', err.message);
        if (process.env.IS_TEST === 'true') {
          return Database.getPricing();
        }
        throw new Error(`Authoritative configuration database is unavailable: ${err.message}`);
      }
    }
    return Database.getPricing();
  }

  /**
   * Updates authoritative pricing configuration in MongoDB with deep merge & validation.
   */
  static async update(updates: any): Promise<any> {
    if (!updates || typeof updates !== 'object') {
      throw new Error('Update payload must be a non-null object');
    }

    const current = await this.get();

    if (updates.jobPosting) {
      const jp = updates.jobPosting;
      if (jp.standardFeePkr !== undefined) validateNonNegativeNumber(jp.standardFeePkr, 'jobPosting.standardFeePkr');
      if (jp.urgentFeePkr !== undefined) validateNonNegativeNumber(jp.urgentFeePkr, 'jobPosting.urgentFeePkr');
      if (jp.featuredTopFeePkr !== undefined) validateNonNegativeNumber(jp.featuredTopFeePkr, 'jobPosting.featuredTopFeePkr');
      if (jp.futureJobFeePkr !== undefined) validateNonNegativeNumber(jp.futureJobFeePkr, 'jobPosting.futureJobFeePkr');
      if (jp.vipBundleFeePkr !== undefined) validateNonNegativeNumber(jp.vipBundleFeePkr, 'jobPosting.vipBundleFeePkr');
      if (jp.standardDurationDays !== undefined) validateNonNegativeNumber(jp.standardDurationDays, 'jobPosting.standardDurationDays', 365);
      if (jp.urgentDurationDays !== undefined) validateNonNegativeNumber(jp.urgentDurationDays, 'jobPosting.urgentDurationDays', 365);
      if (jp.featuredTopDurationDays !== undefined) validateNonNegativeNumber(jp.featuredTopDurationDays, 'jobPosting.featuredTopDurationDays', 365);
      if (jp.futureJobDurationDays !== undefined) validateNonNegativeNumber(jp.futureJobDurationDays, 'jobPosting.futureJobDurationDays', 365);
      if (jp.vipBundleDurationDays !== undefined) validateNonNegativeNumber(jp.vipBundleDurationDays, 'jobPosting.vipBundleDurationDays', 365);
      if (jp.globalDiscount !== undefined) validateNonNegativeNumber(jp.globalDiscount, 'jobPosting.globalDiscount', 100);
      if (jp.extraWeekRate !== undefined) validateNonNegativeNumber(jp.extraWeekRate, 'jobPosting.extraWeekRate');

      if (Array.isArray(jp.categoryPostingFees)) {
        for (const cat of jp.categoryPostingFees) {
          if (cat.feePkr !== undefined) validateNonNegativeNumber(cat.feePkr, `categoryPostingFees.${cat.categoryId || 'unknown'}.feePkr`);
          if (cat.discountPercent !== undefined) validateNonNegativeNumber(cat.discountPercent, `categoryPostingFees.${cat.categoryId || 'unknown'}.discountPercent`, 100);
        }
      }

      if (jp.homepagePrioritySlotConfig) {
        const slotCfg = jp.homepagePrioritySlotConfig;
        jp.homepagePrioritySlotConfig = {
          enabled: slotCfg.enabled !== false,
          vip: sanitizeSlotLimit(slotCfg.vip, 2),
          pinned: sanitizeSlotLimit(slotCfg.pinned, 2),
          featured: sanitizeSlotLimit(slotCfg.featured, 4),
          urgent: sanitizeSlotLimit(slotCfg.urgent, 4)
        };
      }
    }

    if (Array.isArray(updates.subscriptionPackages)) {
      for (const pkg of updates.subscriptionPackages) {
        if (!pkg.id || typeof pkg.id !== 'string') {
          throw new Error('Each subscription package must have a valid string "id"');
        }
        if (pkg.pricePkr !== undefined) validateNonNegativeNumber(pkg.pricePkr, `subscriptionPackage.${pkg.id}.pricePkr`);
        if (pkg.durationDays !== undefined) {
          const days = Number(pkg.durationDays);
          if (!Number.isInteger(days) || days <= 0) {
            throw new Error(`Subscription package "${pkg.id}" durationDays must be a positive integer`);
          }
        }
      }
    }

    // Deterministic category fees resolution without duplication
    const rawCategoryFees =
      updates?.jobPosting?.categoryPostingFees ||
      updates?.landingPageConfig?.categoryPostingFees ||
      current.jobPosting?.categoryPostingFees ||
      current.landingPageConfig?.categoryPostingFees ||
      DEFAULT_CATEGORY_POSTING_FEES;

    const categoryMap = new Map<string, any>();
    if (Array.isArray(rawCategoryFees)) {
      for (const c of rawCategoryFees) {
        if (c && c.categoryId) {
          categoryMap.set(c.categoryId, c);
        }
      }
    }
    const mergedCategoryPostingFees = Array.from(categoryMap.values());

    const mergedExemptUserEmails = Array.isArray(updates?.jobPosting?.exemptUserEmails)
      ? updates.jobPosting.exemptUserEmails
      : (Array.isArray(updates?.exemptUserEmails)
        ? updates.exemptUserEmails
        : (Array.isArray(updates?.landingPageConfig?.exemptUserEmails)
          ? updates.landingPageConfig.exemptUserEmails
          : (current.jobPosting?.exemptUserEmails || current.landingPageConfig?.exemptUserEmails || [])));

    const updated = {
      ...current,
      ...updates,
      currency: updates?.currency || current.currency || 'PKR',
      jobPosting: {
        ...(current.jobPosting || {}),
        ...(updates?.jobPosting || {}),
        categoryPostingFees: mergedCategoryPostingFees,
        exemptUserEmails: mergedExemptUserEmails,
        homepagePrioritySlotConfig: updates?.jobPosting?.homepagePrioritySlotConfig
          ? updates.jobPosting.homepagePrioritySlotConfig
          : (current.jobPosting?.homepagePrioritySlotConfig || {
              enabled: true,
              vip: { enabled: true, maxSlots: 2 },
              pinned: { enabled: true, maxSlots: 2 },
              featured: { enabled: true, maxSlots: 4 },
              urgent: { enabled: true, maxSlots: 4 }
            })
      },
      landingPageConfig: {
        ...(current.landingPageConfig || {}),
        ...(updates?.landingPageConfig || {}),
        categoryPostingFees: mergedCategoryPostingFees,
        exemptUserEmails: mergedExemptUserEmails
      },
      subscriptionPackages: Array.isArray(updates?.subscriptionPackages)
        ? updates.subscriptionPackages
        : (current.subscriptionPackages || []),
      adPricingConfig: {
        ...(current.adPricingConfig || {}),
        ...(updates?.adPricingConfig || {}),
        placementMultipliers: {
          ...(current.adPricingConfig?.placementMultipliers || {}),
          ...(updates?.adPricingConfig?.placementMultipliers || {})
        },
        pageMultipliers: {
          ...(current.adPricingConfig?.pageMultipliers || {}),
          ...(updates?.adPricingConfig?.pageMultipliers || {})
        }
      },
      campaignCustomizationConfig: {
        ...(current.campaignCustomizationConfig || {}),
        ...(updates?.campaignCustomizationConfig || {}),
        portalPages: Array.isArray(updates?.campaignCustomizationConfig?.portalPages)
          ? updates.campaignCustomizationConfig.portalPages
          : (current.campaignCustomizationConfig?.portalPages || []),
        durationPresets: Array.isArray(updates?.campaignCustomizationConfig?.durationPresets)
          ? updates.campaignCustomizationConfig.durationPresets
          : (current.campaignCustomizationConfig?.durationPresets || []),
        placementOptions: Array.isArray(updates?.campaignCustomizationConfig?.placementOptions)
          ? updates.campaignCustomizationConfig.placementOptions
          : (current.campaignCustomizationConfig?.placementOptions || [])
      },
      addons: {
        ...(current.addons || {}),
        ...(updates?.addons || {})
      },
      cvBuilder: {
        ...(current.cvBuilder || {}),
        ...(updates?.cvBuilder || {})
      },
      advertisements: {
        ...(current.advertisements || {}),
        ...(updates?.advertisements || {})
      },
      subscriptions: {
        ...(current.subscriptions || {}),
        ...(updates?.subscriptions || {})
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

  /**
   * Calculates job posting price server-side using authoritative configuration.
   * Enforces plan enable/disable flags, category resolution, exemptions, add-ons, and discount safety.
   */
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

    // 1. VIP Employer Exemption Check (100% Free)
    const exemptEmails: string[] = [
      ...(pricing.jobPosting?.exemptUserEmails || []),
      ...(pricing.landingPageConfig?.exemptUserEmails || [])
    ].map((e: string) => String(e || '').toLowerCase().trim());

    const userEmailClean = req.userEmail ? String(req.userEmail).toLowerCase().trim() : '';
    if (userEmailClean && exemptEmails.includes(userEmailClean)) {
      return {
        basePrice: 0,
        addonsTotal: 0,
        discountAmount: 0,
        finalPrice: 0,
        currency,
        breakdown: [
          { name: '👑 VIP Employer 100% Fee Exemption', amount: 0 }
        ]
      };
    }

    // 2. Master Free Mode Check
    const isMasterFree = Boolean(pricing.jobPosting?.isFreeAllPostings);

    // 3. Category Pricing Resolution (deterministic map merge)
    const rawCategoryFees = [
      ...(pricing.jobPosting?.categoryPostingFees || []),
      ...(pricing.landingPageConfig?.categoryPostingFees || []),
      ...DEFAULT_CATEGORY_POSTING_FEES
    ];
    const categoryMap = new Map<string, any>();
    for (const c of rawCategoryFees) {
      if (c && c.categoryId && !categoryMap.has(c.categoryId)) {
        categoryMap.set(c.categoryId, c);
      }
    }
    const categoryFees = Array.from(categoryMap.values());

    let baseStandardFee = pricing.jobPosting?.standardFeePkr ?? 1000;
    let categoryDiscountPercent = 0;
    let appliedCategoryName: string | null = null;

    const categoryKey = String(req.jobCategory || req.categoryId || '').toLowerCase().trim();
    if (categoryKey) {
      const match = categoryFees.find(
        (c: any) =>
          String(c.categoryId || '').toLowerCase() === categoryKey ||
          String(c.categoryName || '').toLowerCase() === categoryKey
      );
      if (match) {
        appliedCategoryName = match.categoryName;
        if (match.isFree) {
          baseStandardFee = 0;
        } else if (typeof match.feePkr === 'number' && match.feePkr >= 0) {
          baseStandardFee = match.feePkr;
        }
        if (typeof match.discountPercent === 'number' && match.discountPercent > 0) {
          categoryDiscountPercent = Math.min(100, Math.max(0, match.discountPercent));
        }
      }
    } else if (req.government) {
      const match = categoryFees.find((c: any) => String(c.categoryId || '').includes('govt'));
      if (match) {
        appliedCategoryName = match.categoryName;
        baseStandardFee = match.isFree ? 0 : (match.feePkr ?? 0);
      }
    } else if (req.newspaper) {
      const match = categoryFees.find((c: any) => String(c.categoryId || '').includes('news'));
      if (match) {
        appliedCategoryName = match.categoryName;
        baseStandardFee = match.isFree ? 0 : (match.feePkr ?? 0);
      }
    }

    if (isMasterFree || (pricing.jobPosting?.freePostingAllowed && baseStandardFee === 0)) {
      baseStandardFee = 0;
    }

    // 4. Plan & Priority Tier Resolution with Enable/Disable Enforcement
    const isVip = Boolean(
      req.vipBundle ||
      req.priorityTier === 'vip_bundle' ||
      req.jobPlan === 'VIP Bundle'
    );
    const isFeatured = Boolean(
      req.featured ||
      req.pinnedTop ||
      req.priorityTier === 'featured_top' ||
      req.jobPlan === 'Featured' ||
      req.jobPlan === 'Top'
    );
    const isUrgent = Boolean(
      req.urgent ||
      req.priorityTier === 'urgent' ||
      req.jobPlan === 'Urgent'
    );
    const isFuture = Boolean(
      req.futureJob ||
      req.priorityTier === 'future_job' ||
      req.jobPlan === 'Future'
    );

    let basePrice = 0;

    if (isVip) {
      if (pricing.jobPosting?.enableVipBundle === false) {
        throw new Error('VIP Bundle job placement plan is currently disabled by administrator.');
      }
      basePrice = isMasterFree ? 0 : (pricing.jobPosting?.vipBundleFeePkr ?? 2500);
      breakdown.push({
        name: `${pricing.jobPosting?.vipBadgeText || '👑 VIP Ultimate Placement'} (Flat Fee)`,
        amount: basePrice
      });
    } else if (isFeatured) {
      if (pricing.jobPosting?.enableFeaturedTop === false) {
        throw new Error('Featured / Pinned Top job placement plan is currently disabled by administrator.');
      }
      const surcharge = isMasterFree ? 0 : (pricing.jobPosting?.featuredTopFeePkr ?? 1500);
      basePrice = baseStandardFee + surcharge;
      if (baseStandardFee > 0) {
        breakdown.push({
          name: appliedCategoryName ? `${appliedCategoryName} Base Rate` : 'Standard Listing Base',
          amount: baseStandardFee
        });
      }
      if (surcharge > 0) {
        breakdown.push({
          name: pricing.jobPosting?.featuredBadgeText || '⭐ Pinned Top & Featured Surcharge',
          amount: surcharge
        });
      }
      if (basePrice === 0) {
        breakdown.push({ name: 'Pinned Top Placement (Free)', amount: 0 });
      }
    } else if (isUrgent) {
      if (pricing.jobPosting?.enableUrgent === false) {
        throw new Error('Urgent Hiring job placement plan is currently disabled by administrator.');
      }
      const surcharge = isMasterFree ? 0 : (pricing.jobPosting?.urgentFeePkr ?? 500);
      basePrice = baseStandardFee + surcharge;
      if (baseStandardFee > 0) {
        breakdown.push({
          name: appliedCategoryName ? `${appliedCategoryName} Base Rate` : 'Standard Listing Base',
          amount: baseStandardFee
        });
      }
      if (surcharge > 0) {
        breakdown.push({
          name: pricing.jobPosting?.urgentBadgeText || '🔥 Urgent Hiring Surcharge',
          amount: surcharge
        });
      }
      if (basePrice === 0) {
        breakdown.push({ name: 'Urgent Placement (Free)', amount: 0 });
      }
    } else if (isFuture) {
      if (pricing.jobPosting?.enableFutureJob === false) {
        throw new Error('Future Job Intake job placement plan is currently disabled by administrator.');
      }
      const surcharge = isMasterFree ? 0 : (pricing.jobPosting?.futureJobFeePkr ?? 800);
      basePrice = baseStandardFee + surcharge;
      if (baseStandardFee > 0) {
        breakdown.push({
          name: appliedCategoryName ? `${appliedCategoryName} Base Rate` : 'Standard Listing Base',
          amount: baseStandardFee
        });
      }
      if (surcharge > 0) {
        breakdown.push({
          name: pricing.jobPosting?.futureBadgeText || '🚀 Advance Intake Surcharge',
          amount: surcharge
        });
      }
      if (basePrice === 0) {
        breakdown.push({ name: 'Future Job Intake (Free)', amount: 0 });
      }
    } else {
      if (pricing.jobPosting?.enableStandard === false) {
        throw new Error('Standard job posting plan is currently disabled by administrator.');
      }
      basePrice = baseStandardFee;
      breakdown.push({
        name: appliedCategoryName ? `${appliedCategoryName} Base Rate` : 'Standard Listing Base',
        amount: basePrice
      });
    }

    // 5. Add-ons (using nullish coalescing ?? so explicit 0 is preserved)
    let addonsTotal = 0;
    if (req.highlightColor) {
      const addonFee = pricing.addons?.highlightColor ?? 1000;
      addonsTotal += addonFee;
      breakdown.push({ name: 'Highlight Color Accent', amount: addonFee });
    }
    if (req.whatsappBlast) {
      const addonFee = pricing.addons?.whatsappBlast ?? 3000;
      addonsTotal += addonFee;
      breakdown.push({ name: 'WhatsApp Broadcast to Candidates', amount: addonFee });
    }
    if (req.socialShare) {
      const addonFee = pricing.addons?.socialShare ?? 2000;
      addonsTotal += addonFee;
      breakdown.push({ name: 'Social Media Distribution', amount: addonFee });
    }

    const standardDays = pricing.jobPosting?.standardDurationDays ?? 30;
    const duration = Math.max(1, Math.min(180, req.durationDays || standardDays));
    if (duration > standardDays) {
      const extraWeeks = Math.ceil((duration - standardDays) / 7);
      const weeklyRate = pricing.addons?.extraWeekRate ?? pricing.jobPosting?.extraWeekRate ?? 500;
      const extraDurationFee = extraWeeks * weeklyRate;
      addonsTotal += extraDurationFee;
      breakdown.push({ name: `Extended Duration (${extraWeeks} extra week(s))`, amount: extraDurationFee });
    }

    // 6. Discounts (Authorized admin-configured category & global discounts only; no unauthorized LAUNCH50 hardcode)
    let discountAmount = 0;
    const subtotal = basePrice + addonsTotal;

    if (categoryDiscountPercent > 0 && baseStandardFee > 0) {
      const catDiscount = Math.round(baseStandardFee * (categoryDiscountPercent / 100));
      discountAmount += catDiscount;
      breakdown.push({ name: `Category Discount (${categoryDiscountPercent}% Off Base)`, amount: -catDiscount });
    }

    const globalDiscount = Math.min(100, Math.max(0, pricing.jobPosting?.globalDiscount ?? 0));
    if (globalDiscount > 0 && subtotal > discountAmount) {
      const globalDiscountAmt = Math.round((subtotal - discountAmount) * (globalDiscount / 100));
      discountAmount += globalDiscountAmt;
      breakdown.push({ name: `Site-Wide Promotional Markdown (${globalDiscount}% Off)`, amount: -globalDiscountAmt });
    }

    const finalPrice = Math.max(0, subtotal - discountAmount);

    return {
      basePrice,
      addonsTotal,
      discountAmount,
      finalPrice,
      currency,
      breakdown
    };
  }

  /**
   * Calculates advertisement campaign cost server-side using active adPricingConfig & campaignConfig.
   */
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
