export const SUBSCRIPTION_FEATURES = [
  { id: 'early_access', label: 'Premium Early Access' },
  { id: 'whatsapp_alerts', label: 'WhatsApp Job Alerts' },
  { id: 'email_alerts', label: 'Email Job Alerts' },
  { id: 'sms_alerts', label: 'SMS Job Alerts' },
  { id: 'cv_builder', label: 'Premium CV Builder' },
  { id: 'urgent_job_posting', label: 'Urgent Job Posting' },
  { id: 'featured_job_posting', label: 'Featured Job Posting' },
  { id: 'premium_job_posting', label: 'Premium Job Posting' },
  { id: 'campaign_credits', label: 'Advertisement Campaign Credits' }
] as const;

export type SubscriptionFeatureId = typeof SUBSCRIPTION_FEATURES[number]['id'];

export interface SubscriptionFeatureConfig {
  id: SubscriptionFeatureId;
  label: string;
  enabled: boolean;
  pricePkr: number;
  durationDays: number;
  includedSlots: number;
  slotDurationDays: number;
  unlimitedMessages?: boolean;
  monthlyMessageQuota?: number;
  campaignCredits?: Array<{ placement: string; durationHours: number; quantity: number }>;
}

const FEATURE_IDS = new Set<string>(SUBSCRIPTION_FEATURES.map((item) => item.id));
const CAMPAIGN_PLACEMENTS = new Set(['top-header', 'feed-inline', 'sidebar', 'popup-modal', 'toast-float', 'sms-broadcast', 'promo-discount-banner', 'dynamic-announcement-card']);

export function normalizeSubscriptionFeatureCatalog(raw: unknown): SubscriptionFeatureConfig[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.filter((item: any) => {
    const id = String(item?.id || '').trim();
    if (!FEATURE_IDS.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((item: any) => ({
    id: String(item.id) as SubscriptionFeatureId,
    label: String(item.label || SUBSCRIPTION_FEATURES.find((feature) => feature.id === item.id)?.label || item.id).trim().slice(0, 80),
    enabled: item.enabled === true,
    pricePkr: Number.isSafeInteger(Number(item.pricePkr)) && Number(item.pricePkr) >= 0 ? Number(item.pricePkr) : 0,
    durationDays: Number.isInteger(Number(item.durationDays)) && Number(item.durationDays) > 0 && Number(item.durationDays) <= 3650 ? Number(item.durationDays) : 30,
    includedSlots: Number.isInteger(Number(item.includedSlots)) && Number(item.includedSlots) >= 0 && Number(item.includedSlots) <= 1000 ? Number(item.includedSlots) : 0,
    slotDurationDays: Number.isInteger(Number(item.slotDurationDays)) && Number(item.slotDurationDays) > 0 && Number(item.slotDurationDays) <= 3650 ? Number(item.slotDurationDays) : 30,
    // Existing catalog entries remain unmetered until an administrator configures an explicit quota.
    unlimitedMessages: item.unlimitedMessages === true || (item.unlimitedMessages === undefined && item.monthlyMessageQuota === undefined),
    monthlyMessageQuota: Number.isInteger(Number(item.monthlyMessageQuota)) && Number(item.monthlyMessageQuota) >= 1 && Number(item.monthlyMessageQuota) <= 1000000 ? Number(item.monthlyMessageQuota) : 0,
    campaignCredits: Array.isArray(item.campaignCredits) ? item.campaignCredits.filter((credit: any) => CAMPAIGN_PLACEMENTS.has(String(credit?.placement || '')) && Number.isInteger(Number(credit.durationHours)) && Number(credit.durationHours) >= 1 && Number(credit.durationHours) <= 8760 && Number.isInteger(Number(credit.quantity)) && Number(credit.quantity) >= 1 && Number(credit.quantity) <= 1000).map((credit: any) => ({ placement: String(credit.placement), durationHours: Number(credit.durationHours), quantity: Number(credit.quantity) })).filter((credit: any, index: number, all: any[]) => all.findIndex((other: any) => other.placement === credit.placement && other.durationHours === credit.durationHours) === index) : []
  }));
}

export function resolveSubscriptionPackage(pkg: any, pricing: any): {
  pricePkr: number;
  featureIds: SubscriptionFeatureId[];
  featureSnapshots: Array<SubscriptionFeatureConfig>;
  bundleDiscountPercent: number;
  undiscountedPricePkr: number;
} {
  const catalog = normalizeSubscriptionFeatureCatalog(pricing?.subscriptionFeatureCatalog);
  const requestedIds = Array.isArray(pkg?.featureIds)
    ? Array.from(new Set(pkg.featureIds.map((value: any) => String(value || '').trim())))
    : [];
  if (pkg?.pricingMode === 'catalog' && requestedIds.length === 0) throw new Error('Select at least one enabled feature for a catalog-priced package.');
  const selected = requestedIds.map((id: string) => {
    if (!FEATURE_IDS.has(id)) throw new Error(`Unsupported subscription feature "${id}".`);
    const feature = catalog.find((entry) => entry.id === id && entry.enabled);
    if (!feature) throw new Error(`Subscription feature "${id}" is unavailable or disabled.`);
    return feature;
  });
  if (selected.some((item) => item.id === 'campaign_credits' && (!Array.isArray(item.campaignCredits) || item.campaignCredits.length === 0))) {
    throw new Error('Configure at least one placement and duration credit before including Campaign Credits in a subscription.');
  }
  const undiscountedPricePkr = selected.reduce((sum, item) => sum + item.pricePkr, 0);
  const rawDiscount = Number(pkg?.bundleDiscountPercent ?? pricing?.subscriptionBundleDiscountPercent ?? 0);
  const bundleDiscountPercent = Number.isFinite(rawDiscount) ? Math.min(100, Math.max(0, rawDiscount)) : 0;
  const calculatedPrice = Math.max(0, Math.round(undiscountedPricePkr * (1 - bundleDiscountPercent / 100)));
  const pricePkr = pkg?.pricingMode === 'catalog' && selected.length > 0
    ? calculatedPrice
    : Number(pkg?.configuredPricePkr ?? pkg?.pricePkr);
  if (!Number.isSafeInteger(pricePkr) || pricePkr < 0) {
    throw new Error('Subscription package price must be a non-negative whole PKR amount.');
  }
  return {
    pricePkr,
    featureIds: selected.map((item) => item.id),
    featureSnapshots: selected.map((item) => ({ ...item })),
    bundleDiscountPercent,
    undiscountedPricePkr
  };
}

export async function hasActiveSubscriptionFeature(userId: string | undefined, featureId: SubscriptionFeatureId, now = Date.now()): Promise<boolean> {
  const cleanUserId = String(userId || '').trim();
  if (!cleanUserId) return false;
  const { UserRepository } = await import('../db/repositories/UserRepository');
  const user = await UserRepository.getByIdAsync(cleanUserId);
  if (!user || user.membershipStatus !== 'Active') return false;
  const expiry = Date.parse(String(user.subscriptionExpiresAt || ''));
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  // Existing members and older package records without a feature snapshot retain legacy Premium access.
  if (!Array.isArray(user.subscriptionFeatureIds) || user.subscriptionFeatureIds.length === 0) return true;
  if (!user.subscriptionFeatureIds.includes(featureId)) return false;
  const entitlement = user.subscriptionEntitlements?.[featureId];
  if (!entitlement || entitlement.enabled !== true) return false;
  const featureExpiry = Date.parse(String(entitlement.expiresAt || ''));
  return Number.isFinite(featureExpiry) && featureExpiry > now;
}
