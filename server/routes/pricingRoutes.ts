import { Router } from 'express';
import { PricingRepository, AuditRepository } from '../db/repositories';
import { requireAdmin } from '../auth/authManager';

export const pricingRouter = Router();

// 1. Get Complete Dynamic Pricing Configuration
pricingRouter.get('/', (req, res) => {
  try {
    const pricing = PricingRepository.get();
    res.json({ success: true, pricing });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching pricing' });
  }
});

// 2. Calculate Job Posting Price Server-Side (Authoritative)
pricingRouter.post('/calculate-job', (req, res) => {
  try {
    const calculation = PricingRepository.calculateJobPostingPrice(req.body);
    res.json({ success: true, calculation });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error calculating job price' });
  }
});

// 3. Calculate Advertisement Price Server-Side (Authoritative)
pricingRouter.post('/calculate-ad', (req, res) => {
  try {
    const calculation = PricingRepository.calculateAdPrice(req.body);
    res.json({ success: true, calculation });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error calculating ad price' });
  }
});

// 4. Update Dynamic Pricing Configuration (Admin Only)
pricingRouter.put('/', requireAdmin, (req, res) => {
  try {
    const updated = PricingRepository.update(req.body);

    AuditRepository.add({
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
