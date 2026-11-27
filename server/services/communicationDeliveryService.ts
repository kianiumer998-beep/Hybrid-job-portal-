import { CommunicationProviderRepository } from '../db/repositories/CommunicationProviderRepository';

type DeliveryChannel = 'email' | 'whatsapp' | 'sms';

export interface DirectDeliveryResult {
  ok: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

export interface ChannelReadinessItem {
  ready: boolean;
  provider: string;
  reason?: string;
}

export interface CommunicationChannelReadiness {
  email: ChannelReadinessItem;
  whatsapp: ChannelReadinessItem;
  sms: ChannelReadinessItem;
}

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

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return `${fallback} (HTTP ${response.status})`;
    try {
      const json = JSON.parse(text);
      const msg =
        json?.message ||
        json?.error?.message ||
        json?.errors?.[0]?.message ||
        json?.detail ||
        text;
      return `${String(msg).slice(0, 220)} (HTTP ${response.status})`;
    } catch {
      return `${text.slice(0, 220)} (HTTP ${response.status})`;
    }
  } catch {
    return `${fallback} (HTTP ${response.status})`;
  }
}

export async function getCommunicationChannelReadiness(): Promise<CommunicationChannelReadiness> {
  const config = await CommunicationProviderRepository.getConfig();

  // Email readiness
  const emailProvider = config.emailProvider || 'smtp';
  let emailReady = false;
  let emailReason: string | undefined;
  if (emailProvider === 'resend') {
    const key = await CommunicationProviderRepository.getDecryptedSecret('resendApiKey');
    if (!key) emailReason = 'Resend API key missing';
    else if (!config.smtpSenderEmail) emailReason = 'Sender email missing';
    else emailReady = true;
  } else if (emailProvider === 'sendgrid') {
    const key = await CommunicationProviderRepository.getDecryptedSecret('sendgridApiKey');
    if (!key) emailReason = 'SendGrid API key missing';
    else if (!config.smtpSenderEmail) emailReason = 'Sender email missing';
    else emailReady = true;
  } else {
    emailReason = 'SMTP adapter selected; configure Resend or SendGrid for API broadcast';
  }

  // WhatsApp readiness
  const whatsappProvider = config.whatsappProvider || 'meta-cloud';
  let whatsappReady = false;
  let whatsappReason: string | undefined;
  if (whatsappProvider === 'meta-cloud') {
    const token = await CommunicationProviderRepository.getDecryptedSecret('whatsappCloudApiToken');
    if (!token) whatsappReason = 'Meta Cloud API token missing';
    else if (!config.whatsappPhoneNumberId) whatsappReason = 'WhatsApp Phone Number ID missing';
    else whatsappReady = true;
  } else if (whatsappProvider === 'twilio') {
    const token = await CommunicationProviderRepository.getDecryptedSecret('twilioAuthToken');
    if (!config.twilioAccountSid) whatsappReason = 'Twilio Account SID missing';
    else if (!token) whatsappReason = 'Twilio Auth Token missing';
    else if (!config.twilioPhoneNumber) whatsappReason = 'Twilio WhatsApp sender missing';
    else whatsappReady = true;
  }

  // SMS readiness
  const smsProvider = config.smsProvider || 'disabled';
  let smsReady = false;
  let smsReason: string | undefined;
  if (smsProvider === 'twilio') {
    const token = await CommunicationProviderRepository.getDecryptedSecret('twilioAuthToken');
    const from = String(config.smsFromNumber || config.twilioPhoneNumber || '').trim();
    if (!config.twilioAccountSid) smsReason = 'Twilio Account SID missing';
    else if (!token) smsReason = 'Twilio Auth Token missing';
    else if (!from) smsReason = 'SMS Sender Number missing';
    else smsReady = true;
  } else {
    smsReason = 'SMS adapter is Disabled in API Gateway settings';
  }

  return {
    email: { ready: emailReady, provider: emailProvider, reason: emailReason },
    whatsapp: { ready: whatsappReady, provider: whatsappProvider, reason: whatsappReason },
    sms: { ready: smsReady, provider: smsProvider, reason: smsReason }
  };
}

export async function deliverChannelMessageWithDetails(
  user: any,
  channel: DeliveryChannel,
  subject: string,
  message: string
): Promise<DirectDeliveryResult> {
  try {
    const config = await CommunicationProviderRepository.getConfig();
    if (channel === 'email') {
      const provider = config.emailProvider || 'smtp';
      const recipient = String(user?.email || '').trim();
      if (!recipient) {
        return { ok: false, provider, error: 'Recipient email address is missing.' };
      }
      if (provider === 'resend') {
        const key = await CommunicationProviderRepository.getDecryptedSecret('resendApiKey');
        if (!key || !config.smtpSenderEmail) {
          return {
            ok: false,
            provider: 'resend',
            error: 'Resend API key or sender email is not configured in Gateway Settings.'
          };
        }
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: config.smtpSenderEmail, to: [recipient], subject, text: message })
        });
        if (!response.ok) {
          return {
            ok: false,
            provider: 'resend',
            error: await readApiError(response, 'Resend delivery rejected')
          };
        }
        const data: any = await response.json().catch(() => ({}));
        return { ok: true, provider: 'resend', messageId: data?.id ? String(data.id) : undefined };
      }
      if (provider === 'sendgrid') {
        const key = await CommunicationProviderRepository.getDecryptedSecret('sendgridApiKey');
        if (!key || !config.smtpSenderEmail) {
          return {
            ok: false,
            provider: 'sendgrid',
            error: 'SendGrid API key or sender email is not configured in Gateway Settings.'
          };
        }
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
        if (!response.ok) {
          return {
            ok: false,
            provider: 'sendgrid',
            error: await readApiError(response, 'SendGrid delivery rejected')
          };
        }
        const msgId = response.headers.get('x-message-id') || undefined;
        return { ok: true, provider: 'sendgrid', messageId: msgId };
      }
      return {
        ok: false,
        provider: 'smtp',
        error: 'SMTP adapter has no live API transport; switch Email adapter to Resend or SendGrid.'
      };
    }

    const rawPhone = normalizePhoneNumber(user?.phone || user?.phoneNumber);
    if (!rawPhone) {
      const provider = channel === 'whatsapp' ? config.whatsappProvider || 'meta-cloud' : config.smsProvider || 'disabled';
      return { ok: false, provider, error: `Recipient ${channel.toUpperCase()} phone number is missing.` };
    }

    if (channel === 'whatsapp' && config.whatsappProvider === 'meta-cloud') {
      const token = await CommunicationProviderRepository.getDecryptedSecret('whatsappCloudApiToken');
      if (!token || !config.whatsappPhoneNumberId) {
        return {
          ok: false,
          provider: 'meta-cloud',
          error: 'Meta Cloud API token or WhatsApp Phone Number ID is not configured.'
        };
      }
      const response = await fetch(
        'https://graph.facebook.com/v20.0/' + encodeURIComponent(config.whatsappPhoneNumberId) + '/messages',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: rawPhone.replace(/^\+/, ''),
            type: 'text',
            text: { preview_url: false, body: message.slice(0, 4000) }
          })
        }
      );
      if (!response.ok) {
        return {
          ok: false,
          provider: 'meta-cloud',
          error: await readApiError(response, 'WhatsApp Cloud API rejected')
        };
      }
      const data: any = await response.json().catch(() => ({}));
      const waId = data?.messages?.[0]?.id ? String(data.messages[0].id) : undefined;
      return { ok: true, provider: 'meta-cloud', messageId: waId };
    }

    if (channel === 'whatsapp' && config.whatsappProvider === 'twilio') {
      const sid = String(config.twilioAccountSid || '').trim();
      const token = await CommunicationProviderRepository.getDecryptedSecret('twilioAuthToken');
      const from = String(config.twilioPhoneNumber || '').trim();
      if (!sid || !token || !from) {
        return {
          ok: false,
          provider: 'twilio',
          error: 'Twilio WhatsApp Account SID, Auth Token, or Sender is not configured.'
        };
      }
      const formattedPhone = rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone;
      const to = 'whatsapp:' + formattedPhone;
      const fromAddress = !from.startsWith('whatsapp:') ? 'whatsapp:' + from : from;
      const form = new URLSearchParams({ To: to, From: fromAddress, Body: message.slice(0, 1500) });
      const response = await fetch(
        'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json',
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + basicAuth(sid + ':' + token),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: form.toString()
        }
      );
      if (!response.ok) {
        return {
          ok: false,
          provider: 'twilio',
          error: await readApiError(response, 'Twilio WhatsApp rejected')
        };
      }
      const data: any = await response.json().catch(() => ({}));
      return { ok: true, provider: 'twilio', messageId: data?.sid ? String(data.sid) : undefined };
    }

    if (channel === 'sms' && config.smsProvider === 'twilio') {
      const sid = String(config.twilioAccountSid || '').trim();
      const token = await CommunicationProviderRepository.getDecryptedSecret('twilioAuthToken');
      const from = String(config.smsFromNumber || config.twilioPhoneNumber || '').trim();
      if (!sid || !token || !from) {
        return {
          ok: false,
          provider: 'twilio',
          error: 'Twilio SMS Account SID, Auth Token, or From Number is not configured.'
        };
      }
      const formattedPhone = rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone;
      const form = new URLSearchParams({ To: formattedPhone, From: from, Body: message.slice(0, 1500) });
      const response = await fetch(
        'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json',
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + basicAuth(sid + ':' + token),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: form.toString()
        }
      );
      if (!response.ok) {
        return {
          ok: false,
          provider: 'twilio',
          error: await readApiError(response, 'Twilio SMS rejected')
        };
      }
      const data: any = await response.json().catch(() => ({}));
      return { ok: true, provider: 'twilio', messageId: data?.sid ? String(data.sid) : undefined };
    }

    return {
      ok: false,
      provider: channel === 'sms' ? config.smsProvider || 'disabled' : 'disabled',
      error: `${channel.toUpperCase()} gateway provider is disabled or not configured.`
    };
  } catch (error: any) {
    console.error('[Communication Delivery] Delivery attempt failed:', error?.message || error);
    return {
      ok: false,
      provider: 'network',
      error: error?.message || 'Network/gateway error while dispatching message.'
    };
  }
}

async function deliverConfiguredPremiumAlert(user: any, channel: DeliveryChannel, subject: string, message: string): Promise<boolean> {
  const result = await deliverChannelMessageWithDetails(user, channel, subject, message);
  return result.ok;
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
