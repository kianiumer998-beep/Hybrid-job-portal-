import express from 'express';
import path from 'path';
import cron from 'node-cron';
import { createServer as createViteServer } from 'vite';
import { scrapeTargetPortal, deduplicateJobs, ScraperTargetConfig } from './src/services/scraperService';
import { AdminFeatureFlags } from './src/types/job';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

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

  // In-memory Scraper Configurations Store
  let activeScrapers: ScraperTargetConfig[] = [
    {
      id: 'sc-1',
      name: 'Rozee.pk Pakistan Tech Jobs',
      url: 'https://www.rozee.pk/category/information-technology-jobs',
      keywords: 'React, Node.js, Full Stack, Lahore, Karachi, Islamabad',
      interval: '1h',
      autoApprove: false,
      status: 'Active Scheduled',
      lastRun: new Date().toISOString().replace('T', ' ').substring(0, 16),
      scrapedCount: 14,
      isUniversalKeywordless: false,
    },
    {
      id: 'sc-2',
      name: 'LinkedIn Global Remote Portal',
      url: 'https://www.linkedin.com/jobs/search?keywords=remote+developer',
      keywords: 'ALL',
      interval: '6h',
      autoApprove: true,
      status: 'Active Scheduled',
      lastRun: new Date().toISOString().replace('T', ' ').substring(0, 16),
      scrapedCount: 32,
      isUniversalKeywordless: true,
    },
    {
      id: 'sc-3',
      name: 'Federal Public Service Commission (FPSC Govt Portal)',
      url: 'https://www.fpsc.gov.pk/jobs',
      keywords: 'Federal, Assistant Director, Inspector, BPS-17, BPS-18',
      interval: '24h',
      autoApprove: true,
      status: 'Active Scheduled',
      lastRun: new Date().toISOString().replace('T', ' ').substring(0, 16),
      scrapedCount: 18,
      isGovtPortal: true,
    },
    {
      id: 'sc-4',
      name: 'Daily Jang Newspaper Classified Ad Clippings',
      url: 'https://jang.com.pk/category/jobs-classifieds',
      keywords: 'Classifieds, Accounts, Officers, Technicians',
      interval: '24h',
      autoApprove: false,
      status: 'Active Scheduled',
      lastRun: new Date().toISOString().replace('T', ' ').substring(0, 16),
      scrapedCount: 25,
      isNewspaperClippingPortal: true,
    },
    {
      id: 'sc-5',
      name: 'Gulf News UAE & Middle East Career Portal',
      url: 'https://gulfnews.com/classifieds/jobs',
      keywords: 'ALL',
      interval: '24h',
      autoApprove: true,
      status: 'Active Scheduled',
      lastRun: new Date().toISOString().replace('T', ' ').substring(0, 16),
      scrapedCount: 40,
      isUniversalKeywordless: true,
    }
  ];

  let scraperLogs: string[] = [
    `[${new Date().toISOString()}] Automated Scraper & Cron Scheduler Engine initialized successfully on port ${PORT}.`
  ];

  // API Route: Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Hybrid Job & CV Portal API', uptime: process.uptime() });
  });

  // API Route: Get & Update Feature Flags
  app.get('/api/admin/feature-flags', (req, res) => {
    res.json(featureFlags);
  });

  app.post('/api/admin/feature-flags', (req, res) => {
    featureFlags = { ...featureFlags, ...req.body };
    scraperLogs.unshift(`[${new Date().toISOString()}] Admin updated system feature control flags.`);
    res.json({ success: true, featureFlags });
  });

  // API Route: Get Scraper Configs & Logs
  app.get('/api/scraper/configs', (req, res) => {
    res.json({ configs: activeScrapers, logs: scraperLogs, featureFlags });
  });

  // API Route: Trigger Scraper Execution
  app.post('/api/scraper/run', async (req, res) => {
    if (!featureFlags.enableWebScraper) {
      return res.status(403).json({ success: false, message: 'Web Scraper module is currently disabled by Administrator.' });
    }

    const { sourceId, url, keywords, autoApprove, isUniversalKeywordless, isNewspaperClippingPortal, isGovtPortal, existingJobs } = req.body;

    const targetConfig: ScraperTargetConfig = sourceId
      ? (activeScrapers.find(s => s.id === sourceId) || {
          id: 'temp-' + Date.now(),
          name: 'Custom Target',
          url: url || 'https://rozee.pk',
          keywords: keywords || 'ALL',
          interval: '1h',
          autoApprove: !!autoApprove,
          status: 'Active Scheduled',
          scrapedCount: 0,
          isUniversalKeywordless: !!isUniversalKeywordless,
          isNewspaperClippingPortal: !!isNewspaperClippingPortal,
          isGovtPortal: !!isGovtPortal
        })
      : {
          id: 'temp-' + Date.now(),
          name: 'Manual Scraper Execution',
          url: url || 'https://rozee.pk',
          keywords: keywords || (featureFlags.enableUniversalKeywordlessScraper ? 'ALL' : 'Software Engineer'),
          interval: '1h',
          autoApprove: !!autoApprove,
          status: 'Active Scheduled',
          scrapedCount: 0,
          isUniversalKeywordless: featureFlags.enableUniversalKeywordlessScraper,
          isNewspaperClippingPortal: !!isNewspaperClippingPortal,
          isGovtPortal: !!isGovtPortal
        };

    let rawJobs = await scrapeTargetPortal(targetConfig);

    // Apply Deduplication Engine if enabled
    if (featureFlags.deduplicationEnabled && Array.isArray(existingJobs)) {
      rawJobs = deduplicateJobs(existingJobs, rawJobs);
    }

    const logEntry = `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] Scrape executed for "${targetConfig.name}". Harvested ${rawJobs.length} unique jobs (${targetConfig.autoApprove ? 'Auto-Approved Live' : 'Sent to Pending Queue'}).`;
    scraperLogs.unshift(logEntry);

    res.json({ success: true, message: logEntry, jobsHarvested: rawJobs });
  });

  // Schedule node-cron task running every 30 mins
  cron.schedule('*/30 * * * *', async () => {
    if (!featureFlags.enableWebScraper) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[Cron Scheduler Engine] Triggering scheduled scraping cycle at ${timestamp}...`);

    for (const config of activeScrapers) {
      if (config.status === 'Active Scheduled') {
        try {
          const results = await scrapeTargetPortal(config);
          config.lastRun = timestamp.substring(0, 16);
          config.scrapedCount += results.length;

          const logMsg = `[${timestamp}] Cron Triggered: "${config.name}". Harvested ${results.length} jobs. Status: ${config.autoApprove ? 'Published Live' : 'Queued in Pending'}.`;
          scraperLogs.unshift(logMsg);
          console.log(logMsg);
        } catch (err) {
          console.error(`[Cron Error] Failed processing ${config.name}:`, err);
        }
      }
    }
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
    console.log(`🚀 Hybrid Job & CV Portal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

