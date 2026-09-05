import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';

export const seoRouter = Router();

// 1. Dynamic XML Sitemap Generator
seoRouter.get('/sitemap.xml', (req, res) => {
  try {
    const jobs = Database.getJobs().filter(j => j.status === 'Approved' || (!j.status && !j.isSuspended));
    const baseUrl = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;

    interface SitemapEntry {
      url: string;
      priority: string;
      changefreq: string;
      lastmod?: string;
    }

    const staticPages: SitemapEntry[] = [
      { url: '/', priority: '1.0', changefreq: 'hourly' },
      { url: '/jobs', priority: '0.9', changefreq: 'hourly' },
      { url: '/government-jobs', priority: '0.9', changefreq: 'daily' },
      { url: '/remote-jobs', priority: '0.8', changefreq: 'daily' },
      { url: '/pakistan-jobs', priority: '0.8', changefreq: 'daily' },
      { url: '/cv-builder', priority: '0.7', changefreq: 'weekly' }
    ];

    const cityPages: SitemapEntry[] = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'peshawar', 'quetta'].map(c => ({
      url: `/jobs/city/${c}`,
      priority: '0.8',
      changefreq: 'daily'
    }));

    const jobEntries: SitemapEntry[] = jobs.map(j => ({
      url: `/jobs/${j.slug || j.id}`,
      lastmod: j.updatedAt || j.createdAt || new Date().toISOString(),
      priority: j.featured ? '0.9' : '0.7',
      changefreq: 'daily'
    }));

    const allUrls: SitemapEntry[] = [...staticPages, ...cityPages, ...jobEntries];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${baseUrl}${u.url}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod.substring(0, 10)}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err: any) {
    res.status(500).send('Error generating sitemap');
  }
});

// 2. Robots.txt Generator
seoRouter.get('/robots.txt', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  const robots = `User-agent: *
Allow: /
Allow: /jobs/
Allow: /government-jobs
Allow: /remote-jobs
Allow: /pakistan-jobs
Allow: /cv-builder
Disallow: /admin/
Disallow: /account/
Disallow: /api/auth/
Disallow: /api/admin/

Sitemap: ${baseUrl}/api/sitemap.xml
`;
  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

// 3. Site SEO Config (GET / PUT)
seoRouter.get('/config', (req, res) => {
  try {
    const config = Database.getSeoConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching SEO config' });
  }
});

seoRouter.put('/config', requireAdmin, (req, res) => {
  try {
    const updated = { ...Database.getSeoConfig(), ...req.body, updatedAt: new Date().toISOString() };
    Database.saveSeoConfig(updated);
    Database.addAuditLog({
      user: 'Administrator',
      role: 'SEO Manager',
      action: 'SEO Configuration Updated',
      target: updated.siteTitle || 'Meta Settings',
      status: 'Success'
    });
    res.json({ success: true, config: updated, message: 'SEO configuration updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error saving SEO config' });
  }
});
