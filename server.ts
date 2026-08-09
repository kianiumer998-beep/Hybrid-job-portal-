import express from 'express';
import path from 'path';
import cron from 'node-cron';
import { createServer as createViteServer } from 'vite';
import { scrapeTargetPortal, judgeAndClassifyJob, ScraperTargetConfig } from './src/services/scraperService';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

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
      scrapedCount: 14
    },
    {
      id: 'sc-2',
      name: 'LinkedIn Global Remote Portal',
      url: 'https://www.linkedin.com/jobs/search?keywords=remote+developer',
      keywords: 'Senior Frontend, AI Engineer, DevOps',
      interval: '6h',
      autoApprove: true,
      status: 'Active Scheduled',
      lastRun: new Date().toISOString().replace('T', ' ').substring(0, 16),
      scrapedCount: 32
    }
  ];

  let scraperLogs: string[] = [
    `[${new Date().toISOString()}] Automated Scraper & Cron Scheduler Engine initialized successfully on port ${PORT}.`
  ];

  // API Route: Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Hybrid Job & CV Portal API', uptime: process.uptime() });
  });

  // API Route: Get Scraper Configs & Logs
  app.get('/api/scraper/configs', (req, res) => {
    res.json({ configs: activeScrapers, logs: scraperLogs });
  });

  // API Route: Trigger Scraper Execution
  app.post('/api/scraper/run', async (req, res) => {
    const { sourceId, url, keywords, autoApprove } = req.body;

    const targetConfig: ScraperTargetConfig = sourceId
      ? (activeScrapers.find(s => s.id === sourceId) || {
          id: 'temp-' + Date.now(),
          name: 'Custom Target',
          url: url || 'https://rozee.pk',
          keywords: keywords || 'Software Engineer',
          interval: '1h',
          autoApprove: !!autoApprove,
          status: 'Active Scheduled',
          scrapedCount: 0
        })
      : {
          id: 'temp-' + Date.now(),
          name: 'Manual Scraper Execution',
          url: url || 'https://rozee.pk',
          keywords: keywords || 'Full Stack, React, Node.js',
          interval: '1h',
          autoApprove: !!autoApprove,
          status: 'Active Scheduled',
          scrapedCount: 0
        };

    const jobs = await scrapeTargetPortal(targetConfig);
    const logEntry = `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] Manual/API Scrape executed for "${targetConfig.name}". Harvested ${jobs.length} jobs (${targetConfig.autoApprove ? 'Auto-Approved Live' : 'Sent to Pending'}).`;
    scraperLogs.unshift(logEntry);

    res.json({ success: true, message: logEntry, jobsHarvested: jobs });
  });

  // Schedule node-cron task running hourly ('0 * * * *')
  // For testing and demo purposes, cron ticks every 30 minutes ('*/30 * * * *')
  cron.schedule('*/30 * * * *', async () => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[Cron Scheduler Engine] Triggering scheduled scraping cycle at ${timestamp}...`);

    for (const config of activeScrapers) {
      if (config.status === 'Active Scheduled') {
        try {
          const results = await scrapeTargetPortal(config);
          config.lastRun = timestamp.substring(0, 16);
          config.scrapedCount += results.length;

          const logMsg = `[${timestamp}] Cron Triggered: "${config.name}". Successfully processed ${results.length} jobs. Status: ${config.autoApprove ? 'Published Live' : 'Queued in Pending'}.`;
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
