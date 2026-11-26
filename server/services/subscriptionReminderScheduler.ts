import cron from 'node-cron';
import crypto from 'crypto';
import {
  AdRepository,
  FeatureFlagsRepository,
  JobRepository,
  PaymentRepository,
  PricingRepository,
  UserRepository
} from '../db/repositories';
import { hasActiveSubscriptionFeature, resolveSubscriptionPackage } from './subscriptionEntitlements';
import { sendConfiguredPremiumAlert } from './communicationDeliveryService';
import { dispatchPremiumJobAlertDigests } from './premiumJobAlertService';
import { NotificationRepository } from '../db/repositories/NotificationRepository';
import { getEarlyAccessReleaseAt, isEarlyAccessJobLocked } from './earlyAccessPolicy';

let reminderTask: ReturnType<typeof cron.schedule> | null = null;
let reminderTickRunning = false;

async function processConsentedAutoRenewals(users: any[], now: Date): Promise<number> {
  let renewed = 0;
  const nowMs = now.getTime();
  const windowEnd = nowMs + 24 * 60 * 60 * 1000;
  const pricing = await PricingRepository.get();
  const packages = Array.isArray(pricing?.subscriptionPackages) ? pricing.subscriptionPackages : [];

  for (const user of users || []) {
    if (user?.autoRenew !== true || user?.autoRenewPaymentMethod !== 'Wallet Balance' || !user?.autoRenewConsentAt || !user?.autoRenewPackageId) continue;
    const expiryMs = Date.parse(String(user.subscriptionExpiresAt || ''));
    if (!Number.isFinite(expiryMs) || expiryMs <= nowMs - 24 * 60 * 60 * 1000 || expiryMs > windowEnd) continue;

    const pkg = packages.find((item: any) => item?.id === user.autoRenewPackageId && item.enabled === true);
    if (!pkg) {
      await NotificationRepository.createAsync({
        userId: String(user.id),
        title: 'Auto-renewal Could Not Run',
        message: 'Your saved renewal package is no longer available. Choose a current package and renew manually.',
        type: 'warning',
        channel: 'in-app',
        eventId: `subscription-auto-renew-unavailable:${String(user.id)}:${String(user.subscriptionExpiresAt)}`
      });
      await UserRepository.updateAsync(String(user.id), { autoRenew: false, autoRenewDisabledAt: now.toISOString() });
      continue;
    }

    const durationDays = Number(pkg.durationDays);
    if (!Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3650) continue;
    let resolved: any;
    try { resolved = resolveSubscriptionPackage(pkg, pricing); }
    catch (error: any) {
      await NotificationRepository.createAsync({
        userId: String(user.id),
        title: 'Auto-renewal Needs Attention',
        message: error?.message || 'Your saved subscription package is not valid anymore. Please renew manually.',
        type: 'warning',
        channel: 'in-app',
        eventId: `subscription-auto-renew-invalid:${String(user.id)}:${String(user.subscriptionExpiresAt)}`
      });
      await UserRepository.updateAsync(String(user.id), { autoRenew: false, autoRenewDisabledAt: now.toISOString() });
      continue;
    }

    const packagePrice = Number(resolved.pricePkr);
    if (!Number.isSafeInteger(packagePrice) || packagePrice <= 0) continue;
    const consentedMaxAmount = Number(user.autoRenewMaxAmountPkr);
    if (!Number.isSafeInteger(consentedMaxAmount) || consentedMaxAmount <= 0 || packagePrice > consentedMaxAmount) {
      await NotificationRepository.createAsync({
        userId: String(user.id),
        title: 'Auto-renewal Needs Your Approval',
        message: 'The selected package price is now higher than the maximum amount you approved. No wallet deduction was made. Please review the new price and enable auto-renewal again.',
        type: 'warning',
        channel: 'in-app',
        eventId: `subscription-auto-renew-price-change:${String(user.id)}:${String(user.subscriptionExpiresAt)}:${String(pkg.id)}`
      });
      await UserRepository.updateAsync(String(user.id), { autoRenew: false, autoRenewDisabledAt: now.toISOString() });
      continue;
    }
    const expiryIso = new Date(expiryMs).toISOString();
    const operationKey = `subrenew-${crypto.createHash('sha256').update(`${String(user.id)}:${expiryIso}:${String(pkg.id)}`).digest('hex').slice(0, 48)}`;
    let tx: any = await PaymentRepository.findByIdempotencyKeyAsync(operationKey);
    if (!tx) {
      try {
        tx = await PaymentRepository.createAsync({
          type: 'Subscription',
          paymentMethod: 'Wallet Balance',
          amount: packagePrice,
          currency: 'PKR',
          plan: String(pkg.name || 'Subscription'),
          packageSnapshot: {
            id: String(pkg.id),
            name: String(pkg.name || 'Subscription'),
            pricePkr: packagePrice,
            durationDays,
            featureIds: resolved.featureIds,
            featureSnapshots: resolved.featureSnapshots,
            bundleDiscountPercent: resolved.bundleDiscountPercent,
            undiscountedPricePkr: resolved.undiscountedPricePkr,
            pricingMode: pkg.pricingMode === 'catalog' ? 'catalog' : 'fixed',
            timestamp: now.toISOString()
          },
          userId: String(user.id),
          userName: String(user.name || ''),
          userEmail: String(user.email || ''),
          status: 'Pending',
          idempotencyKey: operationKey,
          autoRenewal: true,
          consentAt: String(user.autoRenewConsentAt)
        });
      } catch (createError: any) {
        tx = await PaymentRepository.findByIdempotencyKeyAsync(operationKey);
        if (!tx) {
          console.error('[Subscription Auto-renewal] Could not create renewal transaction:', createError?.message || createError);
          continue;
        }
      }
    }
    if (tx?.status === 'Success') continue;
    if (tx?.status === 'Failed') continue;

    const renewalStart = Math.max(nowMs, expiryMs);
    const renewedExpiry = new Date(renewalStart + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const activatedAt = new Date(renewalStart).toISOString();
    const entitlements = { ...(user.subscriptionEntitlements || {}) };
    for (const feature of resolved.featureSnapshots || []) {
      const featureId = String(feature.id);
      const featureDays = Math.min(durationDays, Number(feature.durationDays) || durationDays);
      entitlements[featureId] = {
        enabled: true,
        grantedAt: activatedAt,
        expiresAt: new Date(renewalStart + featureDays * 24 * 60 * 60 * 1000).toISOString(),
        includedSlots: Math.max(0, Number(feature.includedSlots) || 0),
        remainingSlots: Math.max(0, Number(feature.includedSlots) || 0),
        slotDurationDays: Math.max(1, Number(feature.slotDurationDays) || durationDays),
        sourcePackageId: String(pkg.id)
      };
    }

    const updatedUser = await UserRepository.deductWalletBalanceOnceAsync(
      String(user.id),
      packagePrice,
      operationKey,
      {
        membershipTier: String(pkg.name || 'Subscription'),
        membershipStatus: 'Active',
        subscriptionExpiresAt: renewedExpiry,
        subscriptionFeatureIds: resolved.featureIds,
        subscriptionEntitlements: entitlements,
        autoRenewLastAttemptAt: now.toISOString()
      },
      {
        autoRenew: true,
        autoRenewPackageId: String(pkg.id),
        autoRenewConsentAt: String(user.autoRenewConsentAt)
      }
    );
    if (!updatedUser) {
      const latestUser = await UserRepository.getByIdAsync(String(user.id));
      const consentWithdrawn = latestUser?.autoRenew !== true ||
        String(latestUser?.autoRenewPackageId || '') !== String(pkg.id) ||
        String(latestUser?.autoRenewConsentAt || '') !== String(user.autoRenewConsentAt);
      const failureMessage = consentWithdrawn
        ? 'Auto-renewal was cancelled because the user withdrew consent before the wallet debit.'
        : 'Insufficient wallet balance for the consented subscription auto-renewal.';
      await PaymentRepository.updateAsync(String(tx.id), {
        status: 'Failed',
        walletMutationState: 'NONE',
        rejectionReason: failureMessage,
        updatedAt: now.toISOString()
      });
      await NotificationRepository.createAsync({
        userId: String(user.id),
        title: consentWithdrawn ? 'Auto-renewal Cancelled' : 'Auto-renewal Failed — Low Wallet Balance',
        message: consentWithdrawn
          ? 'Your auto-renewal was cancelled before any wallet deduction. Your subscription will follow its normal expiry.'
          : `Your ${String(pkg.name || 'subscription')} could not renew because your wallet balance is insufficient. Add funds or renew manually.`,
        type: 'warning',
        channel: 'in-app',
        eventId: `subscription-auto-renew-failed:${String(user.id)}:${expiryIso}:${String(pkg.id)}`
      });
      continue;
    }

    await PaymentRepository.updateAsync(String(tx.id), {
      status: 'Success',
      walletMutationState: 'DEDUCTED',
      balanceBefore: Number(updatedUser.walletBalance) + packagePrice,
      balanceAfter: Number(updatedUser.walletBalance),
      verifiedAt: now.toISOString(),
      adminNote: 'Automatically renewed using the user-consented wallet payment method.',
      autoRenewal: true
    });
    await NotificationRepository.createAsync({
      userId: String(user.id),
      title: 'Subscription Automatically Renewed',
      message: `Your ${String(pkg.name || 'subscription')} renewed successfully. PKR ${packagePrice.toLocaleString()} was deducted from your wallet; remaining balance: PKR ${Number(updatedUser.walletBalance).toLocaleString()}.`,
      type: 'success',
      channel: 'in-app',
      eventId: `subscription-auto-renew-success:${String(user.id)}:${expiryIso}:${String(pkg.id)}`,
      metadata: { transactionId: tx.id, packageId: pkg.id, balanceAfter: updatedUser.walletBalance, subscriptionExpiresAt: renewedExpiry }
    });
    renewed += 1;
  }
  return renewed;
}

function clampDays(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : fallback;
}

function isWithinLeadDays(expiryMs: number, nowMs: number, daysBefore: number): boolean {
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) return false;
  const targetStart = nowMs + Math.max(0, daysBefore - 1) * 24 * 60 * 60 * 1000;
  const targetEnd = nowMs + daysBefore * 24 * 60 * 60 * 1000;
  return expiryMs >= targetStart && expiryMs < targetEnd;
}

async function deliverToUserChannels(params: {
  user: any;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  eventId: string;
  metadata?: Record<string, any>;
  channels: { inApp: boolean; email: boolean; whatsapp: boolean; sms: boolean };
  channelFlags: any;
  requireSubscribedAlerts?: boolean;
}): Promise<{ inApp: number; email: number; whatsapp: number; sms: number }> {
  const { user, title, message, type, eventId, metadata, channels, channelFlags, requireSubscribedAlerts } = params;
  const result = { inApp: 0, email: 0, whatsapp: 0, sms: 0 };
  if (!user?.id) return result;

  if (channels.inApp) {
    await NotificationRepository.createAsync({
      userId: String(user.id),
      title,
      message,
      type,
      channel: 'in-app',
      eventId,
      metadata
    });
    result.inApp += 1;
  }

  if (channels.email && channelFlags?.enableEmailAlerts === true && String(user.email || '').trim()) {
    const allowed = !requireSubscribedAlerts || (user.emailAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'email_alerts'));
    if (allowed && await sendConfiguredPremiumAlert(user, 'email', title, message, `${eventId}:email`)) {
      result.email += 1;
    }
  }

  if (channels.whatsapp && channelFlags?.enableWhatsAppAlerts === true && String(user.whatsappNumber || user.phone || '').trim()) {
    const allowed = !requireSubscribedAlerts || (user.whatsappAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'whatsapp_alerts'));
    if (allowed && await sendConfiguredPremiumAlert(user, 'whatsapp', title, message, `${eventId}:whatsapp`)) {
      result.whatsapp += 1;
    }
  }

  if (channels.sms && channelFlags?.enableSmsAlerts === true && String(user.phone || user.whatsappNumber || '').trim()) {
    const allowed = !requireSubscribedAlerts || (user.smsAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'sms_alerts'));
    if (allowed && await sendConfiguredPremiumAlert(user, 'sms', title, message, `${eventId}:sms`)) {
      result.sms += 1;
    }
  }

  return result;
}

async function processPriorityJobTierReminders(pricing: any, users: any[], channelFlags: any, now: Date): Promise<number> {
  const tierSettings = pricing?.jobPosting?.tierReminderSettings;
  if (!tierSettings || typeof tierSettings !== 'object') return 0;

  const hasAnyEnabled = (['vip', 'pinned', 'featured', 'urgent', 'future'] as const).some(
    (k) => tierSettings[k]?.enabled === true
  );
  if (!hasAnyEnabled) return 0;

  const jobsResult = await JobRepository.getAll({ page: 1, limit: 1000, status: 'Approved' });
  const jobs = jobsResult?.jobs || [];
  const usersById = new Map<string, any>();
  const usersByEmail = new Map<string, any>();
  for (const u of users || []) {
    if (u?.id) usersById.set(String(u.id), u);
    if (u?.email) usersByEmail.set(String(u.email).trim().toLowerCase(), u);
  }

  let notified = 0;
  const nowMs = now.getTime();
  const jp = pricing?.jobPosting || {};

  const tierLabelMap: Record<'vip' | 'pinned' | 'featured' | 'urgent' | 'future', { label: string; defaultDays: number }> = {
    vip: { label: 'VIP Ultimate', defaultDays: Number(jp.vipBundleDurationDays || 45) },
    pinned: { label: 'Pinned Top #1', defaultDays: Number(jp.featuredTopDurationDays || 30) },
    featured: { label: 'Featured Placement', defaultDays: Number(jp.featuredDurationDays || 30) },
    urgent: { label: 'Urgent Hiring', defaultDays: Number(jp.urgentDurationDays || 15) },
    future: { label: 'Future Job', defaultDays: Number(jp.futureJobDurationDays || 60) }
  };

  for (const job of jobs) {
    if (!job?.id) continue;
    let tierKey: 'vip' | 'pinned' | 'featured' | 'urgent' | 'future' | null = null;
    if (job.priorityTier === 'vip_bundle' || job.vipBundle === true) tierKey = 'vip';
    else if (job.priorityTier === 'featured_top' || job.isPinnedTop === true) tierKey = 'pinned';
    else if (job.priorityTier === 'featured' || job.featured === true) tierKey = 'featured';
    else if (job.priorityTier === 'urgent' || job.urgent === true) tierKey = 'urgent';
    else if (job.priorityTier === 'future_job' || job.isFutureJob === true) tierKey = 'future';
    // Explicitly skip Standard jobs as requested
    if (!tierKey) continue;

    const cfg = tierSettings[tierKey];
    if (!cfg || cfg.enabled !== true) continue;
    const daysBefore = clampDays(cfg.daysBefore, 3);

    const explicitExpiry = Date.parse(String(job.subscriptionSlotExpiresAt || job.priorityExpiresAt || ''));
    const startTs = Date.parse(String(job.approvedAt || job.verifiedDate || job.createdAt || job.postedAt || ''));
    const expiryMs = Number.isFinite(explicitExpiry)
      ? explicitExpiry
      : Number.isFinite(startTs)
      ? startTs + tierLabelMap[tierKey].defaultDays * 24 * 60 * 60 * 1000
      : Number.NaN;

    if (!isWithinLeadDays(expiryMs, nowMs, daysBefore)) continue;

    const owner =
      (job.submittedByUserId && usersById.get(String(job.submittedByUserId))) ||
      (job.contactEmail && usersByEmail.get(String(job.contactEmail).trim().toLowerCase()));
    if (!owner?.id) continue;

    const expiryIso = new Date(expiryMs).toISOString();
    const eventId = `job-tier-expiry:${String(job.id)}:${tierKey}:${expiryIso}:${daysBefore}`;
    const title = `${tierLabelMap[tierKey].label} Job Listing Expiring Soon`;
    const message = `Your ${tierLabelMap[tierKey].label} job "${String(job.title || 'Job Listing')}" is due to expire in about ${daysBefore} day(s). Renew or upgrade in your Employer Dashboard to maintain priority placement.`;

    try {
      const sent = await deliverToUserChannels({
        user: owner,
        title,
        message,
        type: 'warning',
        eventId,
        metadata: { jobId: String(job.id), tier: tierKey, expiresAt: expiryIso, daysBefore },
        channels: {
          inApp: cfg.inAppEnabled !== false,
          email: cfg.emailEnabled === true,
          whatsapp: cfg.whatsappEnabled === true,
          sms: cfg.smsEnabled === true
        },
        channelFlags,
        requireSubscribedAlerts: false
      });
      if (sent.inApp + sent.email + sent.whatsapp + sent.sms > 0) notified += 1;
    } catch (err: any) {
      console.error('[Job Tier Reminder] Delivery error:', job.id, err?.message || err);
    }
  }
  return notified;
}

async function processAdPlacementReminders(pricing: any, users: any[], channelFlags: any, now: Date): Promise<number> {
  const options = Array.isArray(pricing?.campaignCustomizationConfig?.placementOptions)
    ? pricing.campaignCustomizationConfig.placementOptions
    : [];
  const reminderByPlacement = new Map<string, any>();
  for (const opt of options) {
    if (opt?.id && opt?.expiryReminder?.enabled === true) {
      reminderByPlacement.set(String(opt.id), opt);
    }
  }
  if (reminderByPlacement.size === 0) return 0;

  const ads = await AdRepository.getAllAsync({ status: 'active' });
  const usersById = new Map<string, any>();
  const usersByEmail = new Map<string, any>();
  for (const u of users || []) {
    if (u?.id) usersById.set(String(u.id), u);
    if (u?.email) usersByEmail.set(String(u.email).trim().toLowerCase(), u);
  }

  let notified = 0;
  const nowMs = now.getTime();
  for (const ad of ads || []) {
    const placementOpt = reminderByPlacement.get(String(ad?.placement || ''));
    if (!placementOpt) continue;
    const cfg = placementOpt.expiryReminder;
    const hoursBefore = Math.min(720, Math.max(1, Math.floor(Number(cfg?.hoursBefore) || 24)));
    const expiryMs = Date.parse(String(ad.scheduledEndAt || ad.endDate || ''));
    if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) continue;
    if (expiryMs > nowMs + hoursBefore * 60 * 60 * 1000) continue;

    const owner =
      (ad.submittedByUserId && usersById.get(String(ad.submittedByUserId))) ||
      (ad.submittedByUserEmail && usersByEmail.get(String(ad.submittedByUserEmail).trim().toLowerCase())) ||
      (ad.clientEmail && usersByEmail.get(String(ad.clientEmail).trim().toLowerCase()));
    if (!owner?.id) continue;

    const expiryIso = new Date(expiryMs).toISOString();
    const eventId = `ad-placement-expiry:${String(ad.id)}:${String(ad.placement)}:${expiryIso}:${hoursBefore}`;
    const placementLabel = String(placementOpt.name || ad.placement || 'Ad Campaign');
    const title = `Ad Campaign Expiring Soon (${placementLabel})`;
    const message = `Your advertisement "${String(ad.title || 'Campaign')}" in ${placementLabel} will expire within ${hoursBefore} hour(s). Extend or renew your slot to keep traffic running.`;

    try {
      const sent = await deliverToUserChannels({
        user: owner,
        title,
        message,
        type: 'warning',
        eventId,
        metadata: { adId: String(ad.id), placement: ad.placement, expiresAt: expiryIso, hoursBefore },
        channels: {
          inApp: cfg.inAppEnabled !== false,
          email: cfg.emailEnabled === true,
          whatsapp: cfg.whatsappEnabled === true,
          sms: cfg.smsEnabled === true
        },
        channelFlags,
        requireSubscribedAlerts: false
      });
      if (sent.inApp + sent.email + sent.whatsapp + sent.sms > 0) notified += 1;
    } catch (err: any) {
      console.error('[Ad Placement Reminder] Delivery error:', ad.id, err?.message || err);
    }
  }
  return notified;
}

export async function dispatchEarlyAccessReminderNow(options?: {
  customSubject?: string;
  customMessage?: string;
  channels?: { inApp?: boolean; email?: boolean; whatsapp?: boolean; sms?: boolean };
  jobIds?: string[];
  manualTrigger?: boolean;
}): Promise<{
  eligibleMembers: number;
  jobsCount: number;
  inAppSent: number;
  emailSent: number;
  whatsappSent: number;
  smsSent: number;
}> {
  const [pricing, users, jobsResult, channelFlags] = await Promise.all([
    PricingRepository.get(),
    UserRepository.getAllAsync(),
    JobRepository.getAll({ page: 1, limit: 1000, status: 'Approved' }),
    FeatureFlagsRepository.getFlags()
  ]);

  const early = pricing?.earlyAccess || {};
  const reminderCfg = early.reminderSettings || {};
  const now = new Date();
  const nowMs = now.getTime();

  const lockedJobs = (jobsResult?.jobs || []).filter((job: any) => {
    if (!isEarlyAccessJobLocked(job, early, nowMs)) return false;
    if (Array.isArray(options?.jobIds) && options.jobIds.length > 0 && !options.jobIds.includes(String(job.id))) {
      return false;
    }
    return true;
  });

  const hoursBeforeRelease = Math.min(168, Math.max(1, Math.floor(Number(reminderCfg.hoursBeforeRelease) || 2)));
  const relevantJobs = options?.manualTrigger
    ? lockedJobs
    : lockedJobs.filter((job: any) => {
        const releaseAt = getEarlyAccessReleaseAt(job, early);
        if (!releaseAt) return false;
        const releaseMs = Date.parse(releaseAt);
        return Number.isFinite(releaseMs) && releaseMs > nowMs && releaseMs <= nowMs + hoursBeforeRelease * 60 * 60 * 1000;
      });

  const targetChannels = {
    inApp: options?.channels?.inApp !== undefined ? Boolean(options.channels.inApp) : reminderCfg.inAppEnabled !== false,
    email: options?.channels?.email !== undefined ? Boolean(options.channels.email) : reminderCfg.emailEnabled === true,
    whatsapp: options?.channels?.whatsapp !== undefined ? Boolean(options.channels.whatsapp) : reminderCfg.whatsappEnabled === true,
    sms: options?.channels?.sms !== undefined ? Boolean(options.channels.sms) : reminderCfg.smsEnabled === true
  };

  if (relevantJobs.length === 0) {
    return { eligibleMembers: 0, jobsCount: 0, inAppSent: 0, emailSent: 0, whatsappSent: 0, smsSent: 0 };
  }

  const jobSummaryLines = relevantJobs.slice(0, 6).map((j: any, i: number) => `${i + 1}. ${String(j.title || 'New Job')} — ${String(j.company || 'Employer')} (${String(j.city || j.location || 'Pakistan')})`);
  const defaultTitle = options?.manualTrigger
    ? `Premium Early Access: ${relevantJobs.length} Exclusive Job(s) Available Now`
    : `Early Access Window Closing Soon (${hoursBeforeRelease}h Left Before Public Release)`;
  const subject = (options?.customSubject || reminderCfg.customSubject || defaultTitle).trim();
  const customBody = (options?.customMessage || reminderCfg.customMessage || '').trim();
  const message = customBody
    ? `${customBody}\n\n${jobSummaryLines.join('\n')}`
    : `${relevantJobs.length} exclusive job(s) are currently live in Premium Early Access before public release:\n${jobSummaryLines.join('\n')}`;

  const batchWindowKey = options?.manualTrigger
    ? `manual:${now.toISOString().slice(0, 16)}`
    : `auto:${relevantJobs.map((j: any) => String(j.id)).slice(0, 5).join(',')}:${hoursBeforeRelease}h`;

  let eligibleMembers = 0;
  let inAppSent = 0;
  let emailSent = 0;
  let whatsappSent = 0;
  let smsSent = 0;

  for (const user of users || []) {
    if (!user?.id || user.role === 'Admin' || user.role === 'Super Admin') continue;
    if (!await hasActiveSubscriptionFeature(String(user.id), 'early_access')) continue;
    eligibleMembers += 1;

    try {
      const sent = await deliverToUserChannels({
        user,
        title: subject,
        message,
        type: 'info',
        eventId: `early-access-reminder:${String(user.id)}:${batchWindowKey}`,
        metadata: { scope: 'early-access', jobCount: relevantJobs.length, jobIds: relevantJobs.slice(0, 10).map((j: any) => String(j.id)) },
        channels: targetChannels,
        channelFlags,
        requireSubscribedAlerts: false
      });
      inAppSent += sent.inApp;
      emailSent += sent.email;
      whatsappSent += sent.whatsapp;
      smsSent += sent.sms;
    } catch (err: any) {
      console.error('[Early Access Reminder] Delivery error for user:', user.id, err?.message || err);
    }
  }

  return {
    eligibleMembers,
    jobsCount: relevantJobs.length,
    inAppSent,
    emailSent,
    whatsappSent,
    smsSent
  };
}

export async function maybeNotifyEarlyAccessUnlock(job: any): Promise<void> {
  if (!job?.id || job.status !== 'Approved') return;
  const pricing = await PricingRepository.get();
  const early = pricing?.earlyAccess || {};
  if (early.enabled !== true) return;
  const reminderCfg = early.reminderSettings || {};
  if (reminderCfg.enabled !== true || reminderCfg.notifyOnNewEarlyAccess !== true) return;
  if (!isEarlyAccessJobLocked(job, early, Date.now())) return;
  await dispatchEarlyAccessReminderNow({ jobIds: [String(job.id)], manualTrigger: true });
}

/**
 * Sends idempotent in-app and external channel expiry reminders for subscriptions,
 * Early Access unlocks, Priority Job Tiers, and Ad Placements.
 */
export async function runSubscriptionReminderTick(now = new Date()): Promise<{ scanned: number; notified: number; skipped: boolean }> {
  if (reminderTickRunning) return { scanned: 0, notified: 0, skipped: true };
  reminderTickRunning = true;
  let notified = 0;
  try {
    const [pricing, users, channelFlags] = await Promise.all([
      PricingRepository.get(),
      UserRepository.getAllAsync(),
      FeatureFlagsRepository.getFlags()
    ]);

    const autoRenewed = await processConsentedAutoRenewals(users || [], now);
    const jobDigests = await dispatchPremiumJobAlertDigests(now);
    const settings = pricing?.subscriptionReminderSettings || {};

    // Per-channel subscription expiry reminders (In-App + Email + WhatsApp + SMS)
    const inAppEnabled = settings.inAppEnabled !== undefined ? settings.inAppEnabled === true : settings.enabled === true;
    const emailEnabled = settings.emailEnabled !== undefined ? settings.emailEnabled === true : settings.enabled === true;
    const whatsappEnabled = settings.whatsappEnabled === true;
    const smsEnabled = settings.smsEnabled === true;

    const inAppDays = clampDays(settings.inAppDaysBefore ?? settings.daysBefore, 3);
    const emailDays = clampDays(settings.emailDaysBefore ?? settings.daysBefore, 3);
    const whatsappDays = clampDays(settings.whatsappDaysBefore ?? settings.daysBefore, 3);
    const smsDays = clampDays(settings.smsDaysBefore ?? settings.daysBefore, 3);

    const anySubscriptionReminderActive = inAppEnabled || emailEnabled || whatsappEnabled || smsEnabled;
    if (anySubscriptionReminderActive) {
      const nowMs = now.getTime();
      for (const user of users || []) {
        if (!user?.id || user.membershipStatus !== 'Active' || !user.subscriptionExpiresAt) continue;
        const expiry = Date.parse(String(user.subscriptionExpiresAt));
        if (!Number.isFinite(expiry) || expiry <= nowMs) continue;
        const expiryKey = new Date(expiry).toISOString();
        const existingTokens: Record<string, string> = { ...(user.subscriptionReminderTokens || {}) };
        let updatedTokens = false;

        try {
          if (inAppEnabled && isWithinLeadDays(expiry, nowMs, inAppDays)) {
            const token = `${expiryKey}:${inAppDays}`;
            const legacyMatch = String(user.subscriptionReminderSentFor || '') === token && inAppDays === clampDays(settings.daysBefore, 3);
            if (existingTokens.inApp !== token && !legacyMatch) {
              const reminderMessage = `Your ${String(user.membershipTier || 'Premium')} subscription is due to expire in about ${inAppDays} day(s). Renew before expiry to avoid interruption.`;
              await NotificationRepository.createAsync({
                userId: String(user.id),
                title: 'Premium Subscription Expiring Soon',
                message: reminderMessage,
                type: 'warning',
                channel: 'in-app',
                eventId: `subscription-expiry-reminder:${String(user.id)}:${expiryKey}:${inAppDays}`,
                metadata: { subscriptionExpiresAt: expiryKey, daysBefore: inAppDays, action: 'renew_subscription' }
              });
              existingTokens.inApp = token;
              updatedTokens = true;
              notified += 1;
            }
          }

          if (emailEnabled && isWithinLeadDays(expiry, nowMs, emailDays)) {
            const token = `${expiryKey}:${emailDays}`;
            if (existingTokens.email !== token) {
              if (user.emailAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'email_alerts')) {
                const msg = `Your ${String(user.membershipTier || 'Premium')} subscription is due to expire in about ${emailDays} day(s). Renew before expiry to avoid interruption.`;
                await sendConfiguredPremiumAlert(user, 'email', 'Your Premium Subscription Is Expiring', msg, `subscription-expiry-reminder:${String(user.id)}:${expiryKey}:${emailDays}:email`);
                notified += 1;
              }
              existingTokens.email = token;
              updatedTokens = true;
            }
          }

          if (whatsappEnabled && isWithinLeadDays(expiry, nowMs, whatsappDays)) {
            const token = `${expiryKey}:${whatsappDays}`;
            if (existingTokens.whatsapp !== token) {
              if (user.whatsappAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'whatsapp_alerts')) {
                const msg = `Your ${String(user.membershipTier || 'Premium')} subscription is due to expire in about ${whatsappDays} day(s). Renew before expiry to avoid interruption.`;
                await sendConfiguredPremiumAlert(user, 'whatsapp', 'Subscription expiry reminder', msg, `subscription-expiry-reminder:${String(user.id)}:${expiryKey}:${whatsappDays}:whatsapp`);
                notified += 1;
              }
              existingTokens.whatsapp = token;
              updatedTokens = true;
            }
          }

          if (smsEnabled && isWithinLeadDays(expiry, nowMs, smsDays)) {
            const token = `${expiryKey}:${smsDays}`;
            if (existingTokens.sms !== token) {
              if (user.smsAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'sms_alerts')) {
                const msg = `Your ${String(user.membershipTier || 'Premium')} subscription is due to expire in about ${smsDays} day(s). Renew before expiry to avoid interruption.`;
                await sendConfiguredPremiumAlert(user, 'sms', 'Subscription expiry reminder', msg, `subscription-expiry-reminder:${String(user.id)}:${expiryKey}:${smsDays}:sms`);
                notified += 1;
              }
              existingTokens.sms = token;
              updatedTokens = true;
            }
          }

          if (updatedTokens) {
            await UserRepository.updateAsync(String(user.id), {
              subscriptionReminderTokens: existingTokens,
              ...(existingTokens.inApp ? { subscriptionReminderSentFor: existingTokens.inApp } : {})
            });
          }
        } catch (notificationError: any) {
          console.error('[Subscription Reminder] Could not process reminder for user:', user.id, notificationError?.message || notificationError);
        }
      }
    }

    // Early Access pre-release automatic reminder
    let earlyAccessNotified = 0;
    if (pricing?.earlyAccess?.enabled === true && pricing?.earlyAccess?.reminderSettings?.enabled === true && pricing?.earlyAccess?.reminderSettings?.notifyBeforePublicRelease === true) {
      const eaRes = await dispatchEarlyAccessReminderNow({ manualTrigger: false });
      earlyAccessNotified = eaRes.inAppSent + eaRes.emailSent + eaRes.whatsappSent + eaRes.smsSent;
    }

    // Priority Job Tier expiry reminders (VIP, Pinned, Featured, Urgent, Future — excluding Standard)
    const jobTierNotified = await processPriorityJobTierReminders(pricing, users || [], channelFlags, now);

    // Ad Placement pre-expiry reminders
    const adPlacementNotified = await processAdPlacementReminders(pricing, users || [], channelFlags, now);

    return {
      scanned: (users || []).length,
      notified: notified + autoRenewed + jobDigests + earlyAccessNotified + jobTierNotified + adPlacementNotified,
      skipped: false
    };
  } finally {
    reminderTickRunning = false;
  }
}

export function initSubscriptionReminderScheduler(): void {
  if (reminderTask) return;
  reminderTask = cron.schedule('15 8 * * *', () => {
    runSubscriptionReminderTick().catch((error: any) => {
      console.error('[Subscription Reminder] Scheduled tick failed:', error?.message || error);
    });
  }, { timezone: 'Asia/Karachi' });
  console.log('[Subscription Reminder] Daily in-app & multi-channel expiry reminder scheduler initialized.');
}
