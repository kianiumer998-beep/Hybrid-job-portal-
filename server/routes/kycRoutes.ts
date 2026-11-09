import express from 'express';
import { KycRepository } from '../db/repositories/KycRepository';
import { requireAdminPermission } from '../auth/authManager';
import { isMongoConfigured } from '../db/mongodb';

export const kycRouter = express.Router();

kycRouter.get('/requests', requireAdminPermission('users.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const requests = await KycRepository.getAll();
    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

kycRouter.patch('/requests/:id', requireAdminPermission('users.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const { status, rejectionReason, badgeLevel } = req.body;
    
    // Server-side validation
    const updateData: any = { status };
    if (status === 'Verified') {
      if (!badgeLevel) return res.status(400).json({ success: false, message: 'Missing badge level' });
      updateData.badgeLevel = badgeLevel;
      updateData.verifiedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      // NOTE: Should ideally get admin identity from authenticated user context, 
      // but keeping it simple based on existing frontend mock logic
      updateData.verifiedBy = 'Admin (Master)'; 
    } else if (status === 'Rejected') {
      if (!rejectionReason) return res.status(400).json({ success: false, message: 'Missing rejection reason' });
      updateData.rejectionReason = rejectionReason;
    }

    const updated = await KycRepository.updateRequest(req.params.id, updateData);
    if (!updated) return res.status(404).json({ success: false, message: 'Request not found' });
    
    res.json({ success: true, request: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

kycRouter.post('/requests/import', requireAdminPermission('users.manage'), async (req, res) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const { requests } = req.body;
    if (!Array.isArray(requests)) return res.status(400).json({ success: false, message: 'Invalid format' });
    
    const result = await KycRepository.importLegacyRequests(requests);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
