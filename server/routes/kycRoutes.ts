import express from 'express';
import { KycRepository } from '../db/repositories/KycRepository';
import { requireAdminPermission, requireAuth } from '../auth/authManager';
import { isMongoConfigured } from '../db/mongodb';
import { EmployerKycRequest } from '../../src/types/adminSuite';

export const kycRouter = express.Router();

// GET /api/kyc/my-request — Employer fetches their active/latest KYC request
kycRouter.get('/my-request', requireAuth, async (req: any, res: any) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const request = await KycRepository.getByUserId(userId);
    res.json({ success: true, request });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/kyc/requests — Employer submits a new KYC request
kycRouter.post('/requests', requireAuth, async (req: any, res: any) => {
  if (!isMongoConfigured()) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    if (user.role !== 'Employer/Job Poster') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only employers can submit KYC verification requests.'
      });
    }

    const userId = user.userId || user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid authenticated user identity' });

    const { companyName, contactPerson, phone, ntnOrTaxNumber, companyWebsite, secpRegistrationNumber, officialDocUrl } = req.body;

    // Validate required string fields
    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return res.status(400).json({ success: false, message: 'Validation Error: "companyName" is required.' });
    }
    if (!contactPerson || typeof contactPerson !== 'string' || !contactPerson.trim()) {
      return res.status(400).json({ success: false, message: 'Validation Error: "contactPerson" is required.' });
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Validation Error: "phone" is required.' });
    }
    if (!ntnOrTaxNumber || typeof ntnOrTaxNumber !== 'string' || !ntnOrTaxNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Validation Error: "ntnOrTaxNumber" is required.' });
    }
    if (!companyWebsite || typeof companyWebsite !== 'string' || !companyWebsite.trim()) {
      return res.status(400).json({ success: false, message: 'Validation Error: "companyWebsite" is required.' });
    }

    const email = (user.email && typeof user.email === 'string' && user.email.trim())
      ? user.email.trim()
      : (typeof req.body.email === 'string' && req.body.email.trim() ? req.body.email.trim() : '');

    if (!email) {
      return res.status(400).json({ success: false, message: 'Validation Error: User email is required.' });
    }

    const newReq: EmployerKycRequest = {
      id: `kyc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email,
      phone: phone.trim(),
      ntnOrTaxNumber: ntnOrTaxNumber.trim(),
      companyWebsite: companyWebsite.trim(),
      submittedAt: new Date().toISOString(),
      status: 'Pending',
      badgeLevel: 'Standard Verified'
    };

    if (secpRegistrationNumber && typeof secpRegistrationNumber === 'string' && secpRegistrationNumber.trim()) {
      newReq.secpRegistrationNumber = secpRegistrationNumber.trim();
    }
    if (officialDocUrl && typeof officialDocUrl === 'string' && officialDocUrl.trim()) {
      newReq.officialDocUrl = officialDocUrl.trim();
    }

    const created = await KycRepository.createRequest(newReq);
    res.status(201).json({ success: true, request: created });
  } catch (err: any) {
    if (err.message && err.message.includes('Duplicate Request Error')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

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
