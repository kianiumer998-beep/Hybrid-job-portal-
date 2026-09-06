import { Router } from 'express';
import { Database } from '../db/database';
import { JobRepository } from '../db/repositories/JobRepository';
import { requireAdmin } from '../auth/authManager';

export const seoRouter = Router();

// Helper to sanitize XML text
function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// 1. Authoritative Dynamic XML Sitemap Generator (Excludes Expired, Duplicate, Rejected, Suspended)
seoRouter.get('/sitemap.xml', (req, res) => {
  try {
    // Only include non-expired, approved, non-suspended jobs
    const { jobs: activeApprovedJobs } = JobRepository.getAll({ limit: 1000, includeExpired: false });
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
      { url: '/pakistan-jobs', priority: '0.8', changefreq: 'daily' }
    ];

    const cityPages: SitemapEntry[] = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'peshawar', 'quetta', 'multan', 'sialkot'].map(c => ({
      url: `/jobs/city/${c}`,
      priority: '0.8',
      changefreq: 'daily'
    }));

    const jobEntries: SitemapEntry[] = (activeApprovedJobs || [])
      .filter((j: any) => !j.isDuplicate && !j.isSuspended && j.status === 'Approved')
      .map((j: any) => ({
        url: `/jobs/${j.slug || j.id}`,
        lastmod: j.updatedAt || j.createdAt || j.scrapedAt || new Date().toISOString(),
        priority: j.featured ? '0.9' : '0.7',
        changefreq: 'daily'
      }));

    const allUrls: SitemapEntry[] = [...staticPages, ...cityPages, ...jobEntries];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${escapeXml(baseUrl + u.url)}</loc>
    ${u.lastmod ? `<lastmod>${escapeXml(u.lastmod.substring(0, 10))}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err: any) {
    res.status(500).send('Error generating sitemap');
  }
});

// 2. Authoritative Robots.txt Generator
seoRouter.get('/robots.txt', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  const robots = `User-agent: *
Allow: /
Allow: /jobs
Allow: /jobs/*
Allow: /government-jobs
Allow: /remote-jobs
Allow: /pakistan-jobs
Disallow: /admin
Disallow: /admin/*
Disallow: /account
Disallow: /account/*
Disallow: /api/auth/*
Disallow: /api/admin/*
Disallow: /api/applications/cv/*
Disallow: /api/scraper/*
Disallow: /api/transactions/*

Sitemap: ${baseUrl}/sitemap.xml
`;
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(robots);
});

// 3. Factual, Non-Invented JobPosting JSON-LD & Crawler Endpoint
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
    const excerpt = cleanDesc.slice(0, 160);
    const metaDescription = excerpt ? `${excerpt}... Apply for ${cleanTitle} at ${job.company}.` : `Apply online for ${cleanTitle} at ${job.company} in ${locationStr}.`;

    // FACTUAL SALARY: Only emit baseSalary if genuine numeric values exist
    let baseSalary: any = undefined;
    if (job.salary && !['salary not disclosed', 'negotiable', 'confidential'].includes(job.salary.toLowerCase().trim())) {
      const numbers = job.salary.replace(/,/g, '').match(/\d+/g);
      if (numbers && numbers.length > 0) {
        const minVal = parseInt(numbers[0], 10);
        const maxVal = numbers.length > 1 ? parseInt(numbers[1], 10) : minVal;
        if (minVal > 0) {
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
    }

    // STRICT FACTUAL JSON-LD: DO NOT invent dates, validThrough, or fake locations
    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: job.description || metaDescription,
      datePosted: (job.datePosted || job.scrapedAt || job.createdAt || '').substring(0, 10) || undefined
    };

    // Valid identifier if available
    if (job.id || job.sourceJobId) {
      jsonLd.identifier = {
        '@type': 'PropertyValue',
        name: job.company || 'Job Portal',
        value: String(job.sourceJobId || job.id)
      };
    }

    // Only emit validThrough if genuinely present
    const rawDeadline = job.deadline || job.deadlineDate || job.closingDeadline;
    if (rawDeadline) {
      const deadlineDate = new Date(rawDeadline);
      if (!isNaN(deadlineDate.getTime())) {
        jsonLd.validThrough = deadlineDate.toISOString().substring(0, 10);
      }
    }

    // Only emit employmentType if specified
    if (job.jobType) {
      if (job.jobType === 'Part-time') jsonLd.employmentType = 'PART_TIME';
      else if (job.jobType === 'Contract') jsonLd.employmentType = 'CONTRACTOR';
      else if (job.jobType === 'Internship') jsonLd.employmentType = 'INTERN';
      else if (job.jobType === 'Full-time' || job.jobType === 'On-site') jsonLd.employmentType = 'FULL_TIME';
    }

    // Remote handling
    if (job.jobType === 'Remote') {
      jsonLd.jobLocationType = 'TELECOMMUTE';
      if (job.region && job.region !== 'Global') {
        jsonLd.applicantLocationRequirements = {
          '@type': 'Country',
          name: job.region
        };
      }
    } else if (job.city || job.province) {
      // Only emit jobLocation if factual city or province exists
      jsonLd.jobLocation = {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          ...(job.city ? { addressLocality: job.city } : {}),
          ...(job.province ? { addressRegion: job.province } : {}),
          addressCountry: job.region === 'US' ? 'US' : job.region === 'UK' ? 'GB' : job.region === 'UAE' ? 'AE' : 'PK'
        }
      };
    }

    // Hiring organization: only if genuine company exists
    if (job.company && job.company.trim()) {
      jsonLd.hiringOrganization = {
        '@type': 'Organization',
        name: job.company,
        ...(job.companyWebsite ? { sameAs: job.companyWebsite } : {})
      };
    }

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

// 4. Crawlable Public Job SSR HTML Page for Search Engines & Social Bots
seoRouter.get('/public-job/:idOrSlug', (req, res) => {
  try {
    const job = JobRepository.getById(req.params.idOrSlug) || JobRepository.getBySlug(req.params.idOrSlug);
    if (!job) {
      return res.status(404).send(`<!DOCTYPE html><html><head><title>Job Not Found</title></head><body><h1>404 - Job Vacancy Not Found</h1><p>The requested vacancy may have been filled or expired.</p><p><a href="/">Return to Home</a></p></body></html>`);
    }

    const baseUrl = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    const canonicalUrl = `${baseUrl}/jobs/${job.slug || job.id}`;
    const cleanTitle = (job.title || '').replace(/[^\w\s-]/gi, '').trim();
    const locationStr = [job.city, job.province, job.region].filter(Boolean).join(', ') || 'Pakistan';
    const pageTitle = `${job.title} at ${job.company} - ${locationStr} | Career Portal`;
    const cleanDesc = (job.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const metaDesc = cleanDesc.slice(0, 160) || `Apply online for ${job.title} at ${job.company}.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeXml(pageTitle)}</title>
  <meta name="description" content="${escapeXml(metaDesc)}">
  <link rel="canonical" href="${escapeXml(canonicalUrl)}">
  <!-- OpenGraph -->
  <meta property="og:title" content="${escapeXml(pageTitle)}">
  <meta property="og:description" content="${escapeXml(metaDesc)}">
  <meta property="og:url" content="${escapeXml(canonicalUrl)}">
  <meta property="og:type" content="article">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeXml(pageTitle)}">
  <meta name="twitter:description" content="${escapeXml(metaDesc)}">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b;">
  <h1>${escapeXml(job.title)}</h1>
  <h3>Company: <strong>${escapeXml(job.company)}</strong></h3>
  <p><strong>Location:</strong> ${escapeXml(locationStr)} | <strong>Job Type:</strong> ${escapeXml(job.jobType || 'Full-time')}</p>
  <p><strong>Salary:</strong> ${escapeXml(job.salary || 'Salary not disclosed')}</p>
  ${job.isExpired ? '<div style="background:#fef2f2; color:#b91c1c; padding:12px; border-radius:8px; margin:16px 0;"><strong>EXPIRED:</strong> The deadline for this job posting has passed.</div>' : ''}
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <h2>Description</h2>
  <div>${escapeXml(cleanDesc)}</div>
  <p style="margin-top: 32px;">
    <a href="/jobs/${job.slug || job.id}" style="background: #059669; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Interactive Job Page & Apply</a>
  </p>
</body>
</html>`;

    res.header('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send('Error rendering job page');
  }
});

// 5. Site SEO Config (GET / PUT)
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
