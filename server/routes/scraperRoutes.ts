import { Router } from 'express';
import { Database } from '../db/database';
import { executeScraperWithWizard, ScraperRunOptions } from '../services/scraperEngine';
import { requireAdmin } from '../auth/authManager';
import { ScraperRepository, AuditRepository } from '../db/repositories';
import { parsePdfFromUrl } from '../services/pdfParserEngine';
import { scrapeTargetPortal } from '../../src/services/scraperService';
import { validateSafeScrapeUrl } from '../utils/ssrfProtection';
import { getSchedulerStatus, runSchedulerTick } from '../services/scraperScheduler';
import { Job } from '../../src/types/job';

export const scraperRouter = Router();

// 1. Get Scraper Sources
scraperRouter.get('/configs', async (req, res) => {
  try {
    const sources = await ScraperRepository.getConfigs();
    res.json({ success: true, configs: sources });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching scraper configs' });
  }
});

// 2. Update Scraper Sources (Admin Only)
scraperRouter.put('/configs', requireAdmin, async (req, res) => {
  try {
    await ScraperRepository.saveConfigs(req.body);
    AuditRepository.add({
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

// 3. Scheduler Status & Diagnostics
scraperRouter.get('/scheduler-status', async (req, res) => {
  try {
    const status = await getSchedulerStatus();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Error getting scheduler status' });
  }
});

// 4. Trigger Scheduler Tick Manually (Admin Only)
scraperRouter.post('/scheduler-tick', requireAdmin, async (req, res) => {
  try {
    const tickResult = await runSchedulerTick();
    res.json({ success: true, ...tickResult });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Error executing scheduler tick' });
  }
});

// 5. Parse a specific URL or PDF document with 100% factual integrity (NO demo/synthetic jobs)
scraperRouter.post('/parse-url', requireAdmin, async (req, res) => {
  try {
    const { url, organization, title } = req.body;
    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return res.status(400).json({ success: false, message: 'Valid HTTP/HTTPS URL is required' });
    }

    const cleanUrl = url.trim();

    // SSRF Security Check
    const ssrfCheck = validateSafeScrapeUrl(cleanUrl);
    if (!ssrfCheck.safe) {
      return res.status(400).json({ success: false, message: `Access denied: ${ssrfCheck.error}` });
    }

    const isPdf = cleanUrl.toLowerCase().split('?')[0].endsWith('.pdf');

    if (isPdf) {
      const pdfResult = await parsePdfFromUrl(cleanUrl, organization);
      return res.json({
        success: pdfResult.success,
        jobs: pdfResult.extractedJobs,
        totalExtracted: pdfResult.extractedJobs.length,
        totalPages: pdfResult.totalPages,
        rawTextSample: pdfResult.rawTextSample,
        fileName: pdfResult.fileName,
        message: pdfResult.message
      });
    }

    // Web portal / HTML / ATS scraping via unified scraper pipeline
    const domain = new URL(cleanUrl).hostname;
    const tempConfig = {
      id: `manual-url-${Date.now()}`,
      name: organization || title || domain,
      url: cleanUrl,
      category: 'Government Sector' as const,
      region: 'Pakistan' as const,
      interval: '24h' as const,
      autoApprove: false,
      status: 'Active Scheduled' as const,
      scrapedCount: 0,
      keywords: 'jobs, careers, recruitment, vacancies'
    };

    const scraped = await scrapeTargetPortal(tempConfig, { runId: `MANUAL-${Date.now().toString(36).toUpperCase()}` });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const jobs: Job[] = (scraped || []).map((r, idx) => ({
      id: `scraped-${Date.now().toString(36)}-${idx}`,
      title: r.title,
      company: r.company || organization || domain,
      jobType: r.jobType || 'On-site',
      region: r.region || 'Pakistan',
      salary: r.salary || 'Salary not disclosed',
      currency: r.currency || 'PKR',
      experienceLevel: (r.experienceLevel === 'Junior' ? 'Entry' : (r.experienceLevel || 'Mid')) as any,
      department: r.department || organization || 'General',
      tags: r.tags || [domain],
      description: r.description || `Original vacancy scraped from ${domain}. Refer to original URL for full details.`,
      requirements: r.requirements || [],
      benefits: r.benefits || [],
      postedAt: r.postedAt || 'Recent',
      applicationsCount: 0,
      status: 'Pending',
      sourceUrl: r.sourceUrl || cleanUrl,
      originalApplyUrl: r.originalApplyUrl || r.sourceUrl || cleanUrl,
      sourceJobId: r.sourceJobId || undefined,
      isGovtJob: r.isGovtJob ?? true,
      scrapedSourceDomain: domain,
      scraperSourceName: `${organization || domain} Scraper`,
      sourcePortal: organization || domain,
      extractionMethod: r.extractionMethod || 'html_cheerio',
      scrapedAt: now,
      paymentStatus: 'Exempt'
    }));

    return res.json({
      success: true,
      jobs,
      totalExtracted: jobs.length,
      totalPages: 1,
      rawTextSample: `Extracted from live web portal: ${cleanUrl}`,
      message: jobs.length > 0
        ? `Successfully harvested ${jobs.length} authentic vacancies directly from ${domain}.`
        : `Scraped target portal ${domain}, but 0 vacancies were detected. No synthetic data was generated.`
    });
  } catch (err: any) {
    console.error('Error in /api/scraper/parse-url:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to parse target URL', jobs: [] });
  }
});

// 6. Trigger Real Scraper Run with Multi-Source & All Modes
scraperRouter.post('/run', requireAdmin, async (req, res) => {
  try {
    const options: ScraperRunOptions = {
      mode: req.body.mode || 'complete',
      sourceId: req.body.sourceId,
      sourceIds: Array.isArray(req.body.sourceIds) ? req.body.sourceIds : (req.body.sourceId ? [req.body.sourceId] : undefined),
      startPage: req.body.startPage ? parseInt(req.body.startPage, 10) : undefined,
      endPage: req.body.endPage ? parseInt(req.body.endPage, 10) : undefined,
      sinceTimestamp: req.body.sinceTimestamp,
      fromTimestamp: req.body.fromTimestamp,
      toTimestamp: req.body.toTimestamp,
      autoPublishTrusted: req.body.autoPublishTrusted
    };

    const result = await executeScraperWithWizard(options);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error in /api/scraper/run:', err);
    res.status(500).json({ success: false, message: err.message || 'Error executing scraper run' });
  }
});

// 7. Get Scraper Audit Runs History
scraperRouter.get('/runs', async (req, res) => {
  try {
    const runs = await ScraperRepository.getRuns();
    res.json({ success: true, runs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching scraper runs' });
  }
});

// 8. Retry Scraper Sources (Retry Selected, Retry Failed, Retry All Failed)
scraperRouter.post('/retry', requireAdmin, async (req, res) => {
  try {
    const { sourceIds, retryAllFailed } = req.body;
    let targetIds: string[] = [];
    const allSources = await ScraperRepository.getConfigs();

    if (retryAllFailed) {
      targetIds = allSources.filter(s => {
        const h = s.healthStatus || '';
        return ['404', '403', 'Timeout', 'Invalid PDF', 'HTML', 'Fetch Error', 'error', 'warning'].includes(h) ||
               (s.lastErrorMessage && s.lastErrorMessage.length > 0 && s.lastErrorMessage !== '0 vacancies extracted from target source');
      }).map(s => s.id);
    } else if (Array.isArray(sourceIds) && sourceIds.length > 0) {
      targetIds = sourceIds;
    } else {
      return res.status(400).json({ success: false, message: 'sourceIds or retryAllFailed is required.' });
    }

    if (targetIds.length === 0) {
      return res.json({ success: true, message: 'No failed sources found to retry.', totalFound: 0, newJobsCount: 0, duplicatesFound: 0, sourcesStats: [] });
    }

    const result = await executeScraperWithWizard({
      mode: 'complete',
      sourceIds: targetIds
    });

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Scraper Sources Retried',
      target: `${targetIds.length} sources retried`,
      status: 'Success'
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error in /api/scraper/retry:', err);
    res.status(500).json({ success: false, message: err.message || 'Error retrying scraper sources' });
  }
});

// 9. Source Groups CRUD & Execution
scraperRouter.get('/groups', async (req, res) => {
  try {
    const groups = await ScraperRepository.getGroups();
    res.json({ success: true, groups });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching source groups' });
  }
});

scraperRouter.post('/groups', requireAdmin, async (req, res) => {
  try {
    const { name, description, sourceIds } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    const group = await ScraperRepository.createGroup({ name, description, sourceIds });
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Scraper Source Group Created',
      target: group.name,
      status: 'Success'
    });
    res.json({ success: true, group });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating source group' });
  }
});

scraperRouter.put('/groups/:id', requireAdmin, async (req, res) => {
  try {
    const group = await ScraperRepository.updateGroup(req.params.id, req.body);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Scraper Source Group Updated',
      target: group.name,
      status: 'Success'
    });
    res.json({ success: true, group });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating source group' });
  }
});

scraperRouter.delete('/groups/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await ScraperRepository.deleteGroup(req.params.id);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Scraper Source Group Deleted',
      target: req.params.id,
      status: 'Success'
    });
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error deleting source group' });
  }
});

scraperRouter.post('/groups/:id/add-sources', requireAdmin, async (req, res) => {
  try {
    const { sourceIds } = req.body;
    const group = await ScraperRepository.addSourcesToGroup(req.params.id, sourceIds);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, group });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error adding sources to group' });
  }
});

scraperRouter.post('/groups/:id/remove-sources', requireAdmin, async (req, res) => {
  try {
    const { sourceIds } = req.body;
    const group = await ScraperRepository.removeSourcesFromGroup(req.params.id, sourceIds);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, group });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error removing sources from group' });
  }
});

scraperRouter.post('/groups/:id/run', requireAdmin, async (req, res) => {
  try {
    const groups = await ScraperRepository.getGroups();
    const group = groups.find(g => g.id === req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    if (!group.sourceIds || group.sourceIds.length === 0) {
      return res.status(400).json({ success: false, message: `Group "${group.name}" contains no sources.` });
    }

    const result = await executeScraperWithWizard({
      mode: 'complete',
      sourceIds: group.sourceIds
    });

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Scraper Source Group Executed',
      target: `${group.name} (${group.sourceIds.length} sources)`,
      status: 'Success'
    });

    res.json({ success: true, group: group.name, ...result });
  } catch (err: any) {
    console.error('Error running group:', err);
    res.status(500).json({ success: false, message: err.message || 'Error executing group scraper' });
  }
});
