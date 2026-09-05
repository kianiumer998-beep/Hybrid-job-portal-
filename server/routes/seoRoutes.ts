import { Router } from 'express';
import { Database } from '../db/database';
import { JobRepository } from '../db/repositories/JobRepository';
import { requireAdmin } from '../auth/authManager';

export const seoRouter = Router();

// 1. Dynamic XML Sitemap Generator
seoRouter.get('/sitemap.xml', (req, res) => {
  try {
    const { jobs } = JobRepository.getAll({ limit: 100 });
    const allApprovedJobs = Database.getJobs().filter(j => j.status === 'Approved' || (!j.status && !j.isSuspended));
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

    const cityPages: SitemapEntry[] = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'peshawar', 'quetta', 'multan', 'sialkot'].map(c => ({
      url: `/jobs/city/${c}`,
      priority: '0.8',
      changefreq: 'daily'
    }));

    const jobEntries: SitemapEntry[] = (allApprovedJobs || []).map((j: any) => ({
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

Sitemap: ${baseUrl}/sitemap.xml
`;
  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

// 3. Crawler-friendly Job Meta & JSON-LD endpoint
seoRouter.get('/job-meta/:id', (req, res) => {
  try {
    const job = JobRepository.getById(req.params.id) || JobRepository.getBySlug(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    const cleanTitle = (job.title || '').replace(/[^\w\s-]/gi, '').trim();
    const locationStr = [job.city, job.province, job.region].filter(Boolean).join(', ') || 'Pakistan';
    const scaleStr = job.govtScale ? ` (${job.govtScale})` : '';

    const metaTitle = `${job.title}${scaleStr} at ${job.company} - ${locationStr} | Apply Online`;
    const cleanDesc = (job.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const excerpt = cleanDesc.slice(0, 140);
    const metaDescription = `Apply online for ${cleanTitle} at ${job.company} in ${locationStr}. ${excerpt}... Official verified advertisement.`;

    let baseSalary: any = undefined;
    if (job.salary && job.salary.toLowerCase() !== 'salary not disclosed' && job.salary.toLowerCase() !== 'negotiable') {
      const numbers = job.salary.replace(/,/g, '').match(/\d+/g);
      if (numbers && numbers.length > 0) {
        const minVal = parseInt(numbers[0], 10);
        const maxVal = numbers.length > 1 ? parseInt(numbers[1], 10) : minVal;
        baseSalary = {
          '@type': 'MonetaryAmount',
          currency: job.currency || (job.salary.includes('$') ? 'USD' : 'PKR'),
          value: {
            '@type': 'QuantitativeValue',
            minValue: minVal,
            maxValue: maxVal,
            unitText: job.salary.toLowerCase().includes('hour') ? 'HOUR' : job.salary.toLowerCase().includes('year') ? 'YEAR' : 'MONTH'
          }
        };
      }
    }

    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: job.description || metaDescription,
      identifier: {
        '@type': 'PropertyValue',
        name: job.company,
        value: job.id
      },
      datePosted: job.scrapedAt ? job.scrapedAt.split(' ')[0] : new Date().toISOString().split('T')[0],
      validThrough: job.deadline ? job.deadline : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      employmentType: job.jobType === 'Part-time' ? 'PART_TIME' : job.jobType === 'Contract' ? 'CONTRACTOR' : job.jobType === 'Internship' ? 'INTERN' : 'FULL_TIME',
      applicantLocationRequirements: job.jobType === 'Remote' ? {
        '@type': 'Country',
        name: job.region || 'Pakistan'
      } : undefined,
      jobLocationType: job.jobType === 'Remote' ? 'TELECOMMUTE' : undefined,
      hiringOrganization: {
        '@type': 'Organization',
        name: job.company,
        sameAs: baseUrl
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: job.city || 'Islamabad',
          addressRegion: job.province || 'Punjab',
          addressCountry: 'PK'
        }
      }
    };

    if (baseSalary) {
      jsonLd.baseSalary = baseSalary;
    }

    res.json({
      success: true,
      metaTitle,
      metaDescription,
      canonicalUrl: `${baseUrl}/jobs/${job.slug || job.id}`,
      jsonLd
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error generating job metadata' });
  }
});

// 4. Site SEO Config (GET / PUT)
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
