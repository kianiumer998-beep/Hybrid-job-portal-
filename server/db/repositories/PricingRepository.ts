import { Database } from '../database';

export interface JobPriceCalculationRequest {
  jobPlan?: 'Standard' | 'Urgent' | 'Featured' | 'Top' | 'Future' | 'VIP Bundle';
  durationDays?: number;
  highlightColor?: boolean;
  whatsappBlast?: boolean;
  socialShare?: boolean;
  discountCode?: string;
}

export interface AdPriceCalculationRequest {
  placement?: 'Banner' | 'Top Banner' | 'Popup' | 'Feed Ad' | 'Featured Employer';
  durationDays?: number;
  targetedRegion?: string;
  impressionsCap?: number;
}

export class PricingRepository {
  static get(): any {
    return Database.getPricing();
  }

  static update(updates: any): any {
    const current = Database.getPricing();
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    Database.savePricing(updated);
    return updated;
  }

  static calculateJobPostingPrice(req: JobPriceCalculationRequest): {
    basePrice: number;
    addonsTotal: number;
    discountAmount: number;
    finalPrice: number;
    currency: string;
    breakdown: Array<{ name: string; amount: number }>;
  } {
    const pricing = Database.getPricing();
    const currency = pricing.currency || 'PKR';
    const breakdown: Array<{ name: string; amount: number }> = [];

    // Base plan price
    let basePrice = 0;
    const plan = req.jobPlan || 'Standard';
    switch (plan) {
      case 'Standard':
        basePrice = pricing.jobPosting?.standard || 0;
        break;
      case 'Urgent':
        basePrice = pricing.jobPosting?.urgent || 2500;
        break;
      case 'Featured':
        basePrice = pricing.jobPosting?.featured || 4500;
        break;
      case 'Top':
        basePrice = pricing.jobPosting?.topOfWeek || 7000;
        break;
      case 'Future':
        basePrice = pricing.jobPosting?.futureListing || 12000;
        break;
      case 'VIP Bundle':
        basePrice = pricing.jobPosting?.vipBundle || 15000;
        break;
      default:
        basePrice = 0;
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

  static calculateAdPrice(req: AdPriceCalculationRequest): {
    basePrice: number;
    durationDays: number;
    finalPrice: number;
    currency: string;
    breakdown: Array<{ name: string; amount: number }>;
  } {
    const pricing = Database.getPricing();
    const currency = pricing.currency || 'PKR';
    const breakdown: Array<{ name: string; amount: number }> = [];

    const placement = req.placement || 'Banner';
    const duration = Math.max(1, Math.min(365, req.durationDays || 7));

    let dailyRate = 500;
    switch (placement) {
      case 'Top Banner':
        dailyRate = pricing.ads?.topBannerDaily || 1200;
        break;
      case 'Banner':
        dailyRate = pricing.ads?.standardBannerDaily || 600;
        break;
      case 'Popup':
        dailyRate = pricing.ads?.popupDaily || 2000;
        break;
      case 'Feed Ad':
        dailyRate = pricing.ads?.feedAdDaily || 800;
        break;
      case 'Featured Employer':
        dailyRate = pricing.ads?.featuredEmployerDaily || 1500;
        break;
    }

    const basePrice = dailyRate * duration;
    breakdown.push({ name: `${placement} (${duration} days @ ${dailyRate}/day)`, amount: basePrice });

    return {
      basePrice,
      durationDays: duration,
      finalPrice: basePrice,
      currency,
      breakdown
    };
  }
}
