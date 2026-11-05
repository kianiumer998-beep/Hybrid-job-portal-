import {
  mapGreenhouseJob,
  mapLeverJob,
  mapSmartRecruitersJob,
  mapAshbyJob,
  extractJsonLdJobs,
  extractEmbeddedStateJobs,
  extractHtmlSemanticJobs
} from '../../src/services/scraperService';
import { extractJobsFromPdfText } from '../services/pdfParserEngine';
import { mapScrapedResultToRouteJob } from '../routes/scraperRoutes';
import { JobRepository } from '../db/repositories/JobRepository';
import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';

async function runStep66a3RegressionTests() {
  console.log('=== STARTING STEP 66-A.6 PRODUCTION-FUNCTION REGRESSION TESTS ===');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Greenhouse Production Mapping Logic
  console.log('\n--- 1. Greenhouse Production Mapping (mapGreenhouseJob) ---');
  const greenhouseFixture = {
    id: 998877,
    title: 'Senior Cloud Architect',
    absolute_url: 'https://boards.greenhouse.io/acme/jobs/998877',
    updated_at: '2026-11-05T00:00:00Z',
    location: { name: 'Lahore, Pakistan' },
    content: '<p>Design scalable cloud infrastructure.</p>',
    departments: [{ name: 'Engineering' }]
  };
  const greenhouseConfig = { id: 'src-gh', name: 'Acme Corp', url: 'https://boards.greenhouse.io/acme' };
  const ghResult = mapGreenhouseJob(greenhouseFixture, greenhouseConfig);

  assert(ghResult.sourceUrl === 'https://boards.greenhouse.io/acme/jobs/998877', 'mapGreenhouseJob: sourceUrl matches absolute_url');
  assert(ghResult.applicationUrl === undefined, 'mapGreenhouseJob: applicationUrl remains undefined (no fallback to absolute_url)');
  assert(ghResult.originalApplyUrl === undefined, 'mapGreenhouseJob: originalApplyUrl remains undefined (no fallback to absolute_url)');
  assert(ghResult.title === 'Senior Cloud Architect', 'mapGreenhouseJob: title extracted correctly');
  assert(ghResult.extractionMethod === 'greenhouse_api', 'mapGreenhouseJob: extractionMethod set to greenhouse_api');

  // 2. Lever Production Mapping Logic
  console.log('\n--- 2. Lever Production Mapping (mapLeverJob) ---');
  const leverFixtureNoApply = {
    id: 'lev-101',
    text: 'Staff Systems Engineer',
    hostedUrl: 'https://jobs.lever.co/acme/lev-101',
    categories: { location: 'Remote, Pakistan', team: 'Infrastructure' },
    description: 'Maintain high availability systems.'
  };
  const leverConfig = { id: 'src-lever', name: 'Acme Corp', url: 'https://jobs.lever.co/acme' };
  const leverRes1 = mapLeverJob(leverFixtureNoApply, leverConfig);

  assert(leverRes1.sourceUrl === 'https://jobs.lever.co/acme/lev-101', 'mapLeverJob: sourceUrl matches hostedUrl');
  assert(leverRes1.applicationUrl === undefined, 'mapLeverJob: applicationUrl remains undefined when applyUrl is unstated');
  assert(leverRes1.originalApplyUrl === undefined, 'mapLeverJob: originalApplyUrl remains undefined when applyUrl is unstated');

  // 3. SmartRecruiters Production Mapping Logic
  console.log('\n--- 3. SmartRecruiters Production Mapping (mapSmartRecruitersJob) ---');
  const srFixture = {
    id: 'sr-999',
    name: 'Lead Security Engineer',
    company: { name: 'Acme Security' },
    location: { remote: true, country: 'pk', city: 'Karachi' },
    releasedDate: '2026-11-04'
  };
  const srConfig = { id: 'src-sr', name: 'Acme Corp', url: 'https://smartrecruiters.com/acme' };
  const srRes = mapSmartRecruitersJob(srFixture, srConfig);

  assert(srRes.sourceUrl === 'https://jobs.smartrecruiters.com/acme/sr-999', 'mapSmartRecruitersJob: sourceUrl constructed cleanly');
  assert(srRes.applicationUrl === undefined, 'mapSmartRecruitersJob: applicationUrl remains undefined');
  assert(srRes.originalApplyUrl === undefined, 'mapSmartRecruitersJob: originalApplyUrl remains undefined');
  assert(srRes.title === 'Lead Security Engineer', 'mapSmartRecruitersJob: title mapped correctly');

  // 4. Ashby Production Mapping Logic
  console.log('\n--- 4. Ashby Production Mapping (mapAshbyJob) ---');
  const ashbyFixture = {
    id: 'ashby-777',
    title: 'Senior Frontend Engineer',
    jobUrl: 'https://jobs.ashbyhq.com/acme/ashby-777',
    isRemote: true,
    location: 'Islamabad, Pakistan',
    publishedDate: '2026-11-03'
  };
  const ashbyConfig = { id: 'src-ashby', name: 'Acme Corp', url: 'https://jobs.ashbyhq.com/acme' };
  const ashbyRes = mapAshbyJob(ashbyFixture, ashbyConfig);

  assert(ashbyRes.sourceUrl === 'https://jobs.ashbyhq.com/acme/ashby-777', 'mapAshbyJob: sourceUrl matches jobUrl');
  assert(ashbyRes.applicationUrl === undefined, 'mapAshbyJob: applicationUrl remains undefined');
  assert(ashbyRes.originalApplyUrl === undefined, 'mapAshbyJob: originalApplyUrl remains undefined');

  // 5. JSON-LD Production Mapping Logic
  console.log('\n--- 5. JSON-LD Production Mapping (extractJsonLdJobs) ---');
  const jsonLdHtml = `
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@type": "JobPosting",
          "title": "Principal AI Researcher",
          "description": "Research multimodal AI architectures.",
          "hiringOrganization": { "@type": "Organization", "name": "AI Labs" },
          "url": "https://ailabs.com/careers/principal-ai-researcher",
          "datePosted": "2026-11-05"
        }
        </script>
      </head>
    </html>
  `;
  const jsonLdConfig = { id: 'src-ld', name: 'AI Labs' };
  const jsonLdResults = extractJsonLdJobs(jsonLdHtml, 'https://ailabs.com/careers', jsonLdConfig);

  assert(jsonLdResults.length === 1, 'extractJsonLdJobs: parsed exactly 1 job');
  if (jsonLdResults.length > 0) {
    assert(jsonLdResults[0].sourceUrl === 'https://ailabs.com/careers/principal-ai-researcher', 'extractJsonLdJobs: sourceUrl matches item.url');
    assert(jsonLdResults[0].applicationUrl === undefined, 'extractJsonLdJobs: applicationUrl remains undefined when unstated');
    assert(jsonLdResults[0].originalApplyUrl === undefined, 'extractJsonLdJobs: originalApplyUrl remains undefined when unstated');
  }

  // 6. Embedded State Production Mapping Logic
  console.log('\n--- 6. Embedded State Production Mapping (extractEmbeddedStateJobs) ---');
  const embeddedHtml = `
    <html>
      <body>
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "jobs": [
                {
                  "id": "next-job-1",
                  "title": "Full Stack Engineer",
                  "company": "NextCorp",
                  "url": "/jobs/next-job-1",
                  "applyUrl": "/jobs/next-job-1/apply"
                }
              ]
            }
          }
        }
        </script>
      </body>
    </html>
  `;
  const nextConfig = { id: 'src-next', name: 'NextCorp' };
  const nextResults = extractEmbeddedStateJobs(embeddedHtml, 'https://nextcorp.com/careers', nextConfig);

  assert(nextResults.length === 1, 'extractEmbeddedStateJobs: parsed 1 job from __NEXT_DATA__');
  if (nextResults.length > 0) {
    assert(nextResults[0].sourceUrl === 'https://nextcorp.com/jobs/next-job-1', 'extractEmbeddedStateJobs: sourceUrl resolved correctly');
    assert(nextResults[0].applicationUrl === 'https://nextcorp.com/jobs/next-job-1/apply', 'extractEmbeddedStateJobs: explicit applyUrl parsed');
    assert(nextResults[0].originalApplyUrl === 'https://nextcorp.com/jobs/next-job-1/apply', 'extractEmbeddedStateJobs: explicit originalApplyUrl parsed');
  }

  // 7. Generic HTML Production Mapping Logic
  console.log('\n--- 7. Generic HTML Production Mapping (extractHtmlSemanticJobs) ---');
  const htmlSnippet = `
    <article class="job">
      <h2 class="job-title"><a href="/job/devops-lead">DevOps Team Lead</a></h2>
      <div class="company">CloudScale</div>
      <div class="location">Remote, Pakistan</div>
      <p class="description">Manage AWS infrastructure and Kubernetes clusters.</p>
    </article>
  `;
  const htmlConfig = { id: 'src-html', name: 'CloudScale' };
  const htmlResults = extractHtmlSemanticJobs(htmlSnippet, 'https://cloudscale.com/jobs', htmlConfig);

  assert(htmlResults.length === 1, 'extractHtmlSemanticJobs: parsed 1 job from semantic article tag');
  if (htmlResults.length > 0) {
    assert(htmlResults[0].title === 'DevOps Team Lead', 'extractHtmlSemanticJobs: title parsed');
    assert(htmlResults[0].sourceUrl === 'https://cloudscale.com/job/devops-lead', 'extractHtmlSemanticJobs: sourceUrl resolved');
    assert(htmlResults[0].applicationUrl === undefined, 'extractHtmlSemanticJobs: applicationUrl remains undefined');
  }

  // 8. PDF Adapter Production Mapping Logic
  console.log('\n--- 8. PDF Adapter Production Mapping (extractJobsFromPdfText) ---');
  const samplePdfText = `
    FEDERAL PUBLIC SERVICE COMMISSION
    CASE NO. F.4-150/2026-R
    DIRECTOR GENERAL (BPS-21)
    Total Vacancies: 5
    Employment Type: Contract
    Age Limit: 32-45 years
    Qualification: Ph.D. in Computer Science or IT with 15 years experience.
    Domicile: Punjab (Open Merit: 4, Women: 1)
    Contact Email: info@fpsc.gov.pk
    Closing Date: 15 Dec 2026
  `;
  const pdfResults = extractJobsFromPdfText(samplePdfText, 'https://fpsc.gov.pk/ad.pdf', 'FPSC', 'ad.pdf');

  assert(pdfResults.length === 1, 'extractJobsFromPdfText: extracted 1 job');
  if (pdfResults.length > 0) {
    const p = pdfResults[0];
    assert(p.totalVacancies === 5, 'extractJobsFromPdfText: totalVacancies mapped to 5');
    assert(p.employmentType === 'Contract', 'extractJobsFromPdfText: employmentType mapped to Contract');
    assert(p.minimumAge === 32 && p.maximumAge === 45, 'extractJobsFromPdfText: minimumAge & maximumAge mapped');
    assert(p.contactEmail === 'info@fpsc.gov.pk', 'extractJobsFromPdfText: contactEmail mapped');
    assert(Array.isArray(p.advertisedPositions) && p.advertisedPositions.length > 0, 'extractJobsFromPdfText: advertisedPositions mapped');
  }

  // 9. Actual Scraper Route Mapping Logic (mapScrapedResultToRouteJob)
  console.log('\n--- 9. Scraper Route Production Mapping (mapScrapedResultToRouteJob) ---');
  const scrapedHtmlRouteFixture = {
    id: 'scraped-rt-html',
    title: 'Deputy Director (BPS-18)',
    company: 'Federal Ministry',
    sourceJobId: 'CASE-2026-F4',
    extractionMethod: 'html_cheerio',
    totalVacancies: 12,
    employmentType: 'Contract',
    minimumAge: 25,
    maximumAge: 35,
    contactEmail: 'recruitment@ministry.gov.pk',
    extractedText: 'Official recruitment gazette notification text sample.',
    sourceUrl: 'https://ministry.gov.pk/ad-18',
    originalApplyUrl: 'https://ministry.gov.pk/admin-apply',
    applicationUrl: 'https://ministry.gov.pk/apply-now'
  };
  const mappedHtmlRouteJob = mapScrapedResultToRouteJob(
    scrapedHtmlRouteFixture,
    0,
    'Federal Ministry',
    'ministry.gov.pk',
    'https://ministry.gov.pk/ad-18',
    '2026-11-05 12:00:00'
  );

  assert(mappedHtmlRouteJob.sourceJobId === 'CASE-2026-F4', 'mapScrapedResultToRouteJob: sourceJobId preserved');
  assert(mappedHtmlRouteJob.sourcePortal === 'Federal Ministry', 'mapScrapedResultToRouteJob: sourcePortal preserved');
  assert(mappedHtmlRouteJob.extractionMethod === 'html_cheerio', 'mapScrapedResultToRouteJob: extractionMethod preserved for HTML');
  assert(mappedHtmlRouteJob.totalVacancies === 12, 'mapScrapedResultToRouteJob: totalVacancies preserved');
  assert(mappedHtmlRouteJob.employmentType === 'Contract', 'mapScrapedResultToRouteJob: employmentType preserved');
  assert(mappedHtmlRouteJob.minimumAge === 25 && mappedHtmlRouteJob.maximumAge === 35, 'mapScrapedResultToRouteJob: age limits preserved');
  assert(mappedHtmlRouteJob.contactEmail === 'recruitment@ministry.gov.pk', 'mapScrapedResultToRouteJob: contactEmail preserved');
  assert(mappedHtmlRouteJob.extractedText === 'Official recruitment gazette notification text sample.', 'mapScrapedResultToRouteJob: extractedText preserved');

  const scrapedPdfRouteFixture = {
    id: 'scraped-rt-pdf',
    title: 'Inspector (BPS-16)',
    company: 'Federal Police',
    sourceJobId: 'POLICE-2026-01',
    extractionMethod: 'government_pdf_engine',
    sourceUrl: 'https://police.gov.pk/notice.pdf'
  };
  const mappedPdfRouteJob = mapScrapedResultToRouteJob(
    scrapedPdfRouteFixture,
    1,
    'Federal Police',
    'police.gov.pk',
    'https://police.gov.pk/notice.pdf',
    '2026-11-05 12:00:00'
  );

  assert(mappedPdfRouteJob.sourceJobId === 'POLICE-2026-01', 'mapScrapedResultToRouteJob: PDF sourceJobId preserved');
  assert(mappedPdfRouteJob.sourcePortal === 'Federal Police', 'mapScrapedResultToRouteJob: PDF sourcePortal preserved');
  assert(mappedPdfRouteJob.extractionMethod === 'government_pdf_engine', 'mapScrapedResultToRouteJob: PDF extractionMethod preserved (not hardcoded web_html)');

  // 10. Explicit applicationUrl Preservation
  console.log('\n--- 10. Explicit applicationUrl Preservation ---');
  const leverFixtureWithApply = {
    ...leverFixtureNoApply,
    applyUrl: 'https://jobs.lever.co/acme/lev-101/apply'
  };
  const leverRes2 = mapLeverJob(leverFixtureWithApply, leverConfig);
  assert(leverRes2.applicationUrl === 'https://jobs.lever.co/acme/lev-101/apply', 'mapLeverJob: explicit applicationUrl preserved when distinct from hostedUrl');

  // 11. Missing applicationUrl Remains Undefined
  console.log('\n--- 11. Missing applicationUrl Remains Undefined ---');
  assert(ghResult.applicationUrl === undefined, 'Greenhouse applicationUrl remains undefined when omitted');
  assert(leverRes1.applicationUrl === undefined, 'Lever applicationUrl remains undefined when omitted');
  assert(srRes.applicationUrl === undefined, 'SmartRecruiters applicationUrl remains undefined when omitted');
  assert(ashbyRes.applicationUrl === undefined, 'Ashby applicationUrl remains undefined when omitted');

  // 12 & 14. originalApplyUrl Remains Admin-Only & Salary Visibility Protection
  console.log('\n--- 12 & 14. originalApplyUrl Security & Salary Visibility Protection ---');
  const sensitiveJob = {
    id: 'job-vis-12',
    title: 'Confidential Chief Officer',
    company: 'Enterprise Inc',
    salary: 'USD 200,000',
    sourceUrl: 'https://enterprise.com/notice',
    originalApplyUrl: 'https://enterprise.com/admin-portal-link',
    applicationUrl: 'https://enterprise.com/apply',
    region: 'Global' as const,
    currency: 'USD' as const,
    experienceLevel: 'Senior' as const,
    jobType: 'Remote' as const,
    department: 'Exec',
    tags: ['Exec'],
    description: 'Executive role overview.',
    requirements: ['NDA'],
    benefits: ['Equity'],
    postedAt: '2026-11-05',
    applicationsCount: 0,
    fieldVisibility: {
      salary: 'Premium',
      sourceUrl: 'Premium'
    }
  };

  const guestUser = { id: 'user-guest', role: 'Job Seeker' };
  const freeUser = { id: 'user-free', role: 'Job Seeker', plan: 'Free' };
  const premiumUser = { id: 'user-prem', role: 'Job Seeker', plan: 'Premium', membershipStatus: 'Active' };
  const adminUser = { id: 'admin-01', role: 'Admin' };

  const guestFilter = JobVisibilityRepository.filterJobForUser(sensitiveJob, guestUser, false);
  const freeFilter = JobVisibilityRepository.filterJobForUser(sensitiveJob, freeUser, false);
  const premiumFilter = JobVisibilityRepository.filterJobForUser(sensitiveJob, premiumUser, true);
  const adminFilter = JobVisibilityRepository.filterJobForUser(sensitiveJob, adminUser, false);

  assert(guestFilter.originalApplyUrl === undefined, 'originalApplyUrl stripped for Guest user');
  assert(freeFilter.originalApplyUrl === undefined, 'originalApplyUrl stripped for Free user');
  assert(premiumFilter.originalApplyUrl === undefined, 'originalApplyUrl stripped for Premium user');
  assert(adminFilter.originalApplyUrl === 'https://enterprise.com/admin-portal-link', 'Admin user retains full access to originalApplyUrl');

  assert(guestFilter.salary === '🔒 Unlock with Premium Subscription', 'Sensitive salary redacted for Guest user');
  assert(freeFilter.salary === '🔒 Unlock with Premium Subscription', 'Sensitive salary redacted for Free user');
  assert(premiumFilter.salary === 'USD 200,000', 'Premium user retains access to Premium salary field');

  // 13. Manually Cleared Values Remain Protected
  console.log('\n--- 13. Manual Correction Protection for Cleared Values ---');
  const existingJobWithClearedCity = {
    id: 'job-protect-13',
    title: 'Verified Title',
    company: 'Verified Corp',
    city: '', // Intentionally cleared value
    region: 'Pakistan',
    metadata: {
      isManuallyCorrected: true,
      manuallyCorrectedFields: ['city', 'company']
    }
  };
  const incomingJob = {
    id: 'job-protect-13',
    title: 'Scraped Title',
    company: 'Scraped Corp',
    city: 'Raw Scraped City',
    region: 'Pakistan'
  };
  const protectedResult = JobRepository.applyLocationProtection(incomingJob, existingJobWithClearedCity);

  assert(protectedResult.company === 'Verified Corp', 'Manually corrected company name protected from scraper overwrite');
  assert(protectedResult.city === '', 'Intentionally cleared city ("") preserved and protected from scraper overwrite');

  console.log(`\n=== STEP 66-A.6 REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runStep66a3RegressionTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
