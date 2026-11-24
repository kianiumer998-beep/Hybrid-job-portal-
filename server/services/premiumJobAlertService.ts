import { Database } from '../db/database';
import { NotificationRepository, UserRepository } from '../db/repositories';
import { hasActiveSubscriptionFeature } from './subscriptionEntitlements';
import { sendConfiguredPremiumAlert } from './communicationDeliveryService';
import { FeatureFlagsRepository, JobRepository, PricingRepository } from '../db/repositories';
import { isEarlyAccessJobLocked } from './earlyAccessPolicy';

function matchesAlert(alert: any, job: any): boolean {
  const keyword = String(alert?.keyword || '').trim().toLowerCase();
  const city = String(alert?.city || '').trim().toLowerCase();
  const jobType = String(alert?.jobType || '').trim().toLowerCase();
  const searchable = [job?.title, job?.company, job?.department, job?.description, job?.jobCategory].map((v) => String(v || '').toLowerCase()).join(' ');
  if (keyword && !searchable.includes(keyword)) return false;
  if (city && !String(job?.city || job?.location || '').toLowerCase().includes(city)) return false;
  if (jobType && !String(job?.jobType || '').toLowerCase().includes(jobType)) return false;
  return Boolean(keyword || city || jobType);
}

export async function dispatchPremiumInstantJobAlerts(job: any): Promise<{ matchedUsers: number; deliveredChannels: number }> {
  if (!job?.id || job?.status !== 'Approved') return { matchedUsers: 0, deliveredChannels: 0 };
  let matchedUsers = 0;
  let deliveredChannels = 0;
  const [users, channelFlags] = await Promise.all([UserRepository.getAllAsync(), FeatureFlagsRepository.getFlags()]);
  const jobUrl = String(process.env.FRONTEND_URL || 'https://hybrid-job-portal.vercel.app').replace(/\/+$/, '') + '/jobs/' + encodeURIComponent(String(job.slug || job.id));
  const message = [
    'A new job matching your saved alert is now available.',
    'Job: ' + String(job.title || 'New Job'),
    'Company: ' + String(job.company || 'Not specified'),
    'City: ' + String(job.city || job.location || 'Not specified'),
    'Apply / details: ' + jobUrl
  ].join('\n');

  for (const user of users || []) {
    if (!user?.id || user.role === 'Admin' || user.role === 'Super Admin') continue;
    const alerts = Database.getJobAlerts(String(user.id)) || [];
    const matches = alerts.filter((alert: any) => String(alert?.frequency || 'daily').toLowerCase() === 'instant' && matchesAlert(alert, job));
    if (!matches.length) continue;
    matchedUsers += 1;
    try {
      await NotificationRepository.createAsync({
        userId: String(user.id),
        title: 'New Job Matches Your Alert',
        message,
        type: 'info',
        channel: 'in-app',
        eventId: 'premium-instant-job-alert:' + String(job.id) + ':' + String(user.id),
        metadata: { jobId: String(job.id), jobTitle: String(job.title || ''), jobUrl }
      });
      if (channelFlags.enableEmailAlerts === true && user.emailAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'email_alerts')) {
        if (await sendConfiguredPremiumAlert(user, 'email', 'New job matching your alert: ' + String(job.title || ''), message)) deliveredChannels += 1;
      }
      if (channelFlags.enableWhatsAppAlerts === true && user.whatsappAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'whatsapp_alerts')) {
        if (await sendConfiguredPremiumAlert(user, 'whatsapp', 'New job alert', message)) deliveredChannels += 1;
      }
      if (channelFlags.enableSmsAlerts === true && user.smsAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'sms_alerts')) {
        if (await sendConfiguredPremiumAlert(user, 'sms', 'New job alert', message)) deliveredChannels += 1;
      }
    } catch (error: any) {
      console.error('[Premium Job Alerts] Delivery failed for user:', user.id, error?.message || error);
    }
  }
  return { matchedUsers, deliveredChannels };
}

export async function dispatchPremiumJobAlertDigests(now = new Date()): Promise<number> {
  let digestCount = 0;
  const nowMs = now.getTime();
  const [users, jobsResult, pricing, channelFlags] = await Promise.all([
    UserRepository.getAllAsync(),
    JobRepository.getAll({ page: 1, limit: 1000, status: 'Approved' }),
    PricingRepository.get(),
    FeatureFlagsRepository.getFlags()
  ]);
  const jobs = jobsResult?.jobs || [];
  for (const user of users || []) {
    if (!user?.id) continue;
    const alerts = Database.getJobAlerts(String(user.id)) || [];
    for (const frequency of ['daily', 'weekly'] as const) {
      const dueAlerts = alerts.filter((alert: any) => String(alert?.frequency || 'daily').toLowerCase() === frequency);
      if (!dueAlerts.length) continue;
      const lastSentField = frequency === 'daily' ? 'lastDailyJobAlertDigestAt' : 'lastWeeklyJobAlertDigestAt';
      const lastSent = Date.parse(String(user[lastSentField] || ''));
      const intervalMs = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      if (Number.isFinite(lastSent) && nowMs - lastSent < intervalMs) continue;
      const cutoff = Number.isFinite(lastSent) ? lastSent : nowMs - intervalMs;
      const hasEarlyAccess = await hasActiveSubscriptionFeature(String(user.id), 'early_access');
      const matchedJobs = jobs.filter((job: any) => {
        const postedAt = Date.parse(String(job.createdAt || job.postedAt || job.datePosted || ''));
        if (!Number.isFinite(postedAt) || postedAt < cutoff) return false;
        if (!hasEarlyAccess && isEarlyAccessJobLocked(job, pricing?.earlyAccess, nowMs)) return false;
        return dueAlerts.some((alert: any) => matchesAlert(alert, job));
      }).slice(0, 20);
      await UserRepository.updateAsync(String(user.id), { [lastSentField]: now.toISOString() });
      if (!matchedJobs.length) continue;

      const dateKey = now.toISOString().slice(0, 10);
      const jobLines = matchedJobs.slice(0, 10).map((job: any, index: number) =>
        (index + 1) + '. ' + String(job.title || 'Job') + ' — ' + String(job.company || 'Company') + ' (' + String(job.city || job.location || 'Pakistan') + ')'
      );
      const message = frequency === 'daily'
        ? 'Your daily job-alert digest contains ' + matchedJobs.length + ' new matching job(s):\n' + jobLines.join('\n')
        : 'Your weekly job-alert roundup contains ' + matchedJobs.length + ' new matching job(s):\n' + jobLines.join('\n');
      const eventId = 'job-alert-digest:' + String(user.id) + ':' + frequency + ':' + dateKey;
      await NotificationRepository.createAsync({
        userId: String(user.id),
        title: frequency === 'daily' ? 'Your Daily Job Alert Digest' : 'Your Weekly Job Round-up',
        message,
        type: 'info',
        channel: 'in-app',
        eventId,
        metadata: { frequency, matchedJobCount: matchedJobs.length, jobIds: matchedJobs.map((job: any) => String(job.id)) }
      });
      if (channelFlags.enableEmailAlerts === true && user.emailAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'email_alerts')) {
        await sendConfiguredPremiumAlert(user, 'email', frequency === 'daily' ? 'Your Daily Job Alert Digest' : 'Your Weekly Job Round-up', message);
      }
      if (channelFlags.enableWhatsAppAlerts === true && user.whatsappAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'whatsapp_alerts')) {
        await sendConfiguredPremiumAlert(user, 'whatsapp', 'Your job alert digest', message);
      }
      if (channelFlags.enableSmsAlerts === true && user.smsAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'sms_alerts')) {
        await sendConfiguredPremiumAlert(user, 'sms', 'Your job alert digest', message);
      }
      digestCount += 1;
    }
  }
  return digestCount;
}
