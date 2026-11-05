import { extractJobsFromPdfText } from '../services/pdfParserEngine';
import { JobRepository } from '../db/repositories/JobRepository';
import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';

async function runStep66a3RegressionTests() {
  console.log('=== STARTING STEP 66-A.3 REGRESSION TESTS ===');
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

  // 1. Test PDF adapter extractedText forwarding & structured extraction mapping
  console.log('\n--- 1. Testing PDF Adapter Structured Extraction ---');
  const samplePdfText = `
    FEDERAL PUBLIC SERVICE COMMISSION
    CASE NO. F.4-150/2026-R
    DIRECTOR GENERAL (BPS-21)
    Total Vacancies: 5
    Employment Type: Permanent
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
    assert(Boolean(j.extractedText && j.extractedText.length > 20), 'extractedText is successfully forwarded and populated');
    assert(j.totalVacancies === 5, 'totalVacancies correctly parsed as 5');
    assert(j.employmentType === 'Permanent', 'employmentType correctly extracted');
    assert(Boolean(j.ageLimit), 'ageLimit correctly populated');
    assert(j.minimumAge === 32 && j.maximumAge === 45, 'minimumAge and maximumAge correctly parsed from age limit');
    assert(Boolean(j.qualificationSummary), 'qualificationSummary correctly populated');
    assert(Boolean(j.domicile), 'domicile correctly populated');
    assert(j.contactEmail === 'info@fpsc.gov.pk', 'contactEmail correctly extracted');
    assert(Array.isArray(j.advertisedPositions) && j.advertisedPositions.length > 0, 'advertisedPositions array populated');
  }

  // 2. Test URL Separation (sourceUrl vs applicationUrl vs originalApplyUrl)
  console.log('\n--- 2. Testing URL Separation ---');
  const testJobWithUrls = {
    id: 'test-url-sep-1',
    title: 'Software Engineer',
    company: 'TechCorp',
    sourceUrl: 'https://techcorp.com/source-page',
    originalApplyUrl: 'https://techcorp.com/apply-portal',
    applicationUrl: 'https://techcorp.com/apply-portal',
    region: 'Pakistan' as const,
    currency: 'PKR' as const,
    salary: 'PKR 100,000',
    experienceLevel: 'Mid' as const,
    jobType: 'On-site' as const,
    department: 'Engineering',
    tags: ['Tech'],
    description: 'Test job description with sufficient length for validation.',
    requirements: ['React', 'Node'],
    benefits: ['Health'],
    postedAt: '2026-11-05',
    applicationsCount: 0
  };

  assert(testJobWithUrls.sourceUrl !== testJobWithUrls.originalApplyUrl, 'sourceUrl is distinct from originalApplyUrl');
  assert(testJobWithUrls.originalApplyUrl === testJobWithUrls.applicationUrl, 'originalApplyUrl aligns with applicationUrl');

  // 3. Test Manual Correction Protection & Intentionally Cleared Values
  console.log('\n--- 3. Test Manual Correction Protection & Cleared Values ---');
  const existingRecord = {
    id: 'job-protect-1',
    title: 'Manually Corrected Title',
    company: 'Corrected Company',
    city: '', // Intentionally cleared value!
    region: 'Pakistan',
    metadata: {
      isManuallyCorrected: true,
      manuallyCorrectedFields: ['city', 'company']
    }
  };

  const incomingScrapedRecord = {
    id: 'job-protect-1',
    title: 'Scraped Title',
    company: 'Scraped Company',
    city: 'Raw Scraped City',
    region: 'Pakistan'
  };

  const protectedResult = JobRepository.applyLocationProtection(incomingScrapedRecord, existingRecord);
  assert(protectedResult.company === 'Corrected Company', 'Manually corrected company name is protected');
  assert(protectedResult.city === '', 'Intentionally cleared city value ("") is preserved and not overwritten by scraper');

  // 4. Test Guest / Premium / Admin Visibility Boundaries
  console.log('\n--- 4. Test Guest / Premium / Admin Visibility Boundaries ---');
  const sampleSensitiveJob = {
    id: 'job-vis-1',
    title: 'Secret Job',
    company: 'Enterprise',
    salary: 'USD 5,000',
    sourceUrl: 'https://enterprise.com/secret',
    originalApplyUrl: 'https://enterprise.com/apply',
    region: 'Global' as const,
    currency: 'USD' as const,
    experienceLevel: 'Senior' as const,
    jobType: 'Remote' as const,
    department: 'Executive',
    tags: ['Secret'],
    description: 'Secret job description for testing visibility policy boundaries.',
    requirements: ['NDA'],
    benefits: ['Stock'],
    postedAt: '2026-11-05',
    applicationsCount: 0,
    fieldVisibility: {
      salary: 'Premium',
      sourceUrl: 'Premium'
    }
  };

  const guestUser = { id: 'user-1', role: 'Job Seeker' };
  const filteredForGuest = JobVisibilityRepository.filterJobForUser(sampleSensitiveJob, guestUser, false);
  assert(filteredForGuest.salary === '🔒 Unlock with Premium Subscription', 'Sensitive salary is redacted for guest/free user');
  assert(filteredForGuest.sourceUrl === '🔒 Unlock with Premium Subscription', 'Sensitive sourceUrl is redacted for guest/free user');

  const adminUser = { id: 'admin-1', role: 'Admin' };
  const filteredForAdmin = JobVisibilityRepository.filterJobForUser(sampleSensitiveJob, adminUser, false);
  assert(filteredForAdmin.salary === 'USD 5,000', 'Sensitive salary is fully visible to Admin');
  assert(filteredForAdmin.sourceUrl === 'https://enterprise.com/secret', 'Sensitive sourceUrl is fully visible to Admin');

  console.log(`\n=== REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runStep66a3RegressionTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
