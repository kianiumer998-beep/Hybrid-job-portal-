import { CommunicationProviderRepository } from '../db/repositories/CommunicationProviderRepository';

type DeliveryChannel = 'email' | 'whatsapp' | 'sms';

function normalizePhoneNumber(value: unknown): string {
  let phone = String(value || '').trim().replace(/[^0-9+]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (/^03[0-9]{9}$/.test(phone)) phone = '+92' + phone.slice(1);
  else if (/^3[0-9]{9}$/.test(phone)) phone = '+92' + phone;
  else if (/^92[0-9]{10}$/.test(phone)) phone = '+' + phone;
  return phone;
}

function basicAuth(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

async function deliverConfiguredPremiumAlert(user: any, channel: DeliveryChannel, subject: string, message: string): Promise<boolean> {
  try {
    const config = await CommunicationProviderRepository.getConfig();
    if (channel === 'email') {
      const recipient = String(user?.email || '').trim();
      if (!recipient) return false;
      if (config.emailProvider === 'resend') {
        const key = await CommunicationProviderRepository.getDecryptedSecret('resendApiKey');
        if (!key || !config.smtpSenderEmail) return false;
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: config.smtpSenderEmail, to: [recipient], subject, text: message })
        });
        return response.ok;
      }
      if (config.emailProvider === 'sendgrid') {
        const key = await CommunicationProviderRepository.getDecryptedSecret('sendgridApiKey');
        if (!key || !config.smtpSenderEmail) return false;
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: recipient }] }],
            from: { email: config.smtpSenderEmail },
            subject,
            content: [{ type: 'text/plain', value: message }]
          })
        });
        return response.ok;
      }
      // SMTP settings are retained, but no SMTP transport dependency is installed.
      return false;
    }

    const rawPhone = normalizePhoneNumber(user?.phone || user?.phoneNumber);
    if (!rawPhone) return false;
    if (channel === 'whatsapp' && config.whatsappProvider === 'meta-cloud') {
      const token = await CommunicationProviderRepository.getDecryptedSecret('whatsappCloudApiToken');
      if (!token || !config.whatsappPhoneNumberId) return false;
      const response = await fetch('https://graph.facebook.com/v20.0/' + encodeURIComponent(config.whatsappPhoneNumberId) + '/messages', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: rawPhone.replace(/^\+/, ''),
          type: 'text',
          text: { preview_url: false, body: message.slice(0, 4000) }
        })
      });
      return response.ok;
    }

    if (channel === 'whatsapp' && config.whatsappProvider === 'twilio') {
      const sid = String(config.twilioAccountSid || '').trim();
      const token = await CommunicationProviderRepository.getDecryptedSecret('twilioAuthToken');
      const from = String(config.twilioPhoneNumber || '').trim();
      if (!sid || !token || !from) return false;
      const formattedPhone = rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone;
      const to = channel === 'whatsapp' ? 'whatsapp:' + formattedPhone : formattedPhone;
      const fromAddress = channel === 'whatsapp' && !from.startsWith('whatsapp:') ? 'whatsapp:' + from : from;
      const form = new URLSearchParams({ To: to, From: fromAddress, Body: message.slice(0, 1500) });
      const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + basicAuth(sid + ':' + token), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      });
      return response.ok;
    }

    if (channel === 'sms' && config.smsProvider === 'twilio') {
      const sid = String(config.twilioAccountSid || '').trim();
      const token = await CommunicationProviderRepository.getDecryptedSecret('twilioAuthToken');
      const from = String(config.smsFromNumber || config.twilioPhoneNumber || '').trim();
      if (!sid || !token || !from) return false;
      const formattedPhone = rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone;
      const form = new URLSearchParams({ To: formattedPhone, From: from, Body: message.slice(0, 1500) });
      const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', { method: 'POST', headers: { Authorization: 'Basic ' + basicAuth(sid + ':' + token), 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
      return response.ok;
    }
    return false;
  } catch (error: any) {
    console.error('[Communication Delivery] Delivery attempt failed:', error?.message || error);
    return false;
  }
}


/** Sends a single administrator-requested provider test without consuming a customer subscription quota. */
export async function sendProviderTestMessage(channel: DeliveryChannel, recipient: string, subject: string, message: string): Promise<boolean> {
  const cleanRecipient = String(recipient || '').trim();
  if (!cleanRecipient || !String(message || '').trim()) return false;
  const testUser = channel === 'email' ? { email: cleanRecipient } : { phone: cleanRecipient };
  return deliverConfiguredPremiumAlert(testUser, channel, String(subject || 'Hybrid Job Portal provider test').slice(0, 120), String(message).slice(0, 1500));
}

/** Applies the paid subscription quota around a real provider delivery. Failed provider
 * attempts release their reservation; repeated event IDs cannot send twice. */
export async function sendConfiguredPremiumAlert(user: any, channel: DeliveryChannel, subject: string, message: string, eventId: string): Promise<boolean> {
  const cleanEventId = String(eventId || '').trim();
  if (!user?.id || !cleanEventId) return false;
  const featureId = channel === 'email' ? 'email_alerts' : channel === 'whatsapp' ? 'whatsapp_alerts' : 'sms_alerts';
  const { SubscriptionUsageRepository } = await import('../db/repositories/SubscriptionUsageRepository');
  let reservation: { ok: boolean; reason: string; month: string };
  try {
    reservation = await SubscriptionUsageRepository.reserveMessageQuota(String(user.id), featureId, cleanEventId);
  } catch (error: any) {
    console.error('[Communication Delivery] Subscription quota reservation failed:', error?.message || error);
    return false;
  }
  if (!reservation.ok) return false;
  const delivered = await deliverConfiguredPremiumAlert(user, channel, subject, message);
  try {
    const providerConfig = await CommunicationProviderRepository.getConfig();
    const provider = channel === 'email' ? providerConfig.emailProvider : channel === 'whatsapp' ? providerConfig.whatsappProvider : providerConfig.smsProvider;
    await SubscriptionUsageRepository.logMessageDelivery({
      eventId: cleanEventId,
      userId: String(user.id),
      featureId,
      channel,
      provider: String(provider || 'disabled'),
      status: delivered ? 'SENT' : 'FAILED'
    });
  } catch (logError: any) {
    console.error('[Communication Delivery] Could not persist provider delivery log:', logError?.message || logError);
  }
  if (delivered) {
    const completed = await SubscriptionUsageRepository.completeMessageQuota(String(user.id), featureId, cleanEventId);
    if (!completed) console.error('[Communication Delivery] Provider accepted a message but quota completion needs reconciliation:', cleanEventId);
    return true;
  }
  await SubscriptionUsageRepository.releaseMessageQuota(String(user.id), featureId, cleanEventId, reservation.month).catch((error: any) => {
    console.error('[Communication Delivery] Failed to release message quota reservation:', error?.message || error);
  });
  return false;
}
