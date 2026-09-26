import { Router } from 'express';
import { AdRepository, AuditRepository } from '../db/repositories';
import { requireAdminPermission, requireAuth, authMiddleware } from '../auth/authManager';

export const adRouter = Router();

// 1. Get Ads (Public active ads or all for admin)
adRouter.get('/', async (req, res) => {
  try {
    const { status, placement } = req.query as Record<string, string>;
    const ads = await AdRepository.getAllAsync({ status, placement });
    res.json({ success: true, advertisements: ads });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching advertisements' });
  }
});

// 2. Create Advertisement
adRouter.post('/', requireAuth, async (req: any, res) => {
  try {
    const adData = req.body;
    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';

    // Strictly enforce advertiser identity and pending moderation status for non-admin users
    if (!isAdmin) {
      adData.submittedByUserId = req.user.userId || req.user.id;
      adData.submittedByUserName = req.user.name || adData.submittedByUserName;
      adData.submittedByUserEmail = req.user.email || adData.submittedByUserEmail;
      adData.status = 'pending';
    }

    const newAd = await AdRepository.createAsync(adData);

    AuditRepository.add({
      user: adData.submittedByUserName || adData.clientName || 'Advertiser',
      role: 'Advertiser',
      action: 'Ad Campaign Created',
      target: newAd.title,
      status: 'Success'
    });

    res.status(201).json({ success: true, advertisement: newAd });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating advertisement' });
  }
});

// 3. Update Advertisement
adRouter.put('/:id', requireAdminPermission('advertisements.manage'), async (req, res) => {
  try {
    const updated = await AdRepository.updateAsync(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }

    res.json({ success: true, advertisement: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating advertisement' });
  }
});

// 4. Delete Advertisement
adRouter.delete('/:id', requireAdminPermission('advertisements.manage'), async (req, res) => {
  try {
    const deleted = await AdRepository.deleteAsync(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }
    res.json({ success: true, message: 'Advertisement deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error deleting advertisement' });
  }
});

// 5. Track Click (Server-authoritative CPC billing against advertiser wallet)
adRouter.post('/:id/click', authMiddleware, async (req: any, res) => {
  try {
    const idempotencyKey = req.body?.idempotencyKey || (req.headers['x-idempotency-key'] as string);
    const updated = await AdRepository.trackClickAsync(req.params.id, {
      idempotencyKey,
      authUser: req.user
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ad campaign not found' });
    }
    res.json({ success: true, advertisement: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to record ad click' });
  }
});

// 6. Track Impression (Server-authoritative CPM billing against advertiser wallet)
adRouter.post('/:id/impression', authMiddleware, async (req: any, res) => {
  try {
    const idempotencyKey = req.body?.idempotencyKey || (req.headers['x-idempotency-key'] as string);
    const updated = await AdRepository.trackImpressionAsync(req.params.id, {
      idempotencyKey,
      authUser: req.user
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ad campaign not found' });
    }
    res.json({ success: true, advertisement: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to record ad impression' });
  }
});
