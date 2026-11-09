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
    
    // Validation
    if (!['Verified', 'Rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status transition' });
    
    const updateData: any = { status };
    if (status === 'Verified') {
      if (!['Standard Verified', 'Top Employer', 'Government Agency'].includes(badgeLevel)) 
        return res.status(400).json({ success: false, message: 'Invalid badge level' });
      updateData.badgeLevel = badgeLevel;
      updateData.verifiedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const adminEmail = (req as any).user?.email;
      if (!adminEmail) return res.status(401).json({ success: false, message: 'Admin identity unavailable' });
      updateData.verifiedBy = adminEmail;
    } else if (status === 'Rejected') {
      if (!rejectionReason || rejectionReason.trim() === '') 
        return res.status(400).json({ success: false, message: 'Rejection reason required' });
      updateData.rejectionReason = rejectionReason.trim();
    }

    const updated = await KycRepository.updateRequest(req.params.id, updateData);
    if (!updated) return res.status(409).json({ success: false, message: 'Request finalized or not found' });
    
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
