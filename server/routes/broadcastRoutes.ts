import express from 'express';
import { BroadcastRepository } from '../db/repositories/BroadcastRepository';
import { requireAdminPermission } from '../auth/authManager';
import { isMongoConfigured } from '../db/mongodb';

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
