import express from 'express';
import { SettingsRepository } from '../db/repositories/SettingsRepository.js';
import { requireAdmin } from '../auth/authManager.js';
import { Database } from '../db/database.js';

const router = express.Router();

// GET /api/settings/landing
router.get('/landing', async (req, res) => {
  try {
    const config = await SettingsRepository.getLandingConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings/landing (Protected)
router.put('/landing', requireAdmin, async (req, res) => {
  try {
    const saved = await SettingsRepository.saveLandingConfig(req.body);
    Database.addAuditLog({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Super Admin',
      action: 'Updated Landing Page Configuration',
      target: 'Landing Sections & Promotional Cards',
      status: 'Success'
    });
    res.json({ success: true, message: 'Landing page configuration saved successfully', config: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/settings/campaigns
router.get('/campaigns', async (req, res) => {
  try {
    const config = await SettingsRepository.getCampaignConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings/campaigns (Protected)
router.put('/campaigns', requireAdmin, async (req, res) => {
  try {
    const saved = await SettingsRepository.saveCampaignConfig(req.body);
    Database.addAuditLog({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Super Admin',
      action: 'Updated Promotional Campaign & Discount Cards',
      target: 'Promo Banners & Job Fee Settings',
      status: 'Success'
    });
    res.json({ success: true, message: 'Campaign configuration saved successfully', config: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/settings/whatsapp
router.get('/whatsapp', async (req, res) => {
  try {
    const config = await SettingsRepository.getWhatsAppConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings/whatsapp (Protected)
router.put('/whatsapp', requireAdmin, async (req, res) => {
  try {
    const saved = await SettingsRepository.saveWhatsAppConfig(req.body);
    Database.addAuditLog({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Super Admin',
      action: 'Updated WhatsApp Support Configuration',
      target: 'WhatsApp Floating Sticky Widget',
      status: 'Success'
    });
    res.json({ success: true, message: 'WhatsApp support configuration saved successfully', config: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/settings/seo
router.get('/seo', async (req, res) => {
  try {
    const config = await SettingsRepository.getSeoConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings/seo (Protected)
router.put('/seo', requireAdmin, async (req, res) => {
  try {
    const saved = await SettingsRepository.saveSeoConfig(req.body);
    Database.addAuditLog({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Super Admin',
      action: 'Updated Site Branding & SEO Configuration',
      target: 'Meta Tags, OpenGraph & Analytics Telemetry',
      status: 'Success'
    });
    res.json({ success: true, message: 'SEO configuration saved successfully', config: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/settings/communication (Protected Admin Only - Secrets Masked)
router.get('/communication', requireAdmin, async (req, res) => {
  try {
    const config = await SettingsRepository.getCommConfig();
    const mask = '••••••••';
    const safeConfig = {
      ...config,
      smtpPassword: config.smtpPassword ? mask : '',
      sendgridApiKey: config.sendgridApiKey ? mask : '',
      resendApiKey: config.resendApiKey ? mask : '',
      whatsappCloudApiToken: config.whatsappCloudApiToken ? mask : '',
      twilioAuthToken: config.twilioAuthToken ? mask : ''
    };
    res.json({ success: true, config: safeConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings/communication (Protected Admin Only)
router.put('/communication', requireAdmin, async (req, res) => {
  try {
    const saved = await SettingsRepository.saveCommConfig(req.body);
    Database.addAuditLog({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Super Admin',
      action: 'Updated Communication Provider Credentials',
      target: 'SMTP, WhatsApp Cloud API & Twilio Gateways',
      status: 'Success'
    });
    const mask = '••••••••';
    const safeConfig = {
      ...saved,
      smtpPassword: saved.smtpPassword ? mask : '',
      sendgridApiKey: saved.sendgridApiKey ? mask : '',
      resendApiKey: saved.resendApiKey ? mask : '',
      whatsappCloudApiToken: saved.whatsappCloudApiToken ? mask : '',
      twilioAuthToken: saved.twilioAuthToken ? mask : ''
    };
    res.json({ success: true, message: 'Communication provider credentials updated successfully', config: safeConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
