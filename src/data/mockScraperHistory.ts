import { ScrapedJobAuditEntry, ScraperBatchRun } from '../types/job';

export const INITIAL_SCRAPER_BATCH_RUNS: ScraperBatchRun[] = [
  {
    batchId: 'BATCH-20260826-0800',
    startTime: '2026-08-26 08:00:15',
    endTime: '2026-08-26 08:00:19',
    sourceId: 'sc-2',
    sourceName: 'FPSC & PPSC Federal Govt Jobs Scraper',
    sourceUrl: 'https://fpsc.gov.pk/jobs/announcements',
    region: 'Pakistan',
    category: 'Government Sector',
    status: 'Completed',
    totalExtracted: 8,
    approvedCount: 6,
    pendingCount: 2,
    duplicatesSkipped: 3,
    rejectionCount: 0,
    executionDurationMs: 4120,
    httpStatusCode: 200,
    triggerType: 'Scheduled Cron',
    logTrace: [
      '[08:00:15] [SSL Handshake] Authenticated target https://fpsc.gov.pk (TLS 1.3)',
      '[08:00:16] [Parser Engine] Found 11 public announcements in HTML DOM table',
      '[08:00:17] [Deduplication Engine] 3 jobs matched existing hashes in primary database (Skipped)',
      '[08:00:18] [AI Entity Extractor] Extracted 8 BPS Pay Scales, Domicile Quotas, and Gazette Serial Numbers',
      '[08:00:19] [Cron Rule: Auto-Approve] 6 jobs auto-published; 2 sent to Admin Pending Queue for scale verification.'
    ]
  },
  {
    batchId: 'BATCH-20260826-0630',
    startTime: '2026-08-26 06:30:00',
    endTime: '2026-08-26 06:30:03',
    sourceId: 'sc-4',
    sourceName: 'LinkedIn Global Remote Developer Feed',
    sourceUrl: 'https://www.linkedin.com/jobs/search?keywords=remote+developer',
    region: 'Global',
    category: 'International Remote',
    status: 'Completed',
    totalExtracted: 14,
    approvedCount: 12,
    pendingCount: 2,
    duplicatesSkipped: 9,
    rejectionCount: 0,
    executionDurationMs: 3200,
    httpStatusCode: 200,
    triggerType: 'Scheduled Cron',
    logTrace: [
      '[06:30:00] [Ingestion] Querying LinkedIn Global Remote API endpoint',
      '[06:30:01] [Geo Filter] Filtered 23 candidates for global timezone compatibility',
      '[06:30:02] [Compensation Filter] Converted EUR/GBP/USD rates to USD standard index',
      '[06:30:03] [Sync Complete] Ingested 14 international positions into repository.'
    ]
  },
  {
    batchId: 'BATCH-20260825-2200',
    startTime: '2026-08-25 22:00:10',
    endTime: '2026-08-25 22:00:14',
    sourceId: 'sc-1',
    sourceName: 'Rozee.pk Pakistan Tech Jobs',
    sourceUrl: 'https://www.rozee.pk/category/information-technology-jobs',
    region: 'Pakistan',
    category: 'Private Corporate',
    status: 'Completed',
    totalExtracted: 6,
    approvedCount: 3,
    pendingCount: 3,
    duplicatesSkipped: 4,
    rejectionCount: 0,
    executionDurationMs: 3850,
    httpStatusCode: 200,
    triggerType: 'Scheduled Cron',
    logTrace: [
      '[22:00:10] [DOM Crawler] Crawled category page (Depth: Standard 25 jobs)',
      '[22:00:12] [Deduplication] 4 matched previous hashes',
      '[22:00:13] [Classifier] Categorized 6 tech jobs (Lahore, Karachi, Islamabad)',
      '[22:00:14] [Queued] 3 auto-approved, 3 routed to Admin Pending Review.'
    ]
  },
  {
    batchId: 'BATCH-20260825-1815',
    startTime: '2026-08-25 18:15:00',
    endTime: '2026-08-25 18:15:05',
    sourceId: 'sc-3',
    sourceName: 'Daily Jang Newspaper Classified Ads',
    sourceUrl: 'https://e.jang.com.pk/classifieds',
    region: 'Pakistan',
    category: 'Newspaper Classified',
    status: 'Completed',
    totalExtracted: 5,
    approvedCount: 2,
    pendingCount: 3,
    duplicatesSkipped: 1,
    rejectionCount: 0,
    executionDurationMs: 4900,
    httpStatusCode: 200,
    triggerType: 'Scheduled Cron',
    logTrace: [
      '[18:15:00] [OCR Ingest] Fetched Sunday e-paper classified section image tiles',
      '[18:15:02] [OCR Vision Extraction] Extracted text blocks, phone numbers, and newspaper dates',
      '[18:15:04] [Admin Policy] Set to Pending Review for human editorial verification.'
    ]
  },
  {
    batchId: 'BATCH-20260825-1400',
    startTime: '2026-08-25 14:00:00',
    endTime: '2026-08-25 14:00:03',
    sourceId: 'sc-5',
    sourceName: 'GulfTalent UAE & Saudi Opportunities',
    sourceUrl: 'https://www.gulftalent.com/uae/jobs/technology',
    region: 'UAE',
    category: 'International Remote',
    status: 'Completed',
    totalExtracted: 7,
    approvedCount: 5,
    pendingCount: 2,
    duplicatesSkipped: 2,
    rejectionCount: 0,
    executionDurationMs: 2950,
    httpStatusCode: 200,
    triggerType: 'Manual On-Demand',
    logTrace: [
      '[14:00:00] [Manual Trigger] Admin initiated deep scan for Gulf technology roles',
      '[14:00:01] [Parsing] Extracted Dubai & Riyadh executive vacancies in AED/SAR',
      '[14:00:02] [Tax-Free Filter] Flagged 7 roles with Tax-Free expatriate packages',
      '[14:00:03] [Complete] Saved to database with UAE & Saudi location tags.'
    ]
  }
];

export const INITIAL_SCRAPED_AUDIT_LOGS: ScrapedJobAuditEntry[] = [
  {
    id: 'audit-sc-1',
    jobId: 'job-1',
    batchId: 'BATCH-20260826-0630',
    jobTitle: 'Senior React & Node.js Engineer',
    company: 'Vercel Remote Tech',
    scrapedAt: '2026-08-26 06:30:02',
    scrapedTimezone: 'UTC',
    sourcePortalName: 'LinkedIn Global Remote Developer Feed',
    sourceUrl: 'https://www.linkedin.com/jobs/view/senior-react-engineer-remote',
    sourceDomain: 'linkedin.com',
    category: 'International Remote',
    region: 'Global',
    country: 'United States',
    currency: 'USD',
    salaryText: '$110,000 - $140,000 / year',
    status: 'Approved Live',
    deduplicationScore: 99.4,
    crawlLatencyMs: 240,
    extractedTags: ['React', 'TypeScript', 'Node.js', 'Next.js', 'GraphQL'],
    requirementsCount: 4,
    reviewTimeline: [
      {
        id: 'act-1',
        timestamp: '2026-08-26 06:30:02',
        relativeTime: 'Today at 06:30 AM',
        action: 'Scraped',
        performedBy: 'Cron Scraper Engine',
        notes: 'Extracted from LinkedIn API feed with 99.4% uniqueness score.'
      },
      {
        id: 'act-2',
        timestamp: '2026-08-26 06:30:03',
        relativeTime: 'Today at 06:30 AM',
        action: 'Auto-Approved',
        performedBy: 'Cron Scraper Engine',
        notes: 'Target feed autoApprove rule enabled. Published directly to Live Board.'
      }
    ],
    snapshot: {
      description: 'We are seeking a high-performing Senior React Engineer to help scale our distributed global web platform.',
      requirements: ['5+ years full-stack engineering', 'Next.js SSR expertise', 'GraphQL / REST APIs'],
      benefits: ['100% Remote flexibility', '$2,500 Home Office Stipend', 'Unlimited PTO'],
      applyUrl: 'https://vercel.com/careers/senior-react-engineer'
    }
  },
  {
    id: 'audit-sc-2',
    jobId: 'job-pending-sc1-1',
    batchId: 'BATCH-20260825-2200',
    jobTitle: 'Senior Full Stack React & Node.js Engineer',
    company: 'DevSinc Pakistan',
    scrapedAt: '2026-08-25 22:00:13',
    scrapedTimezone: 'PKT (UTC+5)',
    sourcePortalName: 'Rozee.pk Pakistan Tech Jobs',
    sourceUrl: 'https://www.rozee.pk/category/information-technology-jobs',
    sourceDomain: 'rozee.pk',
    category: 'Private Corporate',
    region: 'Pakistan',
    country: 'Pakistan',
    city: 'Lahore',
    currency: 'PKR',
    salaryText: 'PKR 350,000 - PKR 480,000 / month',
    status: 'Pending Review',
    deduplicationScore: 94.2,
    crawlLatencyMs: 380,
    extractedTags: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Tailwind CSS'],
    requirementsCount: 3,
    reviewTimeline: [
      {
        id: 'act-3',
        timestamp: '2026-08-25 22:00:13',
        relativeTime: 'Yesterday at 10:00 PM',
        action: 'Scraped',
        performedBy: 'Cron Scraper Engine',
        notes: 'Ingested via Rozee.pk category scan. Salary brackets identified in PKR.'
      },
      {
        id: 'act-4',
        timestamp: '2026-08-25 22:00:14',
        relativeTime: 'Yesterday at 10:00 PM',
        action: 'Re-queued',
        performedBy: 'System Deduplicator',
        notes: 'Source feed autoApprove is disabled. Placed in Admin Pending Queue.'
      }
    ],
    snapshot: {
      description: 'Seeking a seasoned Full Stack Engineer to lead web platform architecture using React 18, Node.js microservices, and modern cloud deployment pipelines.',
      requirements: ['4+ years hands-on React and Node.js', 'Experience with PostgreSQL & Redis', 'Agile squad leadership'],
      benefits: ['Medical Insurance for Family', 'Annual Performance Bonus', 'Hybrid Flexibility'],
      applyUrl: 'https://www.rozee.pk/devsinc-fullstack-2026'
    }
  },
  {
    id: 'audit-sc-3',
    jobId: 'job-pending-sc2-1',
    batchId: 'BATCH-20260826-0800',
    jobTitle: 'Assistant Director IT (BPS-17)',
    company: 'Federal Public Service Commission (FPSC)',
    scrapedAt: '2026-08-26 08:00:18',
    scrapedTimezone: 'PKT (UTC+5)',
    sourcePortalName: 'FPSC & PPSC Federal Govt Jobs Scraper',
    sourceUrl: 'https://fpsc.gov.pk/jobs/announcements',
    sourceDomain: 'fpsc.gov.pk',
    category: 'Government Sector',
    region: 'Pakistan',
    country: 'Pakistan',
    city: 'Islamabad',
    currency: 'PKR',
    salaryText: 'PKR 110,000 - PKR 160,000 / month (BPS-17 Pay Scale)',
    status: 'Pending Review',
    deduplicationScore: 98.8,
    crawlLatencyMs: 450,
    extractedTags: ['Govt Job', 'FPSC', 'BPS-17', 'Federal Govt', 'Public Sector'],
    requirementsCount: 3,
    isGovtJob: true,
    govtScale: 'BPS-17',
    govtDepartment: 'Federal Public Service Commission',
    reviewTimeline: [
      {
        id: 'act-5',
        timestamp: '2026-08-26 08:00:18',
        relativeTime: 'Today at 08:00 AM',
        action: 'Scraped',
        performedBy: 'Cron Scraper Engine',
        notes: 'Extracted gazetted vacancy from Federal Public Service Commission announcement portal.'
      },
      {
        id: 'act-6',
        timestamp: '2026-08-26 08:00:19',
        relativeTime: 'Today at 08:00 AM',
        action: 'Re-queued',
        performedBy: 'AI Entity Extractor',
        notes: 'Extracted BPS-17 pay grade and Federal quota rules. Sent to Admin Review.'
      }
    ],
    snapshot: {
      description: 'Official Federal Public Service Commission recruitment for Assistant Director IT. Responsible for network infrastructure and database security.',
      requirements: ['Master or BS in Computer Science', 'Age Limit: 22-30 yrs (+5 yrs general relaxation)', 'Domicile: Punjab / Sindh / KPK'],
      benefits: ['Govt Accommodation', 'Pension & EOBI', 'Medical Grade 1 Facilities'],
      applyUrl: 'https://fpsc.gov.pk/online-apply-ad-it'
    }
  },
  {
    id: 'audit-sc-4',
    jobId: 'job-10-newspaper',
    batchId: 'BATCH-20260825-1815',
    jobTitle: 'Senior Accounts & Tax Officer (Newspaper Ad Clipping)',
    company: 'Al-Farooq Enterprises (Daily Jang Classifieds)',
    scrapedAt: '2026-08-25 18:15:04',
    scrapedTimezone: 'PKT (UTC+5)',
    sourcePortalName: 'Daily Jang Newspaper Classified Ads',
    sourceUrl: 'https://e.jang.com.pk/classifieds/karachi-lahore-accounts-2026',
    sourceDomain: 'e.jang.com.pk',
    category: 'Newspaper Classified',
    region: 'Pakistan',
    country: 'Pakistan',
    city: 'Lahore',
    currency: 'PKR',
    salaryText: 'PKR 150,000 - PKR 220,000 / month',
    status: 'Approved Live',
    deduplicationScore: 91.5,
    crawlLatencyMs: 520,
    extractedTags: ['Newspaper Clipping', 'Daily Jang', 'Taxation', 'ACCA', 'Lahore'],
    requirementsCount: 3,
    isNewspaperAd: true,
    newspaperName: 'Daily Jang',
    clippingImageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=60',
    reviewTimeline: [
      {
        id: 'act-7',
        timestamp: '2026-08-25 18:15:04',
        relativeTime: 'Yesterday at 06:15 PM',
        action: 'Scraped',
        performedBy: 'Cron Scraper Engine',
        notes: 'Extracted OCR textual content and newspaper image clipping from Daily Jang Sunday classifieds.'
      },
      {
        id: 'act-8',
        timestamp: '2026-08-25 19:20:00',
        relativeTime: 'Yesterday at 07:20 PM',
        action: 'Approved by Admin',
        performedBy: 'Admin User',
        actorName: 'Admin Editorial Desk',
        notes: 'Clipping image reviewed and verified. Published to Live Portal.'
      }
    ],
    snapshot: {
      description: 'Urgent opening for Senior Accounts Officer with experience in corporate taxation and FBR e-filing.',
      requirements: ['M.Com / ACCA / CA Inter qualified', '4+ years handling corporate taxation & FBR', 'Contact via phone/WhatsApp'],
      benefits: ['Competitive salary', 'Annual bonus', 'EOBI Registration'],
      contactInfo: 'hr@alfarooq.com / +92 300 9876543'
    }
  },
  {
    id: 'audit-sc-5',
    jobId: 'job-11-uae',
    batchId: 'BATCH-20260825-1400',
    jobTitle: 'Senior Cloud Solutions Architect',
    company: 'Emirates NBD Digital Hub',
    scrapedAt: '2026-08-25 14:00:02',
    scrapedTimezone: 'GST (UTC+4)',
    sourcePortalName: 'GulfTalent UAE & Saudi Opportunities',
    sourceUrl: 'https://www.gulftalent.com/uae/jobs/technology',
    sourceDomain: 'gulftalent.com',
    category: 'International Remote',
    region: 'UAE',
    country: 'United Arab Emirates',
    city: 'Dubai',
    currency: 'AED',
    salaryText: 'AED 24,000 - AED 35,000 / month (Tax Free)',
    status: 'Approved Live',
    deduplicationScore: 97.9,
    crawlLatencyMs: 290,
    extractedTags: ['Dubai', 'Tax Free', 'AWS', 'Kubernetes', 'Fintech'],
    requirementsCount: 3,
    reviewTimeline: [
      {
        id: 'act-9',
        timestamp: '2026-08-25 14:00:02',
        relativeTime: 'Yesterday at 02:00 PM',
        action: 'Scraped',
        performedBy: 'Cron Scraper Engine',
        notes: 'Extracted from GulfTalent tech feed. Converted to AED Tax-Free package.'
      },
      {
        id: 'act-10',
        timestamp: '2026-08-25 14:00:03',
        relativeTime: 'Yesterday at 02:00 PM',
        action: 'Auto-Approved',
        performedBy: 'Cron Scraper Engine',
        notes: 'Expatriate visa sponsorship verified. Auto-published to Global board.'
      }
    ],
    snapshot: {
      description: 'Emirates NBD is hiring a Senior Cloud Architect in Dubai Internet City for core banking workloads.',
      requirements: ['7+ years AWS/Azure architecture', 'ISO27001 compliance expertise', 'Relocation to Dubai'],
      benefits: ['100% Tax Free UAE Salary', 'Relocation ticket & housing allowance', 'Premium Medical Cover'],
      applyUrl: 'https://emiratesnbd.com/careers/cloud-architect'
    }
  },
  {
    id: 'audit-sc-6',
    jobId: 'job-12-saudi',
    batchId: 'BATCH-20260825-1400',
    jobTitle: 'Fintech Payments Engineering Lead',
    company: 'STC Pay Riyadh Headquarters',
    scrapedAt: '2026-08-25 14:00:02',
    scrapedTimezone: 'AST (UTC+3)',
    sourcePortalName: 'GulfTalent UAE & Saudi Opportunities',
    sourceUrl: 'https://www.gulftalent.com/saudi-arabia/jobs/fintech',
    sourceDomain: 'gulftalent.com',
    category: 'International Remote',
    region: 'Saudi Arabia',
    country: 'Saudi Arabia',
    city: 'Riyadh',
    currency: 'SAR',
    salaryText: 'SAR 28,000 - SAR 40,000 / month (Tax Free)',
    status: 'Approved Live',
    deduplicationScore: 98.2,
    crawlLatencyMs: 310,
    extractedTags: ['Saudi Arabia', 'Riyadh', 'Fintech', 'Java', 'Microservices'],
    requirementsCount: 3,
    reviewTimeline: [
      {
        id: 'act-11',
        timestamp: '2026-08-25 14:00:02',
        relativeTime: 'Yesterday at 02:00 PM',
        action: 'Scraped',
        performedBy: 'Cron Scraper Engine',
        notes: 'Ingested Riyadh engineering role. Auto-classified as International Remote/Relocation.'
      },
      {
        id: 'act-12',
        timestamp: '2026-08-25 14:00:03',
        relativeTime: 'Yesterday at 02:00 PM',
        action: 'Auto-Approved',
        performedBy: 'Cron Scraper Engine',
        notes: 'Live feed synchronization approved.'
      }
    ],
    snapshot: {
      description: 'Lead engineering squad for STC Pay digital wallet platform in Riyadh building ISO20022 real-time settlement.',
      requirements: ['6+ years payments & banking switches', 'Java Spring Boot / Go microservices', 'Relocation to Riyadh'],
      benefits: ['Tax Free SAR Salary', 'Family annual flights', 'Children education stipend'],
      applyUrl: 'https://stcpay.com.sa/careers/lead-engineer'
    }
  }
];
