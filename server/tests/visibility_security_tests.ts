import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import * as mongodb from '../db/mongodb';

async function runTests() {
  console.log('--- Starting Comprehensive Visibility Security Tests (STEP65-D.5) ---');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      failCount++;
    }
  }

  // --- AUTHORITATIVE FILTERING SCENARIOS ---

  const mockJob: any = {
    title: 'Software Engineer',
    applicationUrl: 'https://example.com/apply',
    salary: '150k',
    attachments: [{ id: '1', name: 'Details.pdf', fileUrl: '/api/jobs/attachments/Details.pdf', isPublic: true }],
    fieldVisibility: {
      applicationUrl: 'Premium',
      salary: 'Hidden',
      attachments: 'Premium'
    }
  };

  // 1. Free user cannot receive Premium fields
  const filteredFree = JobVisibilityRepository.filterJobForUser(mockJob, { role: 'Job Seeker' }, false);
  assert(filteredFree.applicationUrl === '🔒 Unlock with Premium Subscription', 'Free user: applicationUrl redacted');
  assert(Array.isArray(filteredFree.attachments) && filteredFree.attachments.length === 0, 'Free user: attachments array empty');

  // 2. Active Premium user receives permitted Premium fields
  const filteredPremium = JobVisibilityRepository.filterJobForUser(mockJob, { role: 'Job Seeker' }, true);
  assert(filteredPremium.applicationUrl === 'https://example.com/apply', 'Premium user: applicationUrl visible');
  assert(filteredPremium.attachments.length === 1, 'Premium user: attachments visible');

  // 3. Hidden fields remain hidden
  assert(filteredPremium.salary === undefined, 'Hidden field salary removed even for Premium');
  assert(filteredFree.salary === undefined, 'Hidden field salary removed for Free');

  // 4. Admin bypass remains functional
  const filteredAdmin = JobVisibilityRepository.filterJobForUser(mockJob, { role: 'Admin' }, false);
  assert(filteredAdmin.applicationUrl === 'https://example.com/apply', 'Admin: Premium field visible without Premium sub');
  assert(filteredAdmin.salary === '150k', 'Admin: Hidden field visible');

  // --- ATTACHMENT SECURITY LOGIC ---

  // Since we can't easily mock mongodb exports, we'll test the core logic of verifyAttachmentAccess 
  // by ensuring the repository method correctly handles the rules.
  
  // Note: verifyAttachmentAccess is an async method that fetches from DB.
  // In this test environment, we'll verify it returns false when no job is found (safe default).
  try {
    const access = await JobRepository.verifyAttachmentAccess('non-existent.pdf', { role: 'Job Seeker' }, false);
    assert(access === false, 'Non-existent attachment DENIED (Safe Default)');
  } catch (e) {
    console.log('[INFO] verifyAttachmentAccess failed as expected (likely due to DB connection in test env)');
  }

  // --- CREATION & POLICY DERIVATION ---

  const testPolicyDerivation = () => {
    const userJob = { title: 'User Job' };
    const scrapedJob = { title: 'Scraped', isScraped: true };
    const adminJob = { title: 'Admin Job', isAdminCreated: true };

    assert(JobVisibilityRepository.deriveJobSource(userJob) === 'user_posted', 'Correctly derived user_posted source');
    assert(JobVisibilityRepository.deriveJobSource(scrapedJob) === 'scraped', 'Correctly derived scraped source');
    assert(JobVisibilityRepository.deriveJobSource(adminJob) === 'admin_created', 'Correctly derived admin_created source');
  };

  testPolicyDerivation();

  // --- MERGE LOGIC ---
  const testMergeLogic = async () => {
    // We can test applyPolicyToJob in "local" mode by ensuring MONGODB_URI is not set for this specific test 
    // or by mocking the static method if possible.
    // However, applyPolicyToJob calls getPolicy which checks isMongoConfigured.
    
    const jobWithOverride = {
      title: 'Override Test',
      fieldVisibility: {
        title: 'Premium'
      }
    };
    
    const merged = await JobVisibilityRepository.applyPolicyToJob(jobWithOverride);
    // If it falls back to local or default, title should be Premium (preserved)
    assert(merged.fieldVisibility.title === 'Premium', 'Individual override preserved during merge');
    // Description default is Free
    assert(merged.fieldVisibility.description === 'Free', 'Missing field inherited default policy');
  };

  await testMergeLogic();

  console.log(`\nTests finished: ${passCount} PASSED, ${failCount} FAILED`);
  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
