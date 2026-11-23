import { CommunicationProviderRepository } from '../db/repositories/CommunicationProviderRepository';

type DeliveryChannel = 'email' | 'whatsapp' | 'sms';

function basicAuth(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

export async function sendConfiguredPremiumAlert(user: any, channel: DeliveryChannel, subject: string, message: string): Promise<boolean> {
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

    const rawPhone = String(user?.phone || user?.phoneNumber || '').replace(/[^0-9+]/g, '');
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

    if (config.whatsappProvider === 'twilio') {
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
    return false;
  } catch (error: any) {
    console.error('[Communication Delivery] Delivery attempt failed:', error?.message || error);
    return false;
  }
}
