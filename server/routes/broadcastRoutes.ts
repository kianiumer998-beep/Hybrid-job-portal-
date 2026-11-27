import express from 'express';
import { BroadcastRepository, FeatureFlagsRepository, UserRepository } from '../db/repositories';
import { SubscriberRepository } from '../db/repositories/SubscriberRepository';
import { requireAdminPermission } from '../auth/authManager';
import { isMongoConfigured } from '../db/mongodb';
import { BroadcastRecipientRepository, BroadcastRecipientStatus } from '../db/repositories/BroadcastRecipientRepository';
import { BroadcastScheduleRepository } from '../db/repositories/BroadcastScheduleRepository';
import {
  deliverChannelMessageWithDetails,
  getCommunicationChannelReadiness
} from '../services/communicationDeliveryService';

export const broadcastRouter = express.Router();

type ChannelName = 'Email' | 'WhatsApp' | 'SMS';

function maskEmail(email: string): string {
  const clean = email.trim();
  const parts = clean.split('@');
  if (parts.length !== 2) return 'email';
  return parts[0].slice(0, 2) + '***@' + parts[1];
}

function maskPhone(phone: string): string {
  const clean = phone.trim();
  return clean.length > 4 ? '***' + clean.slice(-4) : 'phone';
}

function matchesAudienceUser(user: any, targetAudience: string): boolean {
  const role = String(user?.role || '').toLowerCase();
  switch (targetAudience) {
    case 'Job Seekers Only':
      return !role.includes('employer') && !user?.companyName;
    case 'Employers / Posters':
      return role.includes('employer') || Boolean(user?.companyName);
    case 'Unpaid / Expired Users':
      return user?.plan === 'Free' || user?.membershipStatus === 'Expired';
    case 'Government Job Seekers':
      return Array.isArray(user?.skills) && user.skills.some((s: any) => /govt|bps/i.test(String(s || '')));
    case 'Overseas / Gulf Candidates':
      return Boolean(user?.address) && /gulf|dubai|uk|saudi|uae/i.test(String(user.address));
    case 'Subscribed Members':
      return false;
    default:
      return true;
  }
}

function matchesAudienceSubscriber(sub: any, targetAudience: string): boolean {
  if (targetAudience === 'Subscribed Members') {
    return sub?.status === 'Active' || sub?.status === 'Expiring Soon';
  }
  if (targetAudience === 'All Users') return true;
  if (targetAudience === 'Unpaid / Expired Users') {
    return sub?.status === 'Expired' || sub?.status === 'Pending';
  }
  return false;
}

// GET /api/broadcasts/channel-readiness - Check flags + encrypted provider gateway configuration
broadcastRouter.get('/channel-readiness', requireAdminPermission('settings.manage'), async (_req, res) => {
  try {
    const [flags, channels] = await Promise.all([
      FeatureFlagsRepository.getFlags(),
      getCommunicationChannelReadiness()
    ]);
    res.json({ success: true, flags, channels });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to check channel readiness' });
  }
});

// GET /api/broadcasts - Fetch all broadcast campaigns (Admin only)
broadcastRouter.get('/', requireAdminPermission('settings.manage'), async (_req, res) => {
  if (!isMongoConfigured()) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  try {
    const campaigns = await BroadcastRepository.getAll();
    res.json({ success: true, campaigns });
  } catch (err: any) {
    console.error('[BroadcastRoutes] Failed to fetch campaigns:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch broadcast campaigns' });
  }
});

// POST /api/broadcasts - Create a new broadcast campaign draft (Admin only)
broadcastRouter.post('/', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  try {
    const { title, channel, targetAudience, subject, messageBody, categoryFilter, recipientsCount, linkedAdId } = req.body;

    // Check authoritative backend feature flags
    const flags = await FeatureFlagsRepository.getFlags();
    const cleanChannel = String(channel || '').trim();

    if (cleanChannel === 'Email' && !flags.enableEmailAlerts) {
      return res.status(403).json({
        success: false,
        message: 'Channel Disabled: Email broadcast campaigns are currently disabled by administrator.'
      });
    }

    if (cleanChannel === 'WhatsApp' && !flags.enableWhatsAppAlerts) {
      return res.status(403).json({
        success: false,
        message: 'Channel Disabled: WhatsApp broadcast campaigns are currently disabled by administrator.'
      });
    }

    if (cleanChannel === 'SMS' && flags.enableSmsAlerts !== true) {
      return res.status(403).json({
        success: false,
        message: 'Channel Disabled: SMS broadcasts are currently disabled by administrator.'
      });
    }

    if (cleanChannel === 'Multi-Channel') {
      const enabledCount = [
        flags.enableEmailAlerts === true,
        flags.enableWhatsAppAlerts === true,
        flags.enableSmsAlerts === true
      ].filter(Boolean).length;
      if (enabledCount === 0) {
        return res.status(403).json({
          success: false,
          message: 'Channel Disabled: Multi-Channel broadcast requires at least one alert channel (Email, WhatsApp, or SMS) enabled.'
        });
      }
    }

    const created = await BroadcastRepository.createCampaign({
      title,
      channel,
      targetAudience,
      subject,
      messageBody,
      categoryFilter,
      recipientsCount,
      linkedAdId
    });

    res.status(201).json({ success: true, campaign: created });
  } catch (err: any) {
    if (err?.message?.includes('Duplicate Campaign Error') || err?.code === 11000) {
      return res.status(409).json({ success: false, message: err.message || 'Duplicate campaign ID conflict' });
    }
    if (err?.message?.includes('Validation Error')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('[BroadcastRoutes] Failed to create campaign:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to create broadcast campaign' });
  }
});

// Admin schedule management.
broadcastRouter.get('/schedules', requireAdminPermission('settings.manage'), async (_req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const [schedules, readiness] = await Promise.all([
      BroadcastScheduleRepository.list(),
      getCommunicationChannelReadiness()
    ]);
    const anyReady = readiness.email.ready || readiness.whatsapp.ready || readiness.sms.ready;
    res.json({ success: true, schedules, dispatchEnabled: anyReady, readiness });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Could not load schedules' });
  }
});

broadcastRouter.post('/:campaignId/schedule', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    if (campaign.status !== 'Draft' && campaign.status !== 'Scheduled') {
      return res.status(409).json({ success: false, message: 'Only Draft or Scheduled campaigns can be scheduled.' });
    }
    const [schedule, readiness] = await Promise.all([
      BroadcastScheduleRepository.schedule(campaign.id, String(req.body?.scheduledAt || ''), String(req.body?.timezone || 'Asia/Karachi')),
      getCommunicationChannelReadiness()
    ]);
    await BroadcastRepository.setCampaignStatus(campaign.id, 'Scheduled', schedule.scheduledAt);
    const anyReady = readiness.email.ready || readiness.whatsapp.ready || readiness.sms.ready;
    res.status(201).json({
      success: true,
      schedule,
      dispatchEnabled: anyReady,
      message: anyReady
        ? 'Schedule saved. You can also dispatch immediately from the Compose or Recipient Tracking tab.'
        : 'Schedule saved. Configure at least one gateway API key before dispatching.'
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Could not save campaign schedule' });
  }
});

broadcastRouter.patch('/:campaignId/schedule-state', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const state = req.body?.state;
    if (!['Paused', 'Cancelled', 'WaitingForProvider'].includes(state)) return res.status(400).json({ success: false, message: 'Invalid schedule state.' });
    const result = await BroadcastScheduleRepository.updateState(campaign.id, state);
    if (state === 'Cancelled') await BroadcastRepository.setCampaignStatus(campaign.id, 'Draft', null);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Could not update schedule' });
  }
});

// Recipient-level delivery ledger.
broadcastRouter.post('/:campaignId/prepare-recipients', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const flags = await FeatureFlagsRepository.getFlags();
    const allowedChannels: ChannelName[] =
      campaign.channel === 'Email' ? ['Email'] :
      campaign.channel === 'WhatsApp' ? ['WhatsApp'] :
      campaign.channel === 'SMS' ? ['SMS'] :
      campaign.channel === 'Multi-Channel' ? ['Email', 'WhatsApp', 'SMS'] : [];
    if (!allowedChannels.length) return res.status(400).json({ success: false, message: 'This campaign channel cannot create recipient delivery records.' });
    const enabledChannels = allowedChannels.filter(ch =>
      ch === 'Email' ? flags.enableEmailAlerts === true :
      ch === 'WhatsApp' ? flags.enableWhatsAppAlerts === true :
      flags.enableSmsAlerts === true
    );
    const incoming = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const clean = incoming.filter((r: any) => r && typeof r.subscriberId === 'string' && allowedChannels.includes(r.channel) && enabledChannels.includes(r.channel));
    const result = await BroadcastRecipientRepository.prepare(campaign.id, clean);
    res.status(201).json({ success: true, ...result, enabledChannels, message: 'Recipients prepared. Ready for live provider dispatch.' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Could not prepare campaign recipients' });
  }
});

// POST /api/broadcasts/:campaignId/dispatch - Execute real provider deliveries & record Sent / Failed ledger
broadcastRouter.post('/:campaignId/dispatch', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });

  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const retryFailedOnly = Boolean(req.body?.retryFailedOnly);
    const requestedChannels: ChannelName[] | null = Array.isArray(req.body?.selectedChannels)
      ? req.body.selectedChannels.filter((c: any): c is ChannelName => ['Email', 'WhatsApp', 'SMS'].includes(c))
      : null;
    const batchLimit = Math.min(500, Math.max(1, Math.floor(Number(req.body?.limit) || 250)));

    const [flags, readiness, allUsers, allSubscribers] = await Promise.all([
      FeatureFlagsRepository.getFlags(),
      getCommunicationChannelReadiness(),
      UserRepository.getAllAsync(),
      SubscriberRepository.getAllSubscribers()
    ]);

    const campaignChannels: ChannelName[] =
      campaign.channel === 'Email'
        ? ['Email']
        : campaign.channel === 'WhatsApp'
        ? ['WhatsApp']
        : campaign.channel === 'SMS'
        ? ['SMS']
        : campaign.channel === 'Multi-Channel'
        ? (requestedChannels && requestedChannels.length > 0 ? requestedChannels : ['Email', 'WhatsApp', 'SMS'])
        : [];

    if (campaignChannels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Only Email, WhatsApp, SMS, and Multi-Channel campaigns can be dispatched through communication gateways.'
      });
    }

    const activeChannels = campaignChannels.filter((ch) =>
      ch === 'Email'
        ? flags.enableEmailAlerts === true
        : ch === 'WhatsApp'
        ? flags.enableWhatsAppAlerts === true
        : flags.enableSmsAlerts === true
    );

    if (activeChannels.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'All selected communication channels are currently disabled in Global Feature Switches.'
      });
    }

    // Resolve audience people map keyed by subscriber/user ID
    const personById = new Map<string, any>();
    const preparedRows: Array<{ subscriberId: string; recipientName?: string; channel: ChannelName; contactMask?: string }> = [];

    const addPerson = (person: any) => {
      const subscriberId = String(person?.id || '').trim();
      if (!subscriberId) return;
      if (!personById.has(subscriberId)) {
        personById.set(subscriberId, person);
      }
      const email = String(person?.email || '').trim();
      const phone = String(person?.phone || person?.phoneNumber || '').trim();
      const name = String(person?.name || '').trim();

      for (const ch of activeChannels) {
        if (ch === 'Email') {
          if (!email) continue;
          preparedRows.push({
            subscriberId,
            recipientName: name || email,
            channel: 'Email',
            contactMask: maskEmail(email)
          });
        } else if (ch === 'WhatsApp') {
          if (!phone) continue;
          preparedRows.push({
            subscriberId,
            recipientName: name || maskPhone(phone),
            channel: 'WhatsApp',
            contactMask: maskPhone(phone)
          });
        } else if (ch === 'SMS') {
          if (!phone) continue;
          preparedRows.push({
            subscriberId,
            recipientName: name || maskPhone(phone),
            channel: 'SMS',
            contactMask: maskPhone(phone)
          });
        }
      }
    };

    for (const u of allUsers) {
      if (matchesAudienceUser(u, campaign.targetAudience)) {
        addPerson(u);
      }
    }
    for (const s of allSubscribers) {
      if (matchesAudienceSubscriber(s, campaign.targetAudience)) {
        addPerson(s);
      }
    }

    // Prepare ledger entries if not already created
    if (preparedRows.length > 0 && !retryFailedOnly) {
      await BroadcastRecipientRepository.prepare(campaign.id, preparedRows.slice(0, 10000));
    }

    // Pull rows eligible for dispatch
    const queue = await BroadcastRecipientRepository.listForDispatch(campaign.id, retryFailedOnly, batchLimit);
    const channelQueue = queue.filter((row) => activeChannels.includes(row.channel));

    let sentCount = 0;
    let failedCount = 0;

    for (const row of channelQueue) {
      const person = personById.get(row.subscriberId);
      const displayName = String(person?.name || row.recipientName || 'Candidate').trim();
      const personalizedSubject = String(campaign.subject || campaign.title || 'Portal Update')
        .replace(/\{\{\s*candidate_name\s*\}\}/gi, displayName);
      const personalizedBody = String(campaign.messageBody || '')
        .replace(/\{\{\s*candidate_name\s*\}\}/gi, displayName);

      let result;
      if (!person) {
        result = {
          ok: false,
          provider: 'directory',
          error: 'Matching user/subscriber contact record no longer exists or lacks contact info.'
        };
      } else {
        const chLower = row.channel.toLowerCase() as 'email' | 'whatsapp' | 'sms';
        result = await deliverChannelMessageWithDetails(person, chLower, personalizedSubject, personalizedBody);
      }

      await BroadcastRecipientRepository.recordProviderOutcome({
        campaignId: campaign.id,
        subscriberId: row.subscriberId,
        channel: row.channel,
        outcome: result.ok ? 'Sent' : 'Failed',
        providerMessageId: result.messageId,
        failureReason: result.error
      });

      if (result.ok) sentCount++;
      else failedCount++;
    }

    const [summary, historyList] = await Promise.all([
      BroadcastRecipientRepository.summary(campaign.id),
      BroadcastRecipientRepository.list(campaign.id, 1, 100)
    ]);

    const totalSent = Number(summary.counts.Sent || 0) + Number(summary.counts.Delivered || 0);
    const totalFailed = Number(summary.counts.Failed || 0);
    const updatedCampaign = await BroadcastRepository.markCampaignDeliveryResult(campaign.id, {
      status: totalSent > 0 ? 'Sent' : totalFailed > 0 ? 'Failed' : campaign.status,
      sentAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      recipientsCount: summary.total || preparedRows.length,
      sentCount: totalSent,
      failedCount: totalFailed
    });

    res.json({
      success: true,
      processedCount: channelQueue.length,
      sentCount,
      failedCount,
      activeChannels,
      readiness,
      summary,
      items: historyList.items,
      total: historyList.total,
      campaign: updatedCampaign,
      message:
        channelQueue.length === 0
          ? 'No eligible pending or failed recipients matched active channels and audience.'
          : `Dispatch finished: ${sentCount} sent, ${failedCount} failed across ${activeChannels.join(', ')}.`
    });
  } catch (err: any) {
    console.error('[BroadcastRoutes] Dispatch failed:', err);
    res.status(500).json({ success: false, message: err?.message || 'Broadcast dispatch failed' });
  }
});

broadcastRouter.get('/:campaignId/recipients', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 50);
    const statusParam = String(req.query.status || 'ALL') as BroadcastRecipientStatus | 'ALL';
    const result = await BroadcastRecipientRepository.list(campaign.id, page, pageSize, statusParam);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Could not load recipient history' });
  }
});

broadcastRouter.get('/:campaignId/recipient-summary', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const summary = await BroadcastRecipientRepository.summary(campaign.id);
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Could not load recipient summary' });
  }
});

// Retry resets failed records and optionally invokes live dispatch
broadcastRouter.post('/:campaignId/retry-failed', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const result = await BroadcastRecipientRepository.retryFailed(campaign.id);
    res.json({ success: true, ...result, message: 'Failed recipients queued for retry dispatch.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Could not retry failed recipients' });
  }
});

// POST /api/broadcasts/import-legacy - Safely import valid user-created legacy campaigns (Admin only)
broadcastRouter.post('/import-legacy', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  try {
    const { campaigns } = req.body;
    if (!Array.isArray(campaigns)) {
      return res.status(400).json({ success: false, message: 'Validation Error: Expected an array of campaigns.' });
    }

    const result = await BroadcastRepository.importLegacyCampaigns(campaigns);
    res.json({ ...result });
  } catch (err: any) {
    if (err?.message?.includes('Validation Error')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('[BroadcastRoutes] Failed to import legacy campaigns:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to import legacy campaigns' });
  }
});
