import cron from 'node-cron';
import crypto from 'crypto';
import { PaymentRepository, PricingRepository, UserRepository } from '../db/repositories';
import { hasActiveSubscriptionFeature, resolveSubscriptionPackage } from './subscriptionEntitlements';
import { sendConfiguredPremiumAlert } from './communicationDeliveryService';
import { NotificationRepository } from '../db/repositories/NotificationRepository';

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

/**
 * Sends idempotent in-app subscription expiry reminders.
 * External email/SMS/WhatsApp delivery is intentionally not claimed here:
 * those channels require configured providers and delivery receipts.
 */
export async function runSubscriptionReminderTick(now = new Date()): Promise<{ scanned: number; notified: number; skipped: boolean }> {
  if (reminderTickRunning) return { scanned: 0, notified: 0, skipped: true };
  reminderTickRunning = true;
  let notified = 0;
  try {
    const pricing = await PricingRepository.get();
    const settings = pricing?.subscriptionReminderSettings || {};
    const users = await UserRepository.getAllAsync();
    const autoRenewed = await processConsentedAutoRenewals(users || [], now);
    if (settings.enabled !== true) {
      return { scanned: (users || []).length, notified: autoRenewed, skipped: false };
    }
    const daysBefore = Number(settings.daysBefore);
    if (!Number.isInteger(daysBefore) || daysBefore < 1 || daysBefore > 30) {
      console.warn('[Subscription Reminder] Invalid reminder lead time; reminder delivery skipped (auto-renewal still processed).');
      return { scanned: (users || []).length, notified: autoRenewed, skipped: true };
    }

    const targetStart = now.getTime() + Math.max(0, daysBefore - 1) * 24 * 60 * 60 * 1000;
    const targetEnd = now.getTime() + daysBefore * 24 * 60 * 60 * 1000;
    for (const user of users || []) {
      if (!user?.id || user.membershipStatus !== 'Active' || !user.subscriptionExpiresAt) continue;
      const expiry = Date.parse(String(user.subscriptionExpiresAt));
      if (!Number.isFinite(expiry) || expiry < targetStart || expiry >= targetEnd) continue;
      const expiryKey = new Date(expiry).toISOString();
      const reminderToken = expiryKey + ':' + daysBefore;
      if (String(user.subscriptionReminderSentFor || '') === reminderToken) continue;
      const reminderMessage = `Your ${String(user.membershipTier || 'Premium')} subscription is due to expire in about ${daysBefore} day(s). Renew before expiry to avoid interruption.`;
      try {
        await NotificationRepository.createAsync({
          userId: String(user.id),
          title: 'Premium Subscription Expiring Soon',
          message: reminderMessage,
          type: 'warning',
          channel: 'in-app',
          eventId: `subscription-expiry-reminder:${String(user.id)}:${expiryKey}:${daysBefore}`,
          metadata: { subscriptionExpiresAt: expiryKey, daysBefore, action: 'renew_subscription' }
        });
        // Persist a send-once marker before external delivery to avoid duplicate messages after a restart.
        await UserRepository.updateAsync(String(user.id), { subscriptionReminderSentFor: reminderToken });
        notified += 1;

        if (user.emailAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'email_alerts')) {
          await sendConfiguredPremiumAlert(user, 'email', 'Your Premium Subscription Is Expiring', reminderMessage);
        }
        if (user.whatsappAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'whatsapp_alerts')) {
          await sendConfiguredPremiumAlert(user, 'whatsapp', 'Subscription expiry reminder', reminderMessage);
        }
        if (user.smsAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'sms_alerts')) {
          await sendConfiguredPremiumAlert(user, 'sms', 'Subscription expiry reminder', reminderMessage);
        }
      } catch (notificationError: any) {
        console.error('[Subscription Reminder] Could not process reminder for user:', user.id, notificationError?.message || notificationError);
      }
    }
    return { scanned: (users || []).length, notified: notified + autoRenewed, skipped: false };
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
  });
  console.log('[Subscription Reminder] Daily in-app expiry reminder scheduler initialized.');
}
