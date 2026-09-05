import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';

export const pricingRouter = Router();

// 1. Get Complete Dynamic Pricing Configuration
pricingRouter.get('/', (req, res) => {
  try {
    const pricing = Database.getPricing();
    res.json({ success: true, pricing });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching pricing' });
  }
});

// 2. Update Dynamic Pricing Configuration (Admin Only)
pricingRouter.put('/', requireAdmin, (req, res) => {
  try {
    const current = Database.getPricing();
    const updated = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    Database.savePricing(updated);

    Database.addAuditLog({
      user: 'Administrator',
      role: 'Finance Manager',
      action: 'Pricing Configuration Updated',
      target: 'Dynamic Job & Ad Pricing Matrix',
      status: 'Success'
    });

    res.json({ success: true, pricing: updated, message: 'Pricing configuration updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating pricing' });
  }
});
