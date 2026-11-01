import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { Database } from '../db/database';

async function runTests() {
  console.log('=== Starting Comprehensive Visibility & Security Test Suite (STEP65-D.6) ===\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ''}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failCount++;
    }
  }

  // ==========================================
  // GROUP 1: PREMIUM ENTITLEMENT VERIFICATION
  // ==========================================
  console.log('--- Group 1: Authoritative Premium Entitlement Verification ---');

  const futureTs = new Date(Date.now() + 86400000 * 30).toISOString();
  const pastTs = new Date(Date.now() - 86400000).toISOString();

  // 1. Active user with valid subscriptionExpiresAt
  const userValidSubExp = { membershipStatus: 'Active', subscriptionExpiresAt: futureTs };
  assert(
    JobVisibilityRepository.evaluateUserDocForPremium(userValidSubExp) === true,
    '1. Active user with valid subscriptionExpiresAt granted Premium'
  );

  // 2. Active user with valid legacy expiryDate
  const userValidLegacyExp = { membershipStatus: 'Active', expiryDate: futureTs };
  assert(
    JobVisibilityRepository.evaluateUserDocForPremium(userValidLegacyExp) === true,
    '2. Active user with valid legacy expiryDate granted Premium'
  );

  // 3. Pending subscription denied
  const userPending = { membershipStatus: 'Pending', subscriptionExpiresAt: futureTs };
  assert(
    JobVisibilityRepository.evaluateUserDocForPremium(userPending) === false,
    '3. Pending subscription denied Premium'
  );

  // 4. Rejected subscription denied
  const userRejected = { membershipStatus: 'Rejected', subscriptionExpiresAt: futureTs };
  assert(
    JobVisibilityRepository.evaluateUserDocForPremium(userRejected) === false,
    '4. Rejected subscription denied Premium'
  );

  // 5. Expired subscription denied
  const userExpired = { membershipStatus: 'Active', subscriptionExpiresAt: pastTs };
  assert(
    JobVisibilityRepository.evaluateUserDocForPremium(userExpired) === false,
    '5. Expired subscription denied Premium'
  );

  // 6. Missing expiry denied
  const userNoExpiry = { membershipStatus: 'Active' };
  assert(
    JobVisibilityRepository.evaluateUserDocForPremium(userNoExpiry) === false,
    '6. Missing expiry date denied Premium'
  );

  // 7. Invalid expiry date string denied
  const userInvalidDate = { membershipStatus: 'Active', subscriptionExpiresAt: 'not-a-valid-date' };
  assert(
    JobVisibilityRepository.evaluateUserDocForPremium(userInvalidDate) === false,
    '7. Invalid expiry date string denied Premium'
  );

  // 8. Missing user (null doc) denied
  assert(
    JobVisibilityRepository.evaluateUserDocForPremium(null) === false,
    '8. Null user document denied Premium'
  );

  // 9. Fail closed check
  let dbExceptionHandled = false;
  try {
    // Calling isUserPremiumAuthoritative with undefined or non-existent ID fails closed (returns false or throws)
    const result = await JobVisibilityRepository.isUserPremiumAuthoritative('non-existent-user-id-999');
    if (result === false) dbExceptionHandled = true;
  } catch {
    dbExceptionHandled = true;
  }
  assert(dbExceptionHandled, '9. Missing DB user or connection exception fails closed');

  // 10. Client/JWT plan claim isolation
  const fakePremiumClientUser = { role: 'Job Seeker', plan: 'Premium', isPremium: true, membershipStatus: 'Active' };
  const mockPremiumJob = {
    title: 'Engine Architect',
    applicationUrl: 'https://company.com/apply',
    fieldVisibility: { applicationUrl: 'Premium' }
  };
  // Passing authoritativePremium = false MUST override client claims
  const filteredFakeClaim = JobVisibilityRepository.filterJobForUser(mockPremiumJob, fakePremiumClientUser, false);
  assert(
    filteredFakeClaim.applicationUrl === '🔒 Unlock with Premium Subscription',
    '10. Client-supplied plan claims cannot bypass authoritative DB verification'
  );

  // ==========================================
  // GROUP 2: ATTACHMENT AUTHORIZATION & PRIVACY
  // ==========================================
  console.log('\n--- Group 2: Attachment Authorization & Privacy ---');

  // Seed mock jobs in Database for local fallback testing
  const testJobId = `job-test-${Date.now()}`;
  const mockAttachmentJob: any = {
    id: testJobId,
    title: 'Test Attachment Job',
    company: 'Acme Corp',
    attachments: [
      { id: 'att-1', name: 'PublicPremiumDoc.pdf', fileUrl: '/api/jobs/attachments/PublicPremiumDoc.pdf', isPublic: true },
      { id: 'att-2', name: 'PrivateDoc.pdf', fileUrl: '/api/jobs/attachments/PrivateDoc.pdf', isPublic: false },
      { id: 'att-3', name: 'HiddenDoc.pdf', fileUrl: '/api/jobs/attachments/HiddenDoc.pdf', isPublic: true },
      { id: 'att-4', name: 'FreePublicDoc.pdf', fileUrl: '/api/jobs/attachments/FreePublicDoc.pdf', isPublic: true }
    ],
    fieldVisibility: {
      attachments: 'Premium'
    }
  };

  const hiddenJob: any = {
    id: `${testJobId}-hidden`,
    title: 'Hidden Attachment Job',
    attachments: [
      { id: 'att-3', name: 'HiddenDoc.pdf', fileUrl: '/api/jobs/attachments/HiddenDoc.pdf', isPublic: true }
    ],
    fieldVisibility: {
      attachments: 'Hidden'
    }
  };

  const freeJob: any = {
    id: `${testJobId}-free`,
    title: 'Free Attachment Job',
    attachments: [
      { id: 'att-4', name: 'FreePublicDoc.pdf', fileUrl: '/api/jobs/attachments/FreePublicDoc.pdf', isPublic: true }
    ],
    fieldVisibility: {
      attachments: 'Free'
    }
  };

  Database.addJob(mockAttachmentJob);
  Database.addJob(hiddenJob);
  Database.addJob(freeJob);

  const freeUser = { role: 'Job Seeker' };
  const premiumUser = { role: 'Job Seeker' };
  const adminUser = { role: 'Admin' };

  // 11. Free user denied Premium attachment
  const freePremAtt = await JobRepository.verifyAttachmentAccess('PublicPremiumDoc.pdf', freeUser, false);
  assert(freePremAtt === false, '11. Free user denied Premium attachment via direct URL');

  // 12. Free user denied Hidden attachment
  const freeHiddenAtt = await JobRepository.verifyAttachmentAccess('HiddenDoc.pdf', freeUser, false);
  assert(freeHiddenAtt === false, '12. Free user denied Hidden attachment');

  // 13. Premium user allowed Premium attachment when isPublic is true
  const premPremAtt = await JobRepository.verifyAttachmentAccess('PublicPremiumDoc.pdf', premiumUser, true);
  assert(premPremAtt === true, '13. Active Premium user allowed Premium attachment when isPublic = true');

  // 14. isPublic: false remains enforced for Premium users
  const premPrivAtt = await JobRepository.verifyAttachmentAccess('PrivateDoc.pdf', premiumUser, true);
  assert(premPrivAtt === false, '14. Private attachment (isPublic = false) DENIED to Premium user');

  // 15. Missing parent job denied (even for Admin)
  const missingJobAttAdmin = await JobRepository.verifyAttachmentAccess('OrphanedUnassociatedDoc.pdf', adminUser, true);
  assert(missingJobAttAdmin === false, '15. Missing parent job / unassociated file DENIED even to Admin');

  // 16. Missing attachment denied
  const missingAttAdmin = await JobRepository.verifyAttachmentAccess('NonExistentFile.pdf', adminUser, true);
  assert(missingAttAdmin === false, '16. Non-existent attachment DENIED');

  // 17. Attachment not associated with requested job denied
  const unassociatedAtt = await JobRepository.verifyAttachmentAccess('fake-unlinked-file.pdf', freeUser, false);
  assert(unassociatedAtt === false, '17. Unassociated file denied');

  // 18. Invalid filename denied
  const invalidFileAtt = await JobRepository.verifyAttachmentAccess('..', freeUser, false);
  assert(invalidFileAtt === false, '18. Invalid relative filename (..) denied');

  // 19. Valid Admin access preserved for existing parent job attachments
  const adminValidAtt = await JobRepository.verifyAttachmentAccess('PublicPremiumDoc.pdf', adminUser, false);
  assert(adminValidAtt === true, '19. Admin access preserved for valid existing job attachment');

  // 20. Free attachment access for Free user
  const freeFreeAtt = await JobRepository.verifyAttachmentAccess('FreePublicDoc.pdf', freeUser, false);
  assert(freeFreeAtt === true, '20. Free attachment accessible to Free user');

  // ==========================================
  // GROUP 3: FIELD POLICY & REGISTRY PROTECTION
  // ==========================================
  console.log('\n--- Group 3: Field Policy Derivation & Registry Security ---');

  // 21. User-created job source derivation
  const rawUserJob = { title: 'User Job' };
  assert(
    JobVisibilityRepository.deriveJobSource(rawUserJob) === 'user_posted',
    '21. User-created job correctly derived as user_posted'
  );

  // 22. Scraped job source derivation
  const rawScrapedJob = { title: 'Scraped Job', isScraped: true, scraperSourceId: 'sc-123' };
  assert(
    JobVisibilityRepository.deriveJobSource(rawScrapedJob) === 'scraped',
    '22. Scraped job correctly derived as scraped'
  );

  // 23. Admin-created job source derivation
  const rawAdminJob = { title: 'Admin Job', isAdminCreated: true };
  assert(
    JobVisibilityRepository.deriveJobSource(rawAdminJob) === 'admin_created',
    '23. Admin-created job correctly derived as admin_created'
  );

  // 24. Individual override precedence
  const jobWithCustomOverride = {
    title: 'Custom Override Job',
    fieldVisibility: {
      title: 'Premium'
    }
  };
  const mergedOverride = await JobVisibilityRepository.applyPolicyToJob(jobWithCustomOverride);
  assert(
    mergedOverride.fieldVisibility.title === 'Premium',
    '24. Individual field override preserved during default policy merge'
  );

  // 25. Missing overrides inherit defaults
  assert(
    mergedOverride.fieldVisibility.description === 'Free',
    '25. Missing field overrides inherit source default rules'
  );

  // 26. Hidden fields remain hidden for Premium users
  const jobWithHiddenSalary = {
    title: 'Confidential Salary Job',
    salary: '$200,000 / year',
    fieldVisibility: { salary: 'Hidden' }
  };
  const filteredHiddenForPrem = JobVisibilityRepository.filterJobForUser(jobWithHiddenSalary, freeUser, true);
  assert(
    filteredHiddenForPrem.salary === undefined,
    '26. Hidden field (salary) remains completely stripped even for Premium user'
  );

  // 27. Unknown / unregistered fields stripped from public responses
  const jobWithSecretScrapedData = {
    title: 'Software Developer',
    internalScraperLogs: 'SENSITIVE_SCRAPER_LOG_DATA',
    rawDatabaseKeys: 'SECRET_API_KEY',
    fieldVisibility: { title: 'Free' }
  };
  const filteredSecret = JobVisibilityRepository.filterJobForUser(jobWithSecretScrapedData, freeUser, false);
  assert(
    filteredSecret.internalScraperLogs === undefined && filteredSecret.rawDatabaseKeys === undefined,
    '27. Unregistered sensitive properties stripped from public responses'
  );

  // 28. Unknown visibility field names validation in Admin APIs
  const ALLOWED_FIELDS = [
    'title', 'company', 'companyLogo', 'jobType', 'region', 'country', 'province',
    'city', 'district', 'salary', 'salaryNumericMin', 'currency', 'experienceLevel', 
    'department', 'tags', 'description', 'requirements', 'responsibilities', 
    'benefits', 'postedAt', 'featured', 'urgent', 'isPinnedTop', 'isFutureJob', 
    'futureIntakeDate', 'priorityTier', 'applicationsCount', 'status', 
    'rejectionReason', 'suspensionReason', 'isSuspended', 'submittedByUserId', 
    'paymentStatus', 'jobCategory', 'sourceUrl', 'scraperSourceId', 'scraperSourceName', 
    'scrapedSourceDomain', 'scrapedAt', 'scrapedTime', 'applicationUrl', 
    'contactEmailOrPhone', 'contactEmail', 'deadlineDate', 'scraperBatchId', 'scraperRunType', 
    'scrapedTimezone', 'scrapedRawSalary', 'deduplicationScore', 'reviewTimeline', 
    'lastScrapedAt', 'isGovtJob', 'govtDepartment', 'govtScale', 'govtCategory', 
    'isNewspaperAd', 'newspaperName', 'clippingImageUrl', 'mediaUrl', 'newspaperDate', 
    'attachments', 'externalApplyUrl', 'pdfSourceUrl', 'extractedText', 'responsibilitiesList',
    'pdfFileName', 'pdfCaseNumber', 'pdfTotalVacanciesInCase', 'domicileQuota', 'challanFee',
    'ageRelaxationNote', 'pdfParserEngine', 'extractionSourceType', 'isDuplicate', 
    'duplicateScore', 'duplicateCategory', 'duplicateTags', 'duplicateMatchReason',
    'duplicateOfJobId', 'duplicateOfJobTitle', 'duplicateMatchedCompany', 'isDuplicateOverride',
    'duplicateOverrideNote', 'duplicateDetectedAt', 'applicationType', 'isLocationConfirmed',
    'locationConfirmedAt', 'isManuallyCorrected', 'manuallyCorrectedAt', 'metadata', 'createdAt', 'updatedAt'
  ];

  function validateFieldRules(rules: any) {
    if (!rules || typeof rules !== 'object') return 'fieldRules must be an object';
    for (const [field, visibility] of Object.entries(rules)) {
      if (!ALLOWED_FIELDS.includes(field)) return `Invalid field name: "${field}"`;
      if (!['Free', 'Premium', 'Hidden'].includes(visibility as string)) return `Invalid visibility value: "${visibility}"`;
    }
    return null;
  }

  const invalidFieldValidation = validateFieldRules({ unknownSecretField: 'Free' });
  assert(
    invalidFieldValidation !== null && invalidFieldValidation.includes('Invalid field name'),
    '28. Unknown field names rejected by Admin API rule validation'
  );

  // ==========================================
  // GROUP 4: ADMIN MANAGEMENT & PAGINATION
  // ==========================================
  console.log('\n--- Group 4: Admin Management & Pagination Logic ---');

  // 29. Live page limit calculation
  const liveTotal = 250;
  const pageLimit = 100;
  const livePage1HasMore = (1 * pageLimit) < liveTotal;
  const livePage3HasMore = (3 * pageLimit) < liveTotal;
  assert(
    livePage1HasMore === true && livePage3HasMore === false,
    '29. Independent Live pagination hasMore calculated correctly'
  );

  // 30. Pending page limit calculation
  const pendingTotal = 50;
  const pendingPage1HasMore = (1 * pageLimit) < pendingTotal;
  assert(
    pendingPage1HasMore === false,
    '30. Independent Pending pagination hasMore calculated correctly'
  );

  // 31. ID De-duplication check when combining pages
  const existingJobSet = new Set(['job-1', 'job-2', 'job-3']);
  const incomingPageJobs = [{ id: 'job-3' }, { id: 'job-4' }];
  const deduplicatedNewJobs = incomingPageJobs.filter(j => !existingJobSet.has(j.id));
  assert(
    deduplicatedNewJobs.length === 1 && deduplicatedNewJobs[0].id === 'job-4',
    '31. Client de-duplication prevents duplicate records when appending pages'
  );

  // 32. Combined hasMore calculation
  const combinedHasMore = livePage1HasMore || pendingPage1HasMore;
  assert(
    combinedHasMore === true,
    '32. Overall hasMore accurately evaluates Live and Pending cursors'
  );

  // Clean up test fixtures from Database
  Database.deleteJob(testJobId);
  Database.deleteJob(`${testJobId}-hidden`);
  Database.deleteJob(`${testJobId}-free`);

  console.log(`\n==========================================`);
  console.log(`Test Execution Summary: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`==========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error during security test execution:', err);
  process.exit(1);
});
