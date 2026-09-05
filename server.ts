import express from 'express';
import path from 'path';
import cron from 'node-cron';
import { createServer as createViteServer } from 'vite';

import { Database } from './server/db/database';
import { authMiddleware } from './server/auth/authManager';
import { authRouter } from './server/routes/authRoutes';
import { jobRouter } from './server/routes/jobRoutes';
import { applicationRouter } from './server/routes/applicationRoutes';
import { pricingRouter } from './server/routes/pricingRoutes';
import { applySettingsRouter } from './server/routes/applySettingsRoutes';
import { scraperRouter } from './server/routes/scraperRoutes';
import { seoRouter } from './server/routes/seoRoutes';
import { transactionRouter } from './server/routes/transactionRoutes';
import { userRouter } from './server/routes/userRoutes';
import { adRouter } from './server/routes/adRoutes';
import { auditRouter } from './server/routes/auditRoutes';
import { scrapeTargetPortal } from './src/services/scraperService';
import { AdminFeatureFlags } from './src/types/job';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Basic security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Global authentication & dev passkey inspection middleware
  app.use(authMiddleware);

  // Global Feature Flags controlled by Administrator
  let featureFlags: AdminFeatureFlags = {
    enableWebScraper: true,
    enableUniversalKeywordlessScraper: true,
    enableNewspaperClippings: true,
    enableScraperAutoApprove: false,
    enableGovtJobsPortal: true,
    enablePostingFeePaywall: true,
    enableCvBuilderPaywall: true,
    enableLiveSupportChat: true,
    deduplicationEnabled: true,
  };

  // API Route: Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Hybrid Job & CV Portal API', uptime: process.uptime() });
  });

  // API Route: Feature Flags (Backward Compatible)
  app.get('/api/admin/feature-flags', (req, res) => {
    res.json(featureFlags);
  });

  app.post('/api/admin/feature-flags', (req, res) => {
    featureFlags = { ...featureFlags, ...req.body };
    Database.addAuditLog({
      user: 'Administrator',
      role: 'Admin',
      action: 'Feature Flags Updated',
      target: 'System Configuration',
      status: 'Success'
    });
    res.json({ success: true, featureFlags });
  });

  // Dynamic Sitemap & Robots.txt at Root & /api/
  app.get('/sitemap.xml', (req, res) => {
    res.redirect('/api/seo/sitemap.xml');
  });
  app.get('/robots.txt', (req, res) => {
    res.redirect('/api/seo/robots.txt');
  });

  // Mount Modular Production REST API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/jobs', jobRouter);
  app.use('/api/applications', applicationRouter);
  app.use('/api/pricing', pricingRouter);
  app.use('/api/apply-settings', applySettingsRouter);
  app.use('/api/scraper', scraperRouter);
  app.use('/api/seo', seoRouter);
  app.use('/api/transactions', transactionRouter);
  app.use('/api/users', userRouter);
  app.use('/api/ads', adRouter);
  app.use('/api/audit-logs', auditRouter);

  // Schedule background cron task running every 30 mins
  cron.schedule('*/30 * * * *', async () => {
    if (!featureFlags.enableWebScraper) return;

    const timestamp = new Date().toISOString();
    console.log(`[Cron Scheduler Engine] Running scheduled scrape cycle at ${timestamp}...`);

    const sources = Database.getScraperSources();
    for (const config of sources) {
      if (config.status === 'Active Scheduled') {
        try {
          const results = await scrapeTargetPortal(config);
          config.lastRun = timestamp.substring(0, 16);
          config.scrapedCount = (config.scrapedCount || 0) + results.length;

          // Save results to pending or live
          for (const raw of results) {
            const jobData = {
              ...raw,
              id: `cron-${config.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
              scraperSourceId: config.id,
              scraperSourceName: config.name,
              scrapedAt: timestamp,
              salary: raw.salary || 'Salary not disclosed'
            };

            if (config.autoApprove) {
              Database.addJob(jobData);
            } else {
              Database.addPendingJob(jobData);
            }
          }
        } catch (err) {
          console.error(`[Cron Error] Failed processing ${config.name}:`, err);
        }
      }
    }
    Database.saveScraperSources(sources);
  });

  // Global Error Handler for API
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[API Server Error]', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ success: false, message: 'Internal server error occurred.' });
  });

  // Vite Middleware in Development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Hybrid Job & CV Portal production server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
