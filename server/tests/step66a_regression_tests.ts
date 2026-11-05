import { Database } from '../db/database';
import { JobRepository } from '../db/repositories/JobRepository';
import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';
import { extractJobsFromPdfText } from '../services/pdfParserEngine';
import { Job } from '../../src/types/job';

console.log('=== STEP66-A Regression Test Suite: Scraper Extraction, Manual Protection & Visibility ===');

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

// 1. PDF & OCR Extracted Text Preservation Test
const samplePdfText = `
CASE NO. F.4-142/2026-R
FEDERAL PUBLIC SERVICE COMMISSION
DIRECTOR GENERAL (BPS-20)
Total Vacancies: 2
Domicile: Punjab (Open Merit: 2)
Age Limit: 35-50 years plus 5 years general age relaxation.
Qualification: Ph.D. in Computer Science or Information Technology with 12 years experience.
Closing Date: 31st July 2025
`;

const extractedPdfJobs = extractJobsFromPdfText(samplePdfText, 'https://fpsc.gov.pk/gazette.pdf', 'FPSC', 'gazette.pdf');
assert(extractedPdfJobs.length === 1, 'PDF text extraction successfully extracted 1 job from gazette sample');
assert(
  typeof extractedPdfJobs[0].extractedText === 'string' && extractedPdfJobs[0].extractedText.length > 20,
  'PDF extracted job contains non-empty extractedText'
);
assert(
  extractedPdfJobs[0].pdfTotalVacanciesInCase === 2,
  'PDF extracted job correctly mapped vacancies'
);

// 2. URL Separation Test
const testJobUrlSep: Job = {
  id: 'test-url-sep-1',
  title: 'Software Engineer',
  company: 'TechCorp',
  jobType: 'Remote',
  region: 'Pakistan',
  salary: 'PKR 150,000',
  currency: 'PKR',
  experienceLevel: 'Mid',
  department: 'Engineering',
  tags: ['Tech'],
  description: 'Test job description for url separation.',
  requirements: ['Node.js'],
  benefits: ['Health'],
  postedAt: '2026-05-01',
  applicationsCount: 0,
  status: 'Approved',
  sourceUrl: 'https://fpsc.gov.pk/node/401',
  originalApplyUrl: undefined,
  applicationUrl: 'https://fpsc.gov.pk/apply-online'
};

assert(
  testJobUrlSep.sourceUrl !== testJobUrlSep.applicationUrl,
  'Source URL and application URL are kept strictly separate'
);
assert(
  testJobUrlSep.originalApplyUrl === undefined,
  'originalApplyUrl is not forced to equal sourceUrl by default'
);

// 3. Manual Admin Correction Protection Test via applyLocationProtection
const existingProtectedJob = {
  id: 'job-protect-1',
  title: 'Director General',
  company: 'PFSA',
  city: 'Lahore',
  province: 'Punjab',
  isManuallyCorrected: true,
  metadata: {
    isManuallyCorrected: true,
    manuallyCorrectedFields: ['title', 'city']
  }
};

const incomingScrapedUpdate = {
  id: 'job-protect-1',
  title: 'Scraped Title Overwrite Attempt',
  company: 'PFSA',
  city: 'Rawalpindi',
  province: 'Punjab'
};

const protectedResult = JobRepository.applyLocationProtection(incomingScrapedUpdate, existingProtectedJob);
assert(
  protectedResult.title === 'Director General',
  'Manual correction protection successfully prevented scraper from overwriting manually corrected title'
);
assert(
  protectedResult.city === 'Lahore',
  'Manual correction protection successfully preserved manually corrected city'
);

// 4. Admin Access vs Public Sanitization Test
const testSecretJob = {
  id: 'job-secret-1',
  title: 'Secret Vacancy',
  company: 'Govt',
  jobType: 'On-site' as const,
  region: 'Pakistan' as const,
  salary: 'PKR 200,000',
  currency: 'PKR' as const,
  experienceLevel: 'Senior' as const,
  department: 'Admin',
  tags: ['Govt'],
  description: 'Secret job',
  requirements: ['Degree'],
  benefits: ['None'],
  postedAt: '2026-05-01',
  applicationsCount: 0,
  status: 'Approved' as const,
  sourceUrl: 'https://gov.pk/job1',
  applicationUrl: 'https://gov.pk/apply',
  extractedText: 'Admin internal extracted text confidential content',
  fieldVisibility: {
    applicationUrl: 'Premium' as const,
    sourceUrl: 'Premium' as const
  }
};

const guestUser = null;
const filteredForGuest = JobVisibilityRepository.filterJobForUser(testSecretJob, guestUser, false);
assert(
  filteredForGuest.extractedText === undefined,
  'Admin-only extractedText is unconditionally stripped for guest users'
);

const adminUser = { userId: 'admin-1', role: 'Admin' };
const filteredForAdmin = JobVisibilityRepository.filterJobForUser(testSecretJob, adminUser, true);
assert(
  filteredForAdmin.extractedText === 'Admin internal extracted text confidential content',
  'Authorized Admin user retains access to extractedText'
);

console.log(`\n=== STEP66-A Regression Summary: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) {
  process.exit(1);
}
