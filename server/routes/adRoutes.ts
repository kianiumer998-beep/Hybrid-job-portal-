import { Router } from 'express';
import { AdRepository, AuditRepository } from '../db/repositories';
import { requireAdmin } from '../auth/authManager';

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
adRouter.post('/', (req, res) => {
  try {
    const adData = req.body;
    const newAd = AdRepository.create(adData);

    AuditRepository.add({
      user: adData.clientName || 'Advertiser',
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
adRouter.put('/:id', requireAdmin, (req, res) => {
  try {
    const updated = AdRepository.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }

    res.json({ success: true, advertisement: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating advertisement' });
  }
});

// 4. Delete Advertisement
adRouter.delete('/:id', requireAdmin, (req, res) => {
  const deleted = AdRepository.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Ad not found.' });
  }
  res.json({ success: true, message: 'Advertisement deleted.' });
});

// 5. Track Click
adRouter.post('/:id/click', (req, res) => {
  AdRepository.trackClick(req.params.id);
  res.json({ success: true });
});

// 6. Track Impression
adRouter.post('/:id/impression', (req, res) => {
  AdRepository.trackImpression(req.params.id);
  res.json({ success: true });
});

