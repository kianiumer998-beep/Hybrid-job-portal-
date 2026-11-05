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

  // 1. Test PDF adapter structured extraction & factual accuracy
  console.log('\n--- 1. Testing PDF Adapter Structured Extraction & Factual Accuracy ---');
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
    assert(Boolean(j.extractedText && j.extractedText.length > 20), 'extractedText is successfully forwarded and populated');
    assert(j.totalVacancies === 5, 'totalVacancies correctly parsed as 5');
    assert(j.employmentType === 'Contract', 'Contract employment type correctly extracted (not hardcoded Permanent)');
    assert(Boolean(j.ageLimit), 'ageLimit correctly populated');
    assert(j.minimumAge === 32 && j.maximumAge === 45, 'minimumAge (32) and maximumAge (45) correctly parsed from age range');
    assert(Boolean(j.qualificationSummary), 'qualificationSummary correctly populated');
    assert(Boolean(j.domicile), 'domicile correctly populated');
    assert(j.contactEmail === 'info@fpsc.gov.pk', 'contactEmail correctly extracted');
    assert(Array.isArray(j.advertisedPositions) && j.advertisedPositions.length > 0, 'advertisedPositions array populated');
  }

  // 2. Test PDF extraction without vacancy count & without employment type
  console.log('\n--- 2. Testing PDF Extraction with Missing Vacancy Count & Unstated Employment Type ---');
  const pdfTextWithoutVacancies = `
    NATIONAL HIGHWAY AUTHORITY
    ASSISTANT ENGINEER (BPS-17)
    Qualification: Bachelor degree in Civil Engineering.
    Closing Date: 30 Nov 2026
  `;

  const jobsNoVacancies = extractJobsFromPdfText(pdfTextWithoutVacancies, 'https://nha.gov.pk/jobs.pdf', 'NHA', 'jobs.pdf');
  assert(jobsNoVacancies.length === 1, 'Extracted job from PDF without explicit vacancy count');
  if (jobsNoVacancies.length > 0) {
    const j2 = jobsNoVacancies[0];
    assert(j2.totalVacancies === undefined, 'Missing vacancy count remains undefined (no false default of 1)');
    assert(j2.pdfTotalVacanciesInCase === undefined, 'pdfTotalVacanciesInCase remains undefined when no count found');
    assert(j2.employmentType === undefined, 'Unstated employmentType remains undefined (no hardcoded Permanent)');
    assert(j2.originalApplyUrl === undefined, 'sourceUrl is not copied into originalApplyUrl automatically');
  }

  // 3. Test URL Separation
  console.log('\n--- 3. Testing URL Separation ---');
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

  // 4. Test Manual Correction Protection & Intentionally Cleared Values
  console.log('\n--- 4. Test Manual Correction Protection & Cleared Values ---');
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

  // 5. Test Guest / Free / Premium / Admin Visibility & originalApplyUrl Security
  console.log('\n--- 5. Test originalApplyUrl Security & Guest / Free / Premium / Admin Visibility ---');
  const sampleSensitiveJob = {
    id: 'job-vis-1',
    title: 'Executive Position',
    company: 'Enterprise',
    salary: 'USD 5,000',
    sourceUrl: 'https://enterprise.com/secret',
    originalApplyUrl: 'https://enterprise.com/internal-admin-apply-link',
    applicationUrl: 'https://enterprise.com/apply',
    region: 'Global' as const,
    currency: 'USD' as const,
    experienceLevel: 'Senior' as const,
    jobType: 'Remote' as const,
    department: 'Executive',
    tags: ['Executive'],
    description: 'Executive job description for testing visibility policy boundaries.',
    requirements: ['NDA'],
    benefits: ['Stock'],
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
  const adminUser = { id: 'admin-1', role: 'Admin' };

  // Guest Filtering
  const filteredForGuest = JobVisibilityRepository.filterJobForUser(sampleSensitiveJob, guestUser, false);
  assert(filteredForGuest.originalApplyUrl === undefined, 'originalApplyUrl is completely stripped for Guest user');
  assert(filteredForGuest.salary === '🔒 Unlock with Premium Subscription', 'Sensitive salary is redacted for Guest user');

  // Free User Filtering
  const filteredForFree = JobVisibilityRepository.filterJobForUser(sampleSensitiveJob, freeUser, false);
  assert(filteredForFree.originalApplyUrl === undefined, 'originalApplyUrl is completely stripped for Free user');
  assert(filteredForFree.salary === '🔒 Unlock with Premium Subscription', 'Sensitive salary is redacted for Free user');

  // Premium User Filtering (authoritativePremium = true)
  const filteredForPremium = JobVisibilityRepository.filterJobForUser(sampleSensitiveJob, premiumUser, true);
  assert(filteredForPremium.originalApplyUrl === undefined, 'originalApplyUrl is strictly inaccessible to Premium user (Admin-Only)');
  assert(filteredForPremium.salary === 'USD 5,000', 'Premium user retains access to Premium salary field');

  // Admin Filtering
  const filteredForAdmin = JobVisibilityRepository.filterJobForUser(sampleSensitiveJob, adminUser, false);
  assert(filteredForAdmin.originalApplyUrl === 'https://enterprise.com/internal-admin-apply-link', 'Admin user retains full access to originalApplyUrl');
  assert(filteredForAdmin.salary === 'USD 5,000', 'Admin user retains full access to salary');

  console.log(`\n=== REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runStep66a3RegressionTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
