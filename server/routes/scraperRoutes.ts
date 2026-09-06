import { Router } from 'express';
import { Database } from '../db/database';
import { executeScraperWithWizard, ScraperRunOptions } from '../services/scraperEngine';
import { requireAdmin } from '../auth/authManager';
import { ScraperRepository, AuditRepository } from '../db/repositories';
import { parsePdfFromUrl } from '../services/pdfParserEngine';
import { scrapeTargetPortal } from '../../src/services/scraperService';
import { Job } from '../../src/types/job';

export const scraperRouter = Router();

// 1. Get Scraper Sources
scraperRouter.get('/configs', (req, res) => {
  try {
    const sources = ScraperRepository.getConfigs();
    res.json({ success: true, configs: sources });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching scraper configs' });
  }
});

// 2. Update Scraper Sources (Admin Only)
scraperRouter.put('/configs', requireAdmin, (req, res) => {
  try {
    ScraperRepository.saveConfigs(req.body);
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

// 3. Parse a specific URL or PDF document with 100% factual integrity (NO demo/synthetic jobs)
scraperRouter.post('/parse-url', requireAdmin, async (req, res) => {
  try {
    const { url, organization, title } = req.body;
    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return res.status(400).json({ success: false, message: 'Valid HTTP/HTTPS URL is required' });
    }

    const cleanUrl = url.trim();
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

    // Web portal / HTML / ATS scraping
    const tempConfig = {
      id: `temp-${Date.now()}`,
      name: organization || title || new URL(cleanUrl).hostname,
      url: cleanUrl,
      category: 'Government Sector' as const,
      region: 'Pakistan' as const,
      depth: 'Deep Crawl (50+ Jobs)' as const,
      deduplication: true,
      interval: '24h' as const,
      autoApprove: false,
      status: 'Active Scheduled' as const,
      scrapedCount: 0,
      successRate: 100,
      keywords: 'jobs, careers, recruitment, vacancies'
    };

    const scraped = await scrapeTargetPortal(tempConfig);
    const domain = new URL(cleanUrl).hostname;
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
      isGovtJob: r.isGovtJob ?? true,
      scrapedSourceDomain: domain,
      scraperSourceName: `${organization || domain} Scraper`,
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

// 4. Trigger Real Scraper Run with Multi-Source & All Modes
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

// 4. Get Scraper Audit Runs History
scraperRouter.get('/runs', (req, res) => {
  try {
    const runs = ScraperRepository.getRuns();
    res.json({ success: true, runs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching scraper runs' });
  }
});
