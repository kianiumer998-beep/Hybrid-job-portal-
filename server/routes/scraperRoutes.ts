import { Router } from 'express';
import { Database } from '../db/database';
import { executeScraperWithWizard, ScraperRunOptions } from '../services/scraperEngine';
import { requireAdmin } from '../auth/authManager';

export const scraperRouter = Router();

// 1. Get Scraper Sources
scraperRouter.get('/configs', (req, res) => {
  try {
    const sources = Database.getScraperSources();
    res.json({ success: true, configs: sources });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching scraper configs' });
  }
});

// 2. Update Scraper Sources (Admin Only)
scraperRouter.put('/configs', requireAdmin, (req, res) => {
  try {
    Database.saveScraperSources(req.body);
    Database.addAuditLog({
      user: 'Administrator',
      role: 'Scraper Manager',
      action: 'Scraper Target Portals Updated',
      target: `${req.body.length || 0} Target Configurations`,
      status: 'Success'
    });
    res.json({ success: true, configs: req.body, message: 'Scraper target portals saved successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating scraper configs' });
  }
});

// 3. Trigger Scraper Run with 5 Wizard Modes
scraperRouter.post('/run', requireAdmin, async (req, res) => {
  try {
    const options: ScraperRunOptions = {
      mode: req.body.mode || 'complete',
      sourceId: req.body.sourceId,
      startPage: req.body.startPage ? parseInt(req.body.startPage, 10) : undefined,
      endPage: req.body.endPage ? parseInt(req.body.endPage, 10) : undefined,
      sinceTimestamp: req.body.sinceTimestamp,
      autoPublishTrusted: req.body.autoPublishTrusted
    };

    const result = await executeScraperWithWizard(options);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error executing scraper run' });
  }
});

// 4. Get Scraper Audit Runs History
scraperRouter.get('/runs', (req, res) => {
  try {
    const runs = Database.getScraperRuns();
    res.json({ success: true, runs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching scraper runs' });
  }
});
