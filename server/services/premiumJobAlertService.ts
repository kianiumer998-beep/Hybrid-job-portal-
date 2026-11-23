import { Database } from '../db/database';
import { NotificationRepository, UserRepository } from '../db/repositories';
import { hasActiveSubscriptionFeature } from './subscriptionEntitlements';
import { sendConfiguredPremiumAlert } from './communicationDeliveryService';

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
  const users = await UserRepository.getAllAsync();
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
      if (user.emailAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'email_alerts')) {
        if (await sendConfiguredPremiumAlert(user, 'email', 'New job matching your alert: ' + String(job.title || ''), message)) deliveredChannels += 1;
      }
      if (user.whatsappAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'whatsapp_alerts')) {
        if (await sendConfiguredPremiumAlert(user, 'whatsapp', 'New job alert', message)) deliveredChannels += 1;
      }
      if (user.smsAlertsEnabled === true && await hasActiveSubscriptionFeature(String(user.id), 'sms_alerts')) {
        if (await sendConfiguredPremiumAlert(user, 'sms', 'New job alert', message)) deliveredChannels += 1;
      }
    } catch (error: any) {
      console.error('[Premium Job Alerts] Delivery failed for user:', user.id, error?.message || error);
    }
  }
  return { matchedUsers, deliveredChannels };
}
