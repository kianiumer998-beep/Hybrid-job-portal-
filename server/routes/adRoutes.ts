import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';

export const adRouter = Router();

// 1. Get Ads (Public active ads or all for admin)
adRouter.get('/', (req, res) => {
  try {
    const { status, placement } = req.query as Record<string, string>;
    let ads = Database.getAds();

    if (status) {
      ads = ads.filter(a => a.status === status);
    }
    if (placement) {
      ads = ads.filter(a => a.placement === placement);
    }

    res.json({ success: true, advertisements: ads });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching advertisements' });
  }
});

// 2. Create Advertisement
adRouter.post('/', (req, res) => {
  try {
    const adData = req.body;
    const ads = Database.getAds();
    const newAd = {
      ...adData,
      id: adData.id || `ad-${Date.now().toString(36)}`,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    };
    ads.unshift(newAd);
    Database.saveAds(ads);

    Database.addAuditLog({
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
    const ads = Database.getAds();
    const idx = ads.findIndex(a => a.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }

    ads[idx] = { ...ads[idx], ...req.body, updatedAt: new Date().toISOString() };
    Database.saveAds(ads);

    res.json({ success: true, advertisement: ads[idx] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating advertisement' });
  }
});

// 4. Delete Advertisement
adRouter.delete('/:id', requireAdmin, (req, res) => {
  const ads = Database.getAds();
  const filtered = ads.filter(a => a.id !== req.params.id);
  if (filtered.length === ads.length) {
    return res.status(404).json({ success: false, message: 'Ad not found.' });
  }
  Database.saveAds(filtered);
  res.json({ success: true, message: 'Advertisement deleted.' });
});

// 5. Track Click
adRouter.post('/:id/click', (req, res) => {
  const ads = Database.getAds();
  const idx = ads.findIndex(a => a.id === req.params.id);
  if (idx !== -1) {
    ads[idx].clicks = (ads[idx].clicks || 0) + 1;
    Database.saveAds(ads);
  }
  res.json({ success: true });
});

// 6. Track Impression
adRouter.post('/:id/impression', (req, res) => {
  const ads = Database.getAds();
  const idx = ads.findIndex(a => a.id === req.params.id);
  if (idx !== -1) {
    ads[idx].impressions = (ads[idx].impressions || 0) + 1;
    Database.saveAds(ads);
  }
  res.json({ success: true });
});
