import cron from 'node-cron';
import { PricingRepository, UserRepository } from '../db/repositories';
import { NotificationRepository } from '../db/repositories/NotificationRepository';

let reminderTask: ReturnType<typeof cron.schedule> | null = null;
let reminderTickRunning = false;

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
    if (settings.enabled !== true) return { scanned: 0, notified: 0, skipped: false };
    const daysBefore = Number(settings.daysBefore);
    if (!Number.isInteger(daysBefore) || daysBefore < 1 || daysBefore > 30) {
      console.warn('[Subscription Reminder] Invalid reminder lead time; tick skipped.');
      return { scanned: 0, notified: 0, skipped: true };
    }

    const users = await UserRepository.getAllAsync();
    const targetStart = now.getTime() + Math.max(0, daysBefore - 1) * 24 * 60 * 60 * 1000;
    const targetEnd = now.getTime() + daysBefore * 24 * 60 * 60 * 1000;
    for (const user of users || []) {
      if (!user?.id || user.membershipStatus !== 'Active' || !user.subscriptionExpiresAt) continue;
      const expiry = Date.parse(String(user.subscriptionExpiresAt));
      if (!Number.isFinite(expiry) || expiry < targetStart || expiry >= targetEnd) continue;
      const expiryKey = new Date(expiry).toISOString();
      try {
        await NotificationRepository.createAsync({
          userId: String(user.id),
          title: 'Premium Subscription Expiring Soon',
          message: `Your ${String(user.membershipTier || 'Premium')} subscription is due to expire in about ${daysBefore} day(s). Renew before expiry to avoid interruption.`,
          type: 'warning',
          channel: 'in-app',
          eventId: `subscription-expiry-reminder:${String(user.id)}:${expiryKey}:${daysBefore}`,
          metadata: { subscriptionExpiresAt: expiryKey, daysBefore, action: 'renew_subscription' }
        });
        notified += 1;
      } catch (notificationError: any) {
        console.error('[Subscription Reminder] Could not persist reminder for user:', user.id, notificationError?.message || notificationError);
      }
    }
    return { scanned: (users || []).length, notified, skipped: false };
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
