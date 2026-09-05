import { Job } from '../types/job';

export interface JobSeoMetadata {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  canonicalUrl: string;
  jsonLd: Record<string, any>;
}

/**
 * Automatically generates high-ranking SEO metadata and Schema.org JobPosting structured data
 * for any job post to rank #1 on Google for Pakistan and global queries.
 */
export function generateJobSeoMetadata(job: Job, siteBaseUrl = 'https://pakjobsportal.com'): JobSeoMetadata {
  const cleanTitle = job.title.replace(/[^\w\s-]/gi, '').trim();
  const locationStr = [job.city, job.province, job.region].filter(Boolean).join(', ') || 'Pakistan';
  const scaleStr = job.govtScale ? ` (${job.govtScale})` : '';

  // 1. Google High-Ranking Title Tag (50-60 characters optimum)
  const metaTitle = `${job.title}${scaleStr} at ${job.company} - ${job.city || 'Pakistan'} | Apply Online 2026`;

  // 2. High CTR Meta Description (145-160 chars optimum)
  const cleanDesc = (job.description || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const excerpt = cleanDesc.slice(0, 110);
  const metaDescription = `Apply online for ${cleanTitle} at ${job.company} in ${locationStr}. Salary: ${job.salary}. ${excerpt}... Official verified advertisement.`;

  // 3. Automated SEO Keywords List
  const autoKeywords = [
    job.title.toLowerCase(),
    `${job.company.toLowerCase()} jobs`,
    `${(job.city || 'pakistan').toLowerCase()} jobs 2026`,
    `${(job.province || 'pakistan').toLowerCase()} vacancies`,
    job.isGovtJob ? 'government jobs in pakistan' : 'private jobs in pakistan',
    job.govtScale ? `${job.govtScale.toLowerCase()} jobs` : '',
    job.isNewspaperAd ? `${(job.newspaperName || 'newspaper').toLowerCase()} jobs ad` : '',
    'pakistan job portal',
    'latest job vacancies apply online',
    ...(job.tags || []).map((t) => t.toLowerCase())
  ].filter(Boolean);

  const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const canonicalUrl = `${siteBaseUrl}/jobs/${job.id}-${slug}`;

  // Parse salary if available and valid
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

  // 4. Schema.org JobPosting JSON-LD for Google Jobs Carousels
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
    validThrough: (job as any).deadline ? (job as any).deadline : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    employmentType: 'FULL_TIME',
    applicantLocationRequirements: job.jobType === 'Remote' ? {
      '@type': 'Country',
      name: job.region || 'Pakistan'
    } : undefined,
    jobLocationType: job.jobType === 'Remote' ? 'TELECOMMUTE' : undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      sameAs: siteBaseUrl
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

  return {
    metaTitle,
    metaDescription,
    keywords: Array.from(new Set(autoKeywords)),
    canonicalUrl,
    jsonLd
  };
}

/**
 * Injects Google JSON-LD schema into the document head and updates meta tags at runtime
 */
export function injectJobJsonLd(job: Job): void {
  if (typeof document === 'undefined') return;

  const seo = generateJobSeoMetadata(job);

  // Update Page Title
  document.title = seo.metaTitle;

  // Update Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', seo.metaDescription);

  // Update Keywords
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.setAttribute('name', 'keywords');
    document.head.appendChild(metaKeywords);
  }
  metaKeywords.setAttribute('content', seo.keywords.join(', '));

  // Update or inject JSON-LD structured script
  let script = document.getElementById('google-job-schema') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'google-job-schema';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(seo.jsonLd, null, 2);
}
