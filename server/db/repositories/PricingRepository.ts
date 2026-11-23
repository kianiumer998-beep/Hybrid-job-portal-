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
import {
  DEFAULT_CATEGORY_POSTING_FEES,
  DEFAULT_LANDING_PAGE_CONFIG,
  createDefaultLandingDesignSystem,
  normalizeLandingDesignSystem
} from '../../../src/types/landing';
import {
  DEFAULT_JOB_POSTING_PRICING_CONFIG,
  DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG
} from '../../../src/types/job';
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

function normalizeExemptEmailsList(list: any): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const norm = item.trim().toLowerCase();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    cleaned.push(norm);
  }
  return cleaned;
}

function sanitizeCategoryList(list: any[]): any[] {
  const seen = new Set<string>();
  const cleaned: any[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const categoryId = String(item.categoryId || '').trim();
    if (!categoryId || seen.has(categoryId)) continue;
    seen.add(categoryId);
    cleaned.push({
      categoryId,
      categoryName: typeof item.categoryName === 'string' ? item.categoryName : categoryId,
      feePkr: Math.max(0, Number(item.feePkr ?? 0) || 0),
      isFree: Boolean(item.isFree),
      discountPercent: Math.min(100, Math.max(0, Number(item.discountPercent ?? 0) || 0))
    });
  }
  return cleaned;
}

function buildAuthoritativeDefaults(): any {
  return {
    currency: 'PKR',
    jobPosting: {
      ...DEFAULT_JOB_POSTING_PRICING_CONFIG,
      homepagePrioritySlotConfig: {
        ...DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG,
        vip: { ...DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG.vip },
        pinned: { ...DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG.pinned },
        featured: { ...DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG.featured },
        urgent: { ...DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG.urgent }
      },
      categoryPostingFees: DEFAULT_CATEGORY_POSTING_FEES.map((c) => ({ ...c })),
      exemptUserEmails: [],
      isFreeAllPostings: false,
      globalDiscount: 0,
      extraWeekRate: 500
    },
    landingPageConfig: {
      ...DEFAULT_LANDING_PAGE_CONFIG,
      hero: { ...DEFAULT_LANDING_PAGE_CONFIG.hero },
      sections: DEFAULT_LANDING_PAGE_CONFIG.sections.map((s) => ({ ...s })),
      customCards: DEFAULT_LANDING_PAGE_CONFIG.customCards.map((c) => ({ ...c })),
      categoryPostingFees: DEFAULT_CATEGORY_POSTING_FEES.map((c) => ({ ...c })),
      exemptUserIds: [],
      exemptUserEmails: [],
      jobCardDesign: {
        ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign,
        theme: { ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign.theme },
        visibility: { ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign.visibility },
        labels: { ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign.labels },
        limits: { ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign.limits }
      }
    },
    landingPageDesignSystem: createDefaultLandingDesignSystem(DEFAULT_LANDING_PAGE_CONFIG),
    advertisements: {
      bannerPerDayPkr: 1500,
      topBannerPerDayPkr: 3000,
      popupPerDayPkr: 4500,
      feedAdPerDayPkr: 2000,
      featuredEmployerPerMonthPkr: 25000,
      allowDiscounts: true,
      defaultDiscountPercent: 10,
      minCampaignDurationDays: 3,
      maxCampaignDurationDays: 90
    },
    subscriptions: {
      freeTierPrice: 0,
      proMonthlyPkr: 1200,
      vipMonthlyPkr: 3000,
      govtAlertsWeeklyPkr: 400
    },
    subscriptionPackages: [],
    cvBuilder: {
      standardPdfExportPkr: 0, pdfExportEnabled: true, pdfExportPkr: 0,
      atsTextExportEnabled: true, atsTextExportPkr: 0,
      premiumAiOptimizerPkr: 500, unlimitedTemplatesPkr: 1000,
      freeDesignLimit: 2, freeCvLimit: 1, premiumCvLimit: 10, watermarkEnabled: true, watermarkFreeOnly: true,
      watermarkText: 'Hybrid Job Portal', watermarkOpacity: 0.16,
      templates: [
        { id: 'modern', name: 'Modern Clean', enabled: true, free: true, pricePkr: 0 },
        { id: 'executive', name: 'Executive Dark Sidebar', enabled: true, free: false, pricePkr: 300 },
        { id: 'tech', name: 'Tech Minimalist', enabled: true, free: false, pricePkr: 300 },
        { id: 'classic', name: 'Classic Corporate', enabled: true, free: false, pricePkr: 200 },
        { id: 'ats', name: 'ATS Plain Text', enabled: true, free: true, pricePkr: 0 }
      ]
    },
    addons: {
      highlightColor: 1000,
      whatsappBlast: 3000,
      socialShare: 2000,
      extraWeekRate: 500
    },
    adPricingConfig: {
      ...DEFAULT_AD_PRICING_CONFIG,
      placementMultipliers: { ...DEFAULT_AD_PRICING_CONFIG.placementMultipliers },
      pageMultipliers: { ...DEFAULT_AD_PRICING_CONFIG.pageMultipliers }
    },
    campaignCustomizationConfig: {
      ...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
      portalPages: [...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.portalPages],
      durationPresets: [...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.durationPresets],
      placementOptions: [...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.placementOptions]
    }
  };
}

function deepMergePricing(base: any, incoming: any): any {
  const src = incoming && typeof incoming === 'object' ? incoming : {};
  const syncedCategories = Array.isArray(src.jobPosting?.categoryPostingFees)
    ? sanitizeCategoryList(src.jobPosting.categoryPostingFees)
    : Array.isArray(src.landingPageConfig?.categoryPostingFees)
    ? sanitizeCategoryList(src.landingPageConfig.categoryPostingFees)
    : Array.isArray(base.jobPosting?.categoryPostingFees)
    ? sanitizeCategoryList(base.jobPosting.categoryPostingFees)
    : DEFAULT_CATEGORY_POSTING_FEES.map((c) => ({ ...c }));

  const syncedExemptEmails = Array.isArray(src.jobPosting?.exemptUserEmails)
    ? normalizeExemptEmailsList(src.jobPosting.exemptUserEmails)
    : Array.isArray(src.landingPageConfig?.exemptUserEmails)
    ? normalizeExemptEmailsList(src.landingPageConfig.exemptUserEmails)
    : normalizeExemptEmailsList(base.jobPosting?.exemptUserEmails || base.landingPageConfig?.exemptUserEmails);

  const srcSlot = src.jobPosting?.homepagePrioritySlotConfig || {};
  const baseSlot = base.jobPosting?.homepagePrioritySlotConfig || DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG;
  const baseCvBuilder = base.cvBuilder || {};
  const srcCvBuilder = src.cvBuilder && typeof src.cvBuilder === 'object' ? src.cvBuilder : {};
  const defaultCvTemplates = [
    { id: 'modern', name: 'Modern Clean', enabled: true, free: true, pricePkr: 0 },
    { id: 'executive', name: 'Executive Dark Sidebar', enabled: true, free: false, pricePkr: 300 },
    { id: 'tech', name: 'Tech Minimalist', enabled: true, free: false, pricePkr: 300 },
    { id: 'classic', name: 'Classic Corporate', enabled: true, free: false, pricePkr: 200 },
    { id: 'ats', name: 'ATS Plain Text', enabled: true, free: true, pricePkr: 0 }
  ];
  const templateDefaults = Array.isArray(baseCvBuilder.templates) && baseCvBuilder.templates.length
    ? baseCvBuilder.templates
    : defaultCvTemplates;
  const requestedTemplates = Array.isArray(srcCvBuilder.templates) ? srcCvBuilder.templates : templateDefaults;
  const allowedCvTemplateIds = new Set(['modern', 'executive', 'tech', 'classic', 'ats']);
  const cvTemplates = templateDefaults
    .filter((entry: any) => entry && allowedCvTemplateIds.has(String(entry.id)))
    .map((fallback: any) => {
      const item = requestedTemplates.find((entry: any) => entry && String(entry.id) === String(fallback.id)) || fallback;
      const price = Number(item.pricePkr ?? fallback.pricePkr ?? 0);
      return {
        id: String(fallback.id),
        name: String(item.name || fallback.name || fallback.id).trim().slice(0, 80) || String(fallback.id),
        enabled: item.enabled === undefined ? fallback.enabled !== false : item.enabled === true,
        free: item.free === undefined ? fallback.free === true : item.free === true,
        pricePkr: Number.isFinite(price) ? Math.min(10000000, Math.max(0, price)) : 0,
        pdfExportEnabled: item.pdfExportEnabled !== false,
        atsExportEnabled: item.atsExportEnabled !== false,
        exportWatermarkMode: ['inherit', 'always', 'never'].includes(String(item.exportWatermarkMode))
          ? String(item.exportWatermarkMode)
          : 'inherit',
        watermarkText: typeof item.watermarkText === 'string' ? item.watermarkText.trim().slice(0, 80) : '',
        watermarkOpacity: Number.isFinite(Number(item.watermarkOpacity))
          ? Math.min(0.35, Math.max(0.05, Number(item.watermarkOpacity)))
          : Number(baseCvBuilder.watermarkOpacity ?? 0.16),
        editMode: ['disabled', 'limited', 'unlimited'].includes(String(item.editMode)) ? String(item.editMode) : 'unlimited',
        cvCreateLimit: Number.isInteger(Number(item.cvCreateLimit)) ? Math.min(1000, Math.max(0, Number(item.cvCreateLimit))) : 0,
        editLimit: Number.isInteger(Number(item.editLimit)) ? Math.min(1000, Math.max(0, Number(item.editLimit))) : 0,
        pdfExportLimit: Number.isInteger(Number(item.pdfExportLimit)) ? Math.min(1000, Math.max(0, Number(item.pdfExportLimit))) : 0,
        atsExportLimit: Number.isInteger(Number(item.atsExportLimit)) ? Math.min(1000, Math.max(0, Number(item.atsExportLimit))) : 0,
        shareEnabled: item.shareEnabled === true,
        shareLimit: Number.isInteger(Number(item.shareLimit)) ? Math.min(1000, Math.max(0, Number(item.shareLimit))) : 0
      };
    });
  const cvPackages = Array.isArray(srcCvBuilder.packages) ? srcCvBuilder.packages.slice(0, 30).map((pkg: any, index: number) => ({
    id: String(pkg?.id || `cv-package-${index + 1}`).slice(0, 80),
    name: String(pkg?.name || 'CV Package').trim().slice(0, 80),
    enabled: pkg?.enabled !== false,
    pricePkr: Number.isFinite(Number(pkg?.pricePkr)) ? Math.min(10000000, Math.max(0, Number(pkg.pricePkr))) : 0,
    durationDays: Number.isInteger(Number(pkg?.durationDays)) ? Math.min(3650, Math.max(1, Number(pkg.durationDays))) : 30,
    cvCreateLimit: Number.isInteger(Number(pkg?.cvCreateLimit)) ? Math.min(100, Math.max(0, Number(pkg.cvCreateLimit))) : 1,
    editLimit: Number.isInteger(Number(pkg?.editLimit)) ? Math.min(1000, Math.max(0, Number(pkg.editLimit))) : 0,
    pdfExportLimit: Number.isInteger(Number(pkg?.pdfExportLimit)) ? Math.min(1000, Math.max(0, Number(pkg.pdfExportLimit))) : 0,
    atsExportLimit: Number.isInteger(Number(pkg?.atsExportLimit)) ? Math.min(1000, Math.max(0, Number(pkg.atsExportLimit))) : 0,
    shareLimit: Number.isInteger(Number(pkg?.shareLimit)) ? Math.min(1000, Math.max(0, Number(pkg.shareLimit))) : 0,
    noWatermark: pkg?.noWatermark === true
  })) : (Array.isArray(baseCvBuilder.packages) ? baseCvBuilder.packages : []);
  const cvBuilder = {
    ...baseCvBuilder,
    ...srcCvBuilder,
    freeCvLimit: Number.isFinite(Number(srcCvBuilder.freeCvLimit)) ? Math.min(10, Math.max(0, Math.floor(Number(srcCvBuilder.freeCvLimit)))) : Math.min(10, Math.max(0, Math.floor(Number(baseCvBuilder.freeCvLimit ?? 1)))),
    premiumCvLimit: Number.isFinite(Number(srcCvBuilder.premiumCvLimit)) ? Math.min(10, Math.max(1, Math.floor(Number(srcCvBuilder.premiumCvLimit)))) : Math.min(10, Math.max(1, Math.floor(Number(baseCvBuilder.premiumCvLimit ?? 10)))),
    freeDesignLimit: Number.isFinite(Number(srcCvBuilder.freeDesignLimit))
      ? Math.min(5, Math.max(0, Math.floor(Number(srcCvBuilder.freeDesignLimit))))
      : Math.min(5, Math.max(0, Math.floor(Number(baseCvBuilder.freeDesignLimit ?? 2)))),
    pdfExportEnabled: srcCvBuilder.pdfExportEnabled === undefined ? baseCvBuilder.pdfExportEnabled !== false : srcCvBuilder.pdfExportEnabled === true,
    pdfExportPkr: Math.min(10000000, Math.max(0, Number(srcCvBuilder.pdfExportPkr ?? srcCvBuilder.standardPdfExportPkr ?? baseCvBuilder.pdfExportPkr ?? 0) || 0)),
    atsTextExportEnabled: srcCvBuilder.atsTextExportEnabled === undefined ? baseCvBuilder.atsTextExportEnabled !== false : srcCvBuilder.atsTextExportEnabled === true,
    atsTextExportPkr: Math.min(10000000, Math.max(0, Number(srcCvBuilder.atsTextExportPkr ?? baseCvBuilder.atsTextExportPkr ?? 0) || 0)),
    watermarkEnabled: srcCvBuilder.watermarkEnabled === undefined ? baseCvBuilder.watermarkEnabled !== false : srcCvBuilder.watermarkEnabled === true,
    watermarkFreeOnly: srcCvBuilder.watermarkFreeOnly === undefined ? baseCvBuilder.watermarkFreeOnly !== false : srcCvBuilder.watermarkFreeOnly === true,
    watermarkText: typeof srcCvBuilder.watermarkText === 'string'
      ? srcCvBuilder.watermarkText.trim().slice(0, 80)
      : String(baseCvBuilder.watermarkText || 'Hybrid Job Portal').slice(0, 80),
    watermarkOpacity: Number.isFinite(Number(srcCvBuilder.watermarkOpacity))
      ? Math.min(0.35, Math.max(0.05, Number(srcCvBuilder.watermarkOpacity)))
      : Math.min(0.35, Math.max(0.05, Number(baseCvBuilder.watermarkOpacity ?? 0.16))),
    packages: cvPackages,
    templates: cvTemplates.length ? cvTemplates : templateDefaults
  };

  const srcLanding = src.landingPageConfig || {};
  const baseLanding = base.landingPageConfig || DEFAULT_LANDING_PAGE_CONFIG;

  return {
    ...base,
    ...src,
    currency: src.currency || base.currency || 'PKR',
    jobPosting: {
      ...(base.jobPosting || {}),
      ...(src.jobPosting || {}),
      standardFeePkr: src.jobPosting?.standardFeePkr ?? base.jobPosting?.standardFeePkr ?? 1000,
      urgentFeePkr: src.jobPosting?.urgentFeePkr ?? base.jobPosting?.urgentFeePkr ?? 500,
      featuredTopFeePkr: src.jobPosting?.featuredTopFeePkr ?? base.jobPosting?.featuredTopFeePkr ?? 1500,
      futureJobFeePkr: src.jobPosting?.futureJobFeePkr ?? base.jobPosting?.futureJobFeePkr ?? 800,
      vipBundleFeePkr: src.jobPosting?.vipBundleFeePkr ?? base.jobPosting?.vipBundleFeePkr ?? 2500,
      isFreeAllPostings:
        src.jobPosting?.isFreeAllPostings !== undefined
          ? Boolean(src.jobPosting.isFreeAllPostings)
          : Boolean(base.jobPosting?.isFreeAllPostings),
      globalDiscount:
        src.jobPosting?.globalDiscount !== undefined
          ? Math.min(100, Math.max(0, Number(src.jobPosting.globalDiscount) || 0))
          : Number(base.jobPosting?.globalDiscount ?? 0),
      extraWeekRate: src.jobPosting?.extraWeekRate ?? base.jobPosting?.extraWeekRate ?? 500,
      categoryPostingFees: syncedCategories,
      exemptUserEmails: syncedExemptEmails,
      homepagePrioritySlotConfig: {
        ...baseSlot,
        ...srcSlot,
        enabled: srcSlot.enabled !== undefined ? srcSlot.enabled !== false : baseSlot.enabled !== false,
        vip: { ...(baseSlot.vip || { enabled: true, maxSlots: 2 }), ...(srcSlot.vip || {}) },
        pinned: { ...(baseSlot.pinned || { enabled: true, maxSlots: 2 }), ...(srcSlot.pinned || {}) },
        featured: { ...(baseSlot.featured || { enabled: true, maxSlots: 4 }), ...(srcSlot.featured || {}) },
        urgent: { ...(baseSlot.urgent || { enabled: true, maxSlots: 4 }), ...(srcSlot.urgent || {}) }
      }
    },
    landingPageDesignSystem: normalizeLandingDesignSystem(
      src.landingPageDesignSystem ?? createDefaultLandingDesignSystem({ ...baseLanding, ...srcLanding }),
      { ...baseLanding, ...srcLanding }
    ),
    landingPageConfig: {
      ...baseLanding,
      ...srcLanding,
      hero: {
        ...(baseLanding.hero || {}),
        ...(srcLanding.hero || {})
      },
      sections: Array.isArray(srcLanding.sections)
        ? srcLanding.sections
        : (baseLanding.sections || []),
      customCards: Array.isArray(srcLanding.customCards)
        ? srcLanding.customCards
        : (baseLanding.customCards || []),
      jobCardDesign: {
        ...(baseLanding.jobCardDesign || {}),
        ...(srcLanding.jobCardDesign || {}),
        theme: {
          ...(baseLanding.jobCardDesign?.theme || {}),
          ...(srcLanding.jobCardDesign?.theme || {})
        },
        visibility: {
          ...(baseLanding.jobCardDesign?.visibility || {}),
          ...(srcLanding.jobCardDesign?.visibility || {})
        },
        labels: {
          ...(baseLanding.jobCardDesign?.labels || {}),
          ...(srcLanding.jobCardDesign?.labels || {})
        },
        limits: {
          ...(baseLanding.jobCardDesign?.limits || {}),
          ...(srcLanding.jobCardDesign?.limits || {})
        }
      },
      categoryPostingFees: syncedCategories,
      exemptUserEmails: syncedExemptEmails
    },
    subscriptionPackages: Array.isArray(src.subscriptionPackages)
      ? src.subscriptionPackages.map((pkg: any) => ({
          ...pkg,
          cvBenefitsEnabled: pkg?.cvBenefitsEnabled === true,
          cvBenefits: {
            cvCreateLimit: Math.min(10000, Math.max(0, Math.floor(Number(pkg?.cvBenefits?.cvCreateLimit) || 0))),
            editLimit: Math.min(10000, Math.max(0, Math.floor(Number(pkg?.cvBenefits?.editLimit) || 0))),
            pdfExportLimit: Math.min(10000, Math.max(0, Math.floor(Number(pkg?.cvBenefits?.pdfExportLimit) || 0))),
            atsExportLimit: Math.min(10000, Math.max(0, Math.floor(Number(pkg?.cvBenefits?.atsExportLimit) || 0))),
            shareLimit: Math.min(10000, Math.max(0, Math.floor(Number(pkg?.cvBenefits?.shareLimit) || 0))),
            noWatermark: pkg?.cvBenefits?.noWatermark === true
          }
        }))
      : (base.subscriptionPackages || []),
    adPricingConfig: {
      ...(base.adPricingConfig || {}),
      ...(src.adPricingConfig || {}),
      placementMultipliers: {
        ...(base.adPricingConfig?.placementMultipliers || {}),
        ...(src.adPricingConfig?.placementMultipliers || {})
      },
      pageMultipliers: {
        ...(base.adPricingConfig?.pageMultipliers || {}),
        ...(src.adPricingConfig?.pageMultipliers || {})
      }
    },
    campaignCustomizationConfig: {
      ...(base.campaignCustomizationConfig || {}),
      ...(src.campaignCustomizationConfig || {}),
      portalPages: Array.isArray(src.campaignCustomizationConfig?.portalPages)
        ? src.campaignCustomizationConfig.portalPages
        : (base.campaignCustomizationConfig?.portalPages || []),
      durationPresets: Array.isArray(src.campaignCustomizationConfig?.durationPresets)
        ? src.campaignCustomizationConfig.durationPresets
        : (base.campaignCustomizationConfig?.durationPresets || []),
      placementOptions: Array.isArray(src.campaignCustomizationConfig?.placementOptions)
        ? [
            ...(base.campaignCustomizationConfig?.placementOptions || []).map((defaultOption: any) => {
              const savedOption = src.campaignCustomizationConfig.placementOptions.find((option: any) => option?.id === defaultOption.id);
              return savedOption ? { ...defaultOption, ...savedOption } : defaultOption;
            }),
            ...src.campaignCustomizationConfig.placementOptions.filter((savedOption: any) =>
              !(base.campaignCustomizationConfig?.placementOptions || []).some((defaultOption: any) => defaultOption.id === savedOption?.id)
            )
          ]
        : (base.campaignCustomizationConfig?.placementOptions || []),
      feedInlineSettings: {
        ...(base.campaignCustomizationConfig?.feedInlineSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.feedInlineSettings),
        ...(src.campaignCustomizationConfig?.feedInlineSettings || {})
      }
    },
    addons: {
      ...(base.addons || {}),
      ...(src.addons || {})
    },
    cvBuilder,
    advertisements: {
      ...(base.advertisements || {}),
      ...(src.advertisements || {})
    },
    subscriptions: {
      ...(base.subscriptions || {}),
      ...(src.subscriptions || {})
    }
  };
}

const JOB_SECTOR_ALIAS_TO_CAT_ID: Record<string, string> = {
  'private corporate': 'cat-corp',
  'corporate / private': 'cat-corp',
  'government sector': 'cat-govt',
  'government / fpsc': 'cat-govt',
  'newspaper classified': 'cat-news',
  'newspaper clipping': 'cat-news',
  'international remote': 'cat-remote',
  'global remote': 'cat-remote'
};

export class PricingRepository {
  private static mockCollection: any = null;

  /**
   * Test-only helper to exercise MongoDB query/update/failure behavior without mutating a live database.
   * Strictly rejected outside test mode (IS_TEST !== 'true').
   */
  static setMockCollection(coll: any): void {
    if (coll !== null && process.env.IS_TEST !== 'true') {
      throw new Error('Security violation: Mock collection injection is strictly prohibited outside test mode (IS_TEST !== true).');
    }
    PricingRepository.mockCollection = coll;
  }

  private static useMongoBackend(): boolean {
    return isMongoConfigured() || (process.env.IS_TEST === 'true' && PricingRepository.mockCollection !== null);
  }

  private static async getCollection(): Promise<any> {
    if (process.env.IS_TEST === 'true' && PricingRepository.mockCollection !== null) {
      return PricingRepository.mockCollection;
    }
    const db = await getMongoDb();
    return db.collection('payment_settings');
  }

  /**
   * Retrieves complete authoritative pricing configuration.
   * Single source of truth is MongoDB payment_settings collection (key: 'authoritative_pricing_config').
   * Fails closed whenever MongoDB is configured and unavailable.
   */
  static async get(): Promise<any> {
    if (PricingRepository.useMongoBackend()) {
      try {
        const coll = await PricingRepository.getCollection();
        const doc = await withMongoTimeout<any>(
          coll.findOne({ key: 'authoritative_pricing_config' }),
          10000,
          'fetch authoritative pricing config'
        );
        if (doc && doc.settings) {
          return {
            ...deepMergePricing(buildAuthoritativeDefaults(), doc.settings),
            isPersistedToMongo: true
          };
        }
        return {
          ...deepMergePricing(buildAuthoritativeDefaults(), PricingRepository.mockCollection ? {} : Database.getPricing()),
          isPersistedToMongo: false,
          isFirstRun: true
        };
      } catch (err: any) {
        console.warn('[PricingRepository] MongoDB fetch failed:', err.message);
        throw new Error(`Authoritative configuration database is unavailable: ${err.message}`);
      }
    }
    return deepMergePricing(buildAuthoritativeDefaults(), Database.getPricing());
  }

  /**
   * Updates authoritative pricing configuration in MongoDB with deep merge & numerical validation.
   */
  static async update(updates: any): Promise<any> {
    if (!updates || typeof updates !== 'object') {
      throw new Error('Update payload must be a non-null object');
    }

    const current = await this.get();

    if (updates.campaignCustomizationConfig?.feedInlineSettings) {
      const feed = updates.campaignCustomizationConfig.feedInlineSettings;
      const validatePositiveInteger = (value: unknown, field: string, max: number) => {
        const numeric = Number(value);
        if (!Number.isInteger(numeric) || numeric < 1 || numeric > max) {
          throw new Error(`campaignCustomizationConfig.feedInlineSettings.${field} must be an integer between 1 and ${max}`);
        }
      };
      if (feed.insertionMode !== undefined && !['cadence', 'custom_indices'].includes(feed.insertionMode)) {
        throw new Error('feedInlineSettings.insertionMode must be cadence or custom_indices');
      }
      if (feed.repeatEveryNJobs !== undefined) validatePositiveInteger(feed.repeatEveryNJobs, 'repeatEveryNJobs', 100);
      if (feed.standardJobsPerPage !== undefined) validatePositiveInteger(feed.standardJobsPerPage, 'standardJobsPerPage', 100);
      if (feed.maxAdsPerPage !== undefined) {
        const maxAds = Number(feed.maxAdsPerPage);
        if (!Number.isInteger(maxAds) || maxAds < 0 || maxAds > 10) {
          throw new Error('feedInlineSettings.maxAdsPerPage must be an integer between 0 and 10');
        }
      }
      for (const field of ['customIndices', 'page1SpecificIndices'] as const) {
        if (feed[field] !== undefined) {
          if (!Array.isArray(feed[field]) || feed[field].some((value: unknown) => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 100)) {
            throw new Error(`feedInlineSettings.${field} must contain job positions from 1 to 100`);
          }
          feed[field] = Array.from(new Set(feed[field].map(Number))).sort((a: number, b: number) => a - b);
        }
      }
      if (feed.rotateMultipleAds !== undefined && typeof feed.rotateMultipleAds !== 'boolean') {
        throw new Error('feedInlineSettings.rotateMultipleAds must be a boolean');
      }
    }

    if (Array.isArray(updates.campaignCustomizationConfig?.placementOptions)) {
      for (const option of updates.campaignCustomizationConfig.placementOptions) {
        if (!option || typeof option.id !== 'string' || !option.id.trim()) throw new Error('Every campaign placement option must have a valid id.');
        if (option.maxConcurrentSlots !== undefined) {
          const slots = Number(option.maxConcurrentSlots);
          if (!Number.isInteger(slots) || slots < 1 || slots > 50) throw new Error(`Placement ${option.id} maxConcurrentSlots must be an integer between 1 and 50.`);
        }
        if (option.fixedPriceOverridePkr !== undefined) validateNonNegativeNumber(option.fixedPriceOverridePkr, `campaignPlacement.${option.id}.fixedPriceOverridePkr`);
        if (option.multiplier !== undefined) validateNonNegativeNumber(option.multiplier, `campaignPlacement.${option.id}.multiplier`, 100);
        if (option.isEnabled !== undefined && typeof option.isEnabled !== 'boolean') throw new Error(`Placement ${option.id} isEnabled must be a boolean.`);
      }
    }

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

    if (updates.landingPageConfig && Array.isArray(updates.landingPageConfig.categoryPostingFees)) {
      for (const cat of updates.landingPageConfig.categoryPostingFees) {
        if (cat.feePkr !== undefined) validateNonNegativeNumber(cat.feePkr, `landingPageConfig.categoryPostingFees.${cat.categoryId || 'unknown'}.feePkr`);
        if (cat.discountPercent !== undefined) validateNonNegativeNumber(cat.discountPercent, `landingPageConfig.categoryPostingFees.${cat.categoryId || 'unknown'}.discountPercent`, 100);
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
        if (pkg.cvBenefitsEnabled !== undefined && typeof pkg.cvBenefitsEnabled !== 'boolean') {
          throw new Error(`Subscription package "${pkg.id}" cvBenefitsEnabled must be a boolean`);
        }
        if (pkg.cvBenefitsDescription !== undefined && (typeof pkg.cvBenefitsDescription !== 'string' || pkg.cvBenefitsDescription.length > 240)) {
          throw new Error(`Subscription package "${pkg.id}" cvBenefitsDescription must be text up to 240 characters`);
        }
        if (pkg.cvBenefitsEnabled === true) {
          const benefits = pkg.cvBenefits || {};
          for (const field of ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit']) {
            const value = Number(benefits[field] ?? 0);
            if (!Number.isInteger(value) || value < 0 || value > 10000) {
              throw new Error(`Subscription package "${pkg.id}" CV benefit ${field} must be a whole number from 0 to 10000`);
            }
          }
          if (benefits.noWatermark !== undefined && typeof benefits.noWatermark !== 'boolean') {
            throw new Error(`Subscription package "${pkg.id}" CV noWatermark must be a boolean`);
          }
        }
      }
    }

    if (updates.addons) {
      if (updates.addons.highlightColor !== undefined) validateNonNegativeNumber(updates.addons.highlightColor, 'addons.highlightColor');
      if (updates.addons.whatsappBlast !== undefined) validateNonNegativeNumber(updates.addons.whatsappBlast, 'addons.whatsappBlast');
      if (updates.addons.socialShare !== undefined) validateNonNegativeNumber(updates.addons.socialShare, 'addons.socialShare');
      if (updates.addons.extraWeekRate !== undefined) validateNonNegativeNumber(updates.addons.extraWeekRate, 'addons.extraWeekRate');
    }

    if (updates.cvBuilder) {
      const cv = updates.cvBuilder;
      for (const field of ['standardPdfExportPkr', 'pdfExportPkr', 'atsTextExportPkr', 'premiumAiOptimizerPkr', 'unlimitedTemplatesPkr'] as const) {
        if (cv[field] !== undefined) validateNonNegativeNumber(cv[field], `cvBuilder.${field}`, 10000000);
      }
      if (cv.freeCvLimit !== undefined && (!Number.isInteger(Number(cv.freeCvLimit)) || Number(cv.freeCvLimit) < 0 || Number(cv.freeCvLimit) > 10)) {
        throw new Error('cvBuilder.freeCvLimit must be a whole number between 0 and 10.');
      }
      if (cv.freeDesignLimit !== undefined && (!Number.isInteger(Number(cv.freeDesignLimit)) || Number(cv.freeDesignLimit) < 0 || Number(cv.freeDesignLimit) > 5)) {
        throw new Error('cvBuilder.freeDesignLimit must be a whole number between 0 and 5.');
      }
      if (cv.premiumCvLimit !== undefined && (!Number.isInteger(Number(cv.premiumCvLimit)) || Number(cv.premiumCvLimit) < 1 || Number(cv.premiumCvLimit) > 10)) {
        throw new Error('cvBuilder.premiumCvLimit must be a whole number between 1 and 10.');
      }
      if (cv.watermarkOpacity !== undefined && (!Number.isFinite(Number(cv.watermarkOpacity)) || Number(cv.watermarkOpacity) < 0.05 || Number(cv.watermarkOpacity) > 0.35)) {
        throw new Error('cvBuilder.watermarkOpacity must be between 0.05 and 0.35.');
      }
      if (cv.watermarkText !== undefined && (typeof cv.watermarkText !== 'string' || cv.watermarkText.length > 80)) {
        throw new Error('cvBuilder.watermarkText must be text with a maximum of 80 characters.');
      }
      for (const field of ['pdfExportEnabled', 'atsTextExportEnabled', 'watermarkEnabled', 'watermarkFreeOnly'] as const) {
        if (cv[field] !== undefined && typeof cv[field] !== 'boolean') {
          throw new Error(`cvBuilder.${field} must be a boolean.`);
        }
      }
      if (cv.templates !== undefined) {
        if (!Array.isArray(cv.templates) || cv.templates.length > 5) throw new Error('cvBuilder.templates must be an array with no more than five designs.');
        const allowed = new Set(['modern', 'executive', 'tech', 'classic', 'ats']);
        const seen = new Set<string>();
        for (const template of cv.templates) {
          if (!template || typeof template !== 'object' || !allowed.has(String(template.id)) || seen.has(String(template.id))) {
            throw new Error('Each CV design must use a unique supported design ID.');
          }
          seen.add(String(template.id));
          if (template.name !== undefined && (typeof template.name !== 'string' || !template.name.trim() || template.name.length > 80)) throw new Error(`CV design ${template.id} name must contain 1 to 80 characters.`);
          if (template.enabled !== undefined && typeof template.enabled !== 'boolean') throw new Error(`CV design ${template.id} enabled must be a boolean.`);
          if (template.free !== undefined && typeof template.free !== 'boolean') throw new Error(`CV design ${template.id} free must be a boolean.`);
          if (template.pricePkr !== undefined) validateNonNegativeNumber(template.pricePkr, `cvBuilder.templates.${template.id}.pricePkr`, 10000000);
          for (const field of ['pdfExportEnabled', 'atsExportEnabled'] as const) {
            if (template[field] !== undefined && typeof template[field] !== 'boolean') throw new Error(`cvBuilder.templates.${template.id}.${field} must be a boolean.`);
          }
          if (template.exportWatermarkMode !== undefined && !['inherit', 'always', 'never'].includes(String(template.exportWatermarkMode))) {
            throw new Error(`cvBuilder.templates.${template.id}.exportWatermarkMode is invalid.`);
          }
          if (template.watermarkText !== undefined && (typeof template.watermarkText !== 'string' || template.watermarkText.length > 80)) {
            throw new Error(`cvBuilder.templates.${template.id}.watermarkText must be text up to 80 characters.`);
          }
          if (template.watermarkOpacity !== undefined) {
            const opacity = Number(template.watermarkOpacity);
            if (!Number.isFinite(opacity) || opacity < 0.05 || opacity > 0.35) throw new Error(`cvBuilder.templates.${template.id}.watermarkOpacity must be between 0.05 and 0.35.`);
          }
          if (template.editMode !== undefined && !['disabled', 'limited', 'unlimited'].includes(String(template.editMode))) throw new Error(`cvBuilder.templates.${template.id}.editMode is invalid.`);
          for (const field of ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit'] as const) {
            if (template[field] !== undefined && (!Number.isInteger(Number(template[field])) || Number(template[field]) < 0 || Number(template[field]) > 1000)) throw new Error(`cvBuilder.templates.${template.id}.${field} must be a whole number from 0 to 1000.`);
          }
          if (template.shareEnabled !== undefined && typeof template.shareEnabled !== 'boolean') throw new Error(`cvBuilder.templates.${template.id}.shareEnabled must be a boolean.`);
        }
      }
      if (cv.packages !== undefined) {
        if (!Array.isArray(cv.packages) || cv.packages.length > 30) throw new Error('cvBuilder.packages must contain no more than 30 packages.');
        const seenPackageIds = new Set<string>();
        for (const pkg of cv.packages) {
          if (!pkg || typeof pkg.id !== 'string' || !pkg.id.trim() || seenPackageIds.has(pkg.id)) throw new Error('Each CV package must have a unique ID.');
          seenPackageIds.add(pkg.id);
          if (typeof pkg.name !== 'string' || !pkg.name.trim() || pkg.name.length > 80) throw new Error(`CV package ${pkg.id} needs a valid name.`);
          for (const field of ['pricePkr', 'durationDays', 'cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit'] as const) {
            if (!Number.isInteger(Number(pkg[field])) || Number(pkg[field]) < (field === 'durationDays' ? 1 : 0) || Number(pkg[field]) > (field === 'durationDays' ? 3650 : field === 'pricePkr' ? 10000000 : 1000)) throw new Error(`CV package ${pkg.id} has an invalid ${field}.`);
          }
          if (pkg.noWatermark !== undefined && typeof pkg.noWatermark !== 'boolean') throw new Error(`CV package ${pkg.id} noWatermark must be a boolean.`);
          if (pkg.enabled !== undefined && typeof pkg.enabled !== 'boolean') throw new Error(`CV package ${pkg.id} enabled must be a boolean.`);
        }
      }
    }

    // Category fees update precedence without resurrecting deleted entries from stale current fields
    const hasJobCatsUpdate = Array.isArray(updates?.jobPosting?.categoryPostingFees);
    const hasLandingCatsUpdate = Array.isArray(updates?.landingPageConfig?.categoryPostingFees);
    let resolvedCategoryPostingFees: any[];

    if (hasJobCatsUpdate && hasLandingCatsUpdate) {
      const catMap = new Map<string, any>();
      for (const c of updates.landingPageConfig.categoryPostingFees) {
        if (c && c.categoryId) catMap.set(c.categoryId, { ...c });
      }
      for (const c of updates.jobPosting.categoryPostingFees) {
        if (c && c.categoryId) {
          catMap.set(c.categoryId, { ...(catMap.get(c.categoryId) || {}), ...c });
        }
      }
      resolvedCategoryPostingFees = sanitizeCategoryList(Array.from(catMap.values()));
    } else if (hasJobCatsUpdate) {
      resolvedCategoryPostingFees = sanitizeCategoryList(updates.jobPosting.categoryPostingFees);
    } else if (hasLandingCatsUpdate) {
      resolvedCategoryPostingFees = sanitizeCategoryList(updates.landingPageConfig.categoryPostingFees);
    } else if (Array.isArray(current.jobPosting?.categoryPostingFees)) {
      resolvedCategoryPostingFees = sanitizeCategoryList(current.jobPosting.categoryPostingFees);
    } else if (Array.isArray(current.landingPageConfig?.categoryPostingFees)) {
      resolvedCategoryPostingFees = sanitizeCategoryList(current.landingPageConfig.categoryPostingFees);
    } else {
      resolvedCategoryPostingFees = DEFAULT_CATEGORY_POSTING_FEES.map((c) => ({ ...c }));
    }

    const rawExemptUserEmails = Array.isArray(updates?.jobPosting?.exemptUserEmails)
      ? updates.jobPosting.exemptUserEmails
      : Array.isArray(updates?.exemptUserEmails)
      ? updates.exemptUserEmails
      : Array.isArray(updates?.landingPageConfig?.exemptUserEmails)
      ? updates.landingPageConfig.exemptUserEmails
      : current.jobPosting?.exemptUserEmails || current.landingPageConfig?.exemptUserEmails || [];
    const mergedExemptUserEmails = normalizeExemptEmailsList(rawExemptUserEmails);

    const resolvedIsFreeAllPostings =
      updates?.jobPosting?.isFreeAllPostings !== undefined
        ? Boolean(updates.jobPosting.isFreeAllPostings)
        : Boolean(current.jobPosting?.isFreeAllPostings);

    const resolvedGlobalDiscount =
      updates?.jobPosting?.globalDiscount !== undefined
        ? Math.min(100, Math.max(0, Number(updates.jobPosting.globalDiscount) || 0))
        : Number(current.jobPosting?.globalDiscount ?? 0);

    const mergedRaw = deepMergePricing(current, {
      ...updates,
      currency: updates?.currency || current.currency || 'PKR',
      jobPosting: {
        ...(current.jobPosting || {}),
        ...(updates?.jobPosting || {}),
        isFreeAllPostings: resolvedIsFreeAllPostings,
        globalDiscount: resolvedGlobalDiscount,
        categoryPostingFees: resolvedCategoryPostingFees,
        exemptUserEmails: mergedExemptUserEmails
      },
      landingPageConfig: {
        ...(current.landingPageConfig || {}),
        ...(updates?.landingPageConfig || {}),
        categoryPostingFees: resolvedCategoryPostingFees,
        exemptUserEmails: mergedExemptUserEmails
      }
    });

    const updated = {
      ...mergedRaw,
      updatedAt: new Date().toISOString()
    };
    delete updated.isFirstRun;

    if (PricingRepository.useMongoBackend()) {
      try {
        const coll = await PricingRepository.getCollection();
        const result = await withMongoTimeout<any>(
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
        updated.isPersistedToMongo = true;
      } catch (err: any) {
        console.error('[PricingRepository] Failed to persist pricing to MongoDB:', err.message);
        throw new Error(`Durable persistence failed: ${err.message}`);
      }
    }

    // Do not write local JSON when running under isolated test mock collection
    if (!(process.env.IS_TEST === 'true' && PricingRepository.mockCollection !== null)) {
      Database.savePricing(updated);
    }
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
    ]
      .map((e: string) => String(e || '').toLowerCase().trim())
      .filter(Boolean);

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

    // 3. Category Pricing Resolution without resurrecting deleted categories
    const hasConfiguredCategories =
      Array.isArray(pricing.jobPosting?.categoryPostingFees) ||
      Array.isArray(pricing.landingPageConfig?.categoryPostingFees);

    const rawCategoryFees = hasConfiguredCategories
      ? [
          ...(Array.isArray(pricing.jobPosting?.categoryPostingFees) ? pricing.jobPosting.categoryPostingFees : []),
          ...(Array.isArray(pricing.landingPageConfig?.categoryPostingFees) ? pricing.landingPageConfig.categoryPostingFees : [])
        ]
      : DEFAULT_CATEGORY_POSTING_FEES;

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
      const aliasId = JOB_SECTOR_ALIAS_TO_CAT_ID[categoryKey];
      const match =
        categoryFees.find(
          (c: any) =>
            String(c.categoryId || '').toLowerCase().trim() === categoryKey ||
            String(c.categoryName || '').toLowerCase().trim() === categoryKey
        ) ||
        (aliasId
          ? categoryFees.find((c: any) => String(c.categoryId || '').toLowerCase().trim() === aliasId)
          : undefined);
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
        if (typeof match.discountPercent === 'number' && match.discountPercent > 0) {
          categoryDiscountPercent = Math.min(100, Math.max(0, match.discountPercent));
        }
      }
    } else if (req.newspaper) {
      const match = categoryFees.find((c: any) => String(c.categoryId || '').includes('news'));
      if (match) {
        appliedCategoryName = match.categoryName;
        baseStandardFee = match.isFree ? 0 : (match.feePkr ?? 0);
        if (typeof match.discountPercent === 'number' && match.discountPercent > 0) {
          categoryDiscountPercent = Math.min(100, Math.max(0, match.discountPercent));
        }
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

    // 6. Discounts
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
      'sms-broadcast',
      'promo-discount-banner',
      'dynamic-announcement-card'
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

    const placementOption = campaignConfig.placementOptions?.find((option) => option.id === resolvedPlacement);
    const isLandingCommercialPlacement = resolvedPlacement === 'promo-discount-banner' || resolvedPlacement === 'dynamic-announcement-card';
    if (placementOption?.isEnabled === false || (isLandingCommercialPlacement && !placementOption)) {
      const placementError: any = new Error('This campaign placement is currently disabled or unavailable. Please select another placement.');
      placementError.statusCode = 409;
      throw placementError;
    }
    if (isLandingCommercialPlacement) {
      const maxSlots = Number(placementOption?.maxConcurrentSlots || 0);
      if (!Number.isInteger(maxSlots) || maxSlots < 1 || maxSlots > 50) {
        const slotConfigError: any = new Error('This campaign placement does not have a valid slot limit configured by the administrator.');
        slotConfigError.statusCode = 409;
        throw slotConfigError;
      }
      const now = Date.now();
      const occupiedCount = (Database.getAds() || []).filter((ad: any) => {
        if (ad?.placement !== resolvedPlacement || !['active', 'pending', 'pending_approval'].includes(String(ad.status))) return false;
        if (ad.approvalStatus === 'Rejected' || ad.paymentStatus === 'Refunded') return false;
        const endValue = ad.scheduledEndAt || ad.endDate;
        if (endValue) {
          const endMs = new Date(String(endValue).replace(' ', 'T')).getTime();
          if (Number.isFinite(endMs) && endMs < now) return false;
        }
        return true;
      }).length;
      if (occupiedCount >= maxSlots) {
        const slotError: any = new Error('All campaign slots for this placement are currently reserved. Please try again when a slot becomes available.');
        slotError.statusCode = 409;
        throw slotError;
      }
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
    if (placementOption?.allowedPageIds?.length) {
      const allowedPages = placementOption.allowedPageIds;
      if (resolvedTargetPages.includes('all') || resolvedTargetPages.some((page) => !allowedPages.includes(page))) {
        const pageError: any = new Error('This placement is only available on the landing page jobs section. Please select the permitted page.');
        pageError.statusCode = 400;
        throw pageError;
      }
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
