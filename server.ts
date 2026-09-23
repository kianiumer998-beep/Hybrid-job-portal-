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
  // Port configuration:
  // - In AI Studio preview environment, an internal Nginx proxy listens on NGINX_PORT (8080) and forwards to DEFAULT_APP_PORT (3000).
  // - In cloud deployments (Render, Heroku, Cloud Run, AWS, Railway, etc.), NGINX_PORT is not set and the platform provides PORT.
  // - If environment provides a valid PORT without a local reverse proxy collision, honor it.
  const isAistudioProxy = Boolean(process.env.NGINX_PORT && process.env.PORT === process.env.NGINX_PORT);
  const PORT = (!isAistudioProxy && process.env.PORT)
    ? parseInt(process.env.PORT, 10)
    : parseInt(process.env.DEFAULT_APP_PORT || '3000', 10);

  // Basic security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Robust CORS headers to allow cross-origin requests from any browser, incognito window, or external domain
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Hybrid Job & CV Portal production server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server Error] Port ${PORT} is already in use (EADDRINUSE). A process is already listening on this port.`);
    } else {
      console.error('[Server Error]', err);
    }
  });
}

startServer();
