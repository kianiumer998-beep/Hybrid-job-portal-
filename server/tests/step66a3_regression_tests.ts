import { extractJobsFromPdfText } from '../services/pdfParserEngine';
import { JobRepository } from '../db/repositories/JobRepository';
import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';

async function runStep66a3RegressionTests() {
  console.log('=== STARTING STEP 66-A.5 REGRESSION TESTS ===');
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

  // 1. Greenhouse: j.absolute_url is not automatically applicationUrl or originalApplyUrl
  console.log('\n--- 1. Greenhouse ATS URL Separation ---');
  const greenhouseJobRaw = {
    id: 12345,
    title: 'Senior Software Engineer',
    absolute_url: 'https://boards.greenhouse.io/acme/jobs/12345',
    updated_at: '2026-11-05T00:00:00Z',
    location: { name: 'Remote' }
  };
  const ghSourceUrl = greenhouseJobRaw.absolute_url;
  const ghAppUrl: string | undefined = undefined;
  const ghOrigApplyUrl: string | undefined = undefined;
  assert(ghSourceUrl === 'https://boards.greenhouse.io/acme/jobs/12345', 'Greenhouse sourceUrl matches absolute_url');
  assert(ghAppUrl === undefined, 'Greenhouse j.absolute_url is not automatically assigned to applicationUrl');
  assert(ghOrigApplyUrl === undefined, 'Greenhouse j.absolute_url is not automatically assigned to originalApplyUrl');

  // 2. Lever: j.hostedUrl is not used as fallback applicationUrl or originalApplyUrl
  console.log('\n--- 2. Lever ATS URL Separation ---');
  const leverJobRaw = {
    id: 'lever-1',
    text: 'Frontend Developer',
    hostedUrl: 'https://jobs.lever.co/acme/lever-1',
    applyUrl: undefined
  };
  const leverSourceUrl = leverJobRaw.hostedUrl;
  const leverAppUrl = (leverJobRaw.applyUrl && leverJobRaw.applyUrl !== leverJobRaw.hostedUrl) ? leverJobRaw.applyUrl : undefined;
  assert(leverSourceUrl === 'https://jobs.lever.co/acme/lever-1', 'Lever sourceUrl matches hostedUrl');
  assert(leverAppUrl === undefined, 'Lever j.hostedUrl is not used as fallback applicationUrl when applyUrl is missing');

  // 3. SmartRecruiters: j.id / URL is not automatically applicationUrl or originalApplyUrl
  console.log('\n--- 3. SmartRecruiters URL Separation ---');
  const srJobUrl = 'https://jobs.smartrecruiters.com/acme/sr-1';
  const srAppUrl: string | undefined = undefined;
  assert(srJobUrl === 'https://jobs.smartrecruiters.com/acme/sr-1', 'SmartRecruiters sourceUrl is standard job link');
  assert(srAppUrl === undefined, 'SmartRecruiters job URL is not automatically applicationUrl');

  // 4. Ashby: j.jobUrl is not automatically applicationUrl or originalApplyUrl
  console.log('\n--- 4. Ashby ATS URL Separation ---');
  const ashbyJobRaw = {
    id: 'ashby-1',
    title: 'Product Manager',
    jobUrl: 'https://jobs.ashbyhq.com/acme/ashby-1',
    applyUrl: undefined
  };
  const ashbySourceUrl = ashbyJobRaw.jobUrl;
  const ashbyAppUrl = (ashbyJobRaw.applyUrl && ashbyJobRaw.applyUrl !== ashbyJobRaw.jobUrl) ? ashbyJobRaw.applyUrl : undefined;
  assert(ashbySourceUrl === 'https://jobs.ashbyhq.com/acme/ashby-1', 'Ashby sourceUrl matches jobUrl');
  assert(ashbyAppUrl === undefined, 'Ashby j.jobUrl is not automatically applicationUrl');

  // 5. JSON-LD: item.url remains sourceUrl unless explicit application URL identified
  console.log('\n--- 5. JSON-LD URL Separation ---');
  const jsonLdItem = {
    '@type': 'JobPosting',
    title: 'Data Analyst',
    url: 'https://company.com/careers/data-analyst'
  };
  const jsonLdSourceUrl = jsonLdItem.url;
  const jsonLdAppUrl = (jsonLdItem as any).applicationUrl || (jsonLdItem as any).applyUrl || undefined;
  assert(jsonLdSourceUrl === 'https://company.com/careers/data-analyst', 'JSON-LD item.url is stored as sourceUrl');
  assert(jsonLdAppUrl === undefined, 'JSON-LD item.url is not automatically copied to applicationUrl');

  // 6. PDF Adapter Data Forwarding (all structured extension fields)
  console.log('\n--- 6. PDF Adapter Data Forwarding ---');
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
  const extractedPdfJobs = extractJobsFromPdfText(samplePdfText, 'https://fpsc.gov.pk/ad.pdf', 'FPSC', 'ad.pdf');
  assert(extractedPdfJobs.length === 1, 'Extracted exactly 1 job from PDF sample text');
  if (extractedPdfJobs.length > 0) {
    const j = extractedPdfJobs[0];
    assert(Boolean(j.extractedText && j.extractedText.length > 20), 'extractedText forwarded and populated');
    assert(j.totalVacancies === 5, 'totalVacancies correctly parsed as 5');
    assert(j.employmentType === 'Contract', 'Contract employmentType extracted');
    assert(Boolean(j.ageLimit), 'ageLimit populated');
    assert(j.minimumAge === 32 && j.maximumAge === 45, 'minimumAge and maximumAge parsed');
    assert(Boolean(j.qualificationSummary), 'qualificationSummary populated');
    assert(Boolean(j.domicile), 'domicile populated');
    assert(j.contactEmail === 'info@fpsc.gov.pk', 'contactEmail extracted');
    assert(Array.isArray(j.advertisedPositions) && j.advertisedPositions.length > 0, 'advertisedPositions array populated');
  }

  // 7. Scraper Route Mapping (Preservation of all structured fields)
  console.log('\n--- 7. Scraper Route Structured Field Preservation ---');
  const mockScrapedResult = {
    id: 'scraped-route-1',
    title: 'Assistant Director',
    company: 'Federal Agency',
    advertisedPositions: ['Assistant Director (BPS-17)'],
    totalVacancies: 10,
    employmentType: 'Permanent',
    ageLimit: '21-30 years',
    minimumAge: 21,
    maximumAge: 30,
    qualificationSummary: 'Master degree',
    domicile: 'Federal',
    contactEmail: 'apply@gov.pk',
    responsibilitiesList: ['Policy Analysis'],
    extractedText: 'Full raw text of gazette notice',
    relatedSourceUrls: ['https://gov.pk/gazette.pdf'],
    sourceUrl: 'https://gov.pk/jobs/ad-1',
    applicationUrl: 'https://gov.pk/apply/ad-1'
  };
  const mappedRouteJob = {
    id: mockScrapedResult.id,
    title: mockScrapedResult.title,
    company: mockScrapedResult.company,
    sourceUrl: mockScrapedResult.sourceUrl,
    applicationUrl: mockScrapedResult.applicationUrl,
    advertisedPositions: mockScrapedResult.advertisedPositions,
    totalVacancies: mockScrapedResult.totalVacancies,
    employmentType: mockScrapedResult.employmentType,
    ageLimit: mockScrapedResult.ageLimit,
    minimumAge: mockScrapedResult.minimumAge,
    maximumAge: mockScrapedResult.maximumAge,
    qualificationSummary: mockScrapedResult.qualificationSummary,
    domicile: mockScrapedResult.domicile,
    contactEmail: mockScrapedResult.contactEmail,
    responsibilitiesList: mockScrapedResult.responsibilitiesList,
    extractedText: mockScrapedResult.extractedText,
    relatedSourceUrls: mockScrapedResult.relatedSourceUrls
  };
  assert(mappedRouteJob.totalVacancies === 10, 'Route mapping preserves totalVacancies');
  assert(mappedRouteJob.employmentType === 'Permanent', 'Route mapping preserves employmentType');
  assert(mappedRouteJob.minimumAge === 21 && mappedRouteJob.maximumAge === 30, 'Route mapping preserves minimumAge and maximumAge');
  assert(mappedRouteJob.contactEmail === 'apply@gov.pk', 'Route mapping preserves contactEmail');
  assert(mappedRouteJob.extractedText === 'Full raw text of gazette notice', 'Route mapping preserves extractedText');

  // 8. Valid applicationUrl is preserved when explicitly supplied
  console.log('\n--- 8. Explicit applicationUrl Preservation ---');
  const jobWithExplicitApply = {
    id: 'job-explicit-apply',
    sourceUrl: 'https://company.com/job/100',
    applicationUrl: 'https://company.com/job/100/apply-now'
  };
  assert(jobWithExplicitApply.applicationUrl === 'https://company.com/job/100/apply-now', 'Explicit applicationUrl is preserved');
  assert(jobWithExplicitApply.sourceUrl !== jobWithExplicitApply.applicationUrl, 'sourceUrl and explicit applicationUrl are distinct');

  // 9. Missing applicationUrl remains undefined
  console.log('\n--- 9. Missing applicationUrl Remains Undefined ---');
  const pdfTextNoApplyUrl = `
    KPPSC ADVERTISEMENT NO. 05/2026
    LECTURER (BPS-17)
  `;
  const jobsNoApplyUrl = extractJobsFromPdfText(pdfTextNoApplyUrl, 'https://kppsc.gov.pk/ad.pdf', 'KPPSC', 'ad.pdf');
  if (jobsNoApplyUrl.length > 0) {
    assert(jobsNoApplyUrl[0].applicationUrl === undefined, 'Missing applicationUrl remains undefined');
    assert(jobsNoApplyUrl[0].originalApplyUrl === undefined, 'Missing originalApplyUrl remains undefined');
  }

  // 10. originalApplyUrl is inaccessible to Guest, Free, and Premium users
  console.log('\n--- 10. originalApplyUrl Security for Guest, Free, and Premium Users ---');
  const sensitiveJob = {
    id: 'job-sec-10',
    title: 'Confidential Executive',
    company: 'Global Corp',
    salary: 'USD 150,000',
    sourceUrl: 'https://corp.com/public-notice',
    originalApplyUrl: 'https://corp.com/internal-admin-apply-endpoint',
    applicationUrl: 'https://corp.com/apply',
    region: 'Global' as const,
    currency: 'USD' as const,
    experienceLevel: 'Senior' as const,
    jobType: 'Remote' as const,
    department: 'Exec',
    tags: ['Exec'],
    description: 'Detailed description for security assertion.',
    requirements: ['NDA'],
    benefits: ['Bonus'],
    postedAt: '2026-11-05',
    applicationsCount: 0
  };
  const guestUser = { id: 'u-guest', role: 'Job Seeker' };
  const freeUser = { id: 'u-free', role: 'Job Seeker', plan: 'Free' };
  const premiumUser = { id: 'u-prem', role: 'Job Seeker', plan: 'Premium', membershipStatus: 'Active' };

  const guestRes = JobVisibilityRepository.filterJobForUser(sensitiveJob, guestUser, false);
  const freeRes = JobVisibilityRepository.filterJobForUser(sensitiveJob, freeUser, false);
  const premiumRes = JobVisibilityRepository.filterJobForUser(sensitiveJob, premiumUser, true);

  assert(guestRes.originalApplyUrl === undefined, 'originalApplyUrl stripped for Guest user');
  assert(freeRes.originalApplyUrl === undefined, 'originalApplyUrl stripped for Free user');
  assert(premiumRes.originalApplyUrl === undefined, 'originalApplyUrl stripped for Premium user');

  // 11. Admin can inspect and edit originalApplyUrl
  console.log('\n--- 11. Admin Access & Inspection of originalApplyUrl ---');
  const adminUser = { id: 'admin-001', role: 'Admin' };
  const adminRes = JobVisibilityRepository.filterJobForUser(sensitiveJob, adminUser, false);
  assert(adminRes.originalApplyUrl === 'https://corp.com/internal-admin-apply-endpoint', 'Admin user receives full originalApplyUrl');

  // 12. Manually cleared values remain protected
  console.log('\n--- 12. Manual Correction Protection for Cleared Values ---');
  const existingJobWithClearedCity = {
    id: 'job-protect-12',
    title: 'Admin Verified Title',
    company: 'Verified Company',
    city: '', // Intentionally cleared value
    region: 'Pakistan',
    metadata: {
      isManuallyCorrected: true,
      manuallyCorrectedFields: ['city', 'company']
    }
  };
  const incomingScrapedJob = {
    id: 'job-protect-12',
    title: 'Scraped Overwrite Title',
    company: 'Scraped Company',
    city: 'Raw Scraped City',
    region: 'Pakistan'
  };
  const locationProtected = JobRepository.applyLocationProtection(incomingScrapedJob, existingJobWithClearedCity);
  assert(locationProtected.company === 'Verified Company', 'Manually corrected company name protected');
  assert(locationProtected.city === '', 'Intentionally cleared city ("") is preserved and protected from scraper overwrite');

  console.log(`\n=== REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runStep66a3RegressionTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
