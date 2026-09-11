import express from 'express';
import path from 'path';
import { initScraperScheduler } from './server/services/scraperScheduler';
import { featureFlags, updateFeatureFlags } from './server/config/featureFlags';
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

  // CORS Middleware for cross-origin frontend -> backend connectivity (Vercel, localhost, Cloud Run)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      let isAllowed = false;
      try {
        const originUrl = new URL(origin);
        const host = originUrl.hostname.toLowerCase();
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '0.0.0.0' ||
          host.endsWith('.vercel.app') ||
          host.endsWith('.run.app') ||
          host.endsWith('.onrender.com') ||
          (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin)) ||
          (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.split(',').map(s => s.trim()).includes(origin))
        ) {
          isAllowed = true;
        }
      } catch {
        // In case origin is not a standard URL string
        if (origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.endsWith('.onrender.com')) {
          isAllowed = true;
        }
      }

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Admin-Dev-Passkey');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight OPTIONS requests immediately
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  });

  // Strict Cache-Control for all /api/* routes (Prevent CDN/browser caching of real-time job and auth data)
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Global authentication & dev passkey inspection middleware
  app.use(authMiddleware);

  // API Route: Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Hybrid Job & CV Portal API', uptime: process.uptime() });
  });

  // API Route: Feature Flags (Backward Compatible)
  app.get('/api/admin/feature-flags', (req, res) => {
    res.json(featureFlags);
  });

  app.post('/api/admin/feature-flags', (req, res) => {
    const updated = updateFeatureFlags(req.body);
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

  // Initialize dynamic interval-aware scraper scheduler
  initScraperScheduler();

  // Catch-all 404 handler for unhandled /api/* routes so they NEVER return HTML / index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
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
