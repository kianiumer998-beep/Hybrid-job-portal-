import express from 'express';
import { BroadcastRepository, FeatureFlagsRepository } from '../db/repositories';
import { requireAdminPermission } from '../auth/authManager';
import { isMongoConfigured } from '../db/mongodb';
import { BroadcastRecipientRepository } from '../db/repositories/BroadcastRecipientRepository';

export const broadcastRouter = express.Router();

// GET /api/broadcasts - Fetch all broadcast campaigns (Admin only)
broadcastRouter.get('/', requireAdminPermission('settings.manage'), async (req, res) => {
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
    const { title, channel, targetAudience, subject, messageBody, categoryFilter, recipientsCount } = req.body;

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

    if (cleanChannel === 'SMS' && flags.enableSmsAlerts !== true) return res.status(403).json({ success: false, message: 'Channel Disabled: SMS broadcasts are currently disabled by administrator.' });

    if (cleanChannel === 'Multi-Channel' && (!flags.enableEmailAlerts || !flags.enableWhatsAppAlerts)) {
      return res.status(403).json({
        success: false,
        message: 'Channel Disabled: Multi-Channel broadcast creation requires all included channels (Email & WhatsApp) to be enabled.'
      });
    }

    // Fix B: Ignore any client-supplied ID during normal campaign creation.
    // Server generates unique ID.
    const created = await BroadcastRepository.createCampaign({
      title,
      channel,
      targetAudience,
      subject,
      messageBody,
      categoryFilter,
      recipientsCount
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


// Recipient-level delivery ledger. Delivery statuses are written only by a real provider integration.
broadcastRouter.get('/:campaignId/recipients', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 50);
    const result = await BroadcastRecipientRepository.list(campaign.id, page, pageSize);
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

// Retry only resets failed records to a provider-waiting state; it does not send messages.
broadcastRouter.post('/:campaignId/retry-failed', requireAdminPermission('settings.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const campaign = await BroadcastRepository.getById(String(req.params.campaignId || ''));
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const result = await BroadcastRecipientRepository.retryFailed(campaign.id);
    res.json({ success: true, ...result, message: 'Failed recipients reset to WaitingForProvider. No message was sent because provider integration is not configured.' });
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
