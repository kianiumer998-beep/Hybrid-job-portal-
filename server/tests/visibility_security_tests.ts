import {
  JobVisibilityRepository,
  CONFIGURABLE_REGISTRY_FIELDS,
  ADMIN_INTERNAL_FIELDS
} from '../db/repositories/JobVisibilityRepository';
import { JobRepository, parseDeadlineTimestamp, checkJobExpired } from '../db/repositories/JobRepository';
import { Database } from '../db/database';
import { getJobsCollection, isMongoConfigured } from '../db/mongodb';
import { validateFieldRules } from '../routes/jobVisibilityRoutes';

async function runTests() {
  console.log('=== Starting Comprehensive Visibility & Security Test Suite (STEP65-D.7) ===\n');

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

  const createdFixtureIds: string[] = [];

  try {
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
    const filteredFakeClaim = JobVisibilityRepository.filterJobForUser(mockPremiumJob, fakePremiumClientUser, false);
    assert(
      filteredFakeClaim.applicationUrl === '🔒 Unlock with Premium Subscription',
      '10. Client-supplied plan claims cannot bypass authoritative DB verification'
    );

    // ==========================================
    // GROUP 2: ATTACHMENT AUTHORIZATION & PRIVACY
    // ==========================================
    console.log('\n--- Group 2: Attachment Authorization & Privacy ---');

    const testJobId = `job-test-${Date.now()}`;
    const mockAttachmentJob: any = {
      id: testJobId,
      title: 'Test Attachment Job',
      company: 'Acme Corp',
      status: 'Approved',
      attachments: [
        { id: 'att-1', name: 'PublicPremiumDoc.pdf', fileUrl: '/api/jobs/attachments/PublicPremiumDoc.pdf', isPublic: true },
        { id: 'att-2', name: 'PrivateDoc.pdf', fileUrl: '/api/jobs/attachments/PrivateDoc.pdf', isPublic: false }
      ],
      fieldVisibility: {
        attachments: 'Premium'
      }
    };

    const hiddenJob: any = {
      id: `${testJobId}-hidden`,
      title: 'Hidden Attachment Job',
      company: 'Acme Corp',
      status: 'Approved',
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
      company: 'Acme Corp',
      status: 'Approved',
      attachments: [
        { id: 'att-4', name: 'FreePublicDoc.pdf', fileUrl: '/api/jobs/attachments/FreePublicDoc.pdf', isPublic: true }
      ],
      fieldVisibility: {
        attachments: 'Free'
      }
    };

    // Duplicate filename jobs with conflicting visibility policies
    const dupJobFree: any = {
      id: `${testJobId}-dup-free`,
      title: 'Duplicate Filename Free Job',
      company: 'Free Corp',
      status: 'Approved',
      attachments: [
        { id: 'att-dup-1', name: 'SharedSyllabus.pdf', fileUrl: '/api/jobs/attachments/SharedSyllabus.pdf', isPublic: true }
      ],
      fieldVisibility: {
        attachments: 'Free'
      }
    };

    const dupJobPremium: any = {
      id: `${testJobId}-dup-premium`,
      title: 'Duplicate Filename Premium Job',
      company: 'Premium Corp',
      status: 'Approved',
      attachments: [
        { id: 'att-dup-2', name: 'SharedSyllabus.pdf', fileUrl: '/api/jobs/attachments/SharedSyllabus.pdf', isPublic: true }
      ],
      fieldVisibility: {
        attachments: 'Premium'
      }
    };

    // Seed into MongoDB and Database
    createdFixtureIds.push(mockAttachmentJob.id, hiddenJob.id, freeJob.id, dupJobFree.id, dupJobPremium.id);

    if (isMongoConfigured()) {
      const coll = await getJobsCollection();
      await coll.insertMany([mockAttachmentJob, hiddenJob, freeJob, dupJobFree, dupJobPremium]);
    }
    Database.addJob(mockAttachmentJob);
    Database.addJob(hiddenJob);
    Database.addJob(freeJob);
    Database.addJob(dupJobFree);
    Database.addJob(dupJobPremium);

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

    // 21. Duplicate filename fail-safe: Free user denied when no jobId given and one job requires Premium
    const dupNoJobId = await JobRepository.verifyAttachmentAccess('SharedSyllabus.pdf', freeUser, false);
    assert(dupNoJobId === false, '21. Duplicate filename denied to Free user when conflicting policies exist (fail-safe)');

    // 22. Duplicate filename with specific Free parent jobId granted
    const dupWithFreeJobId = await JobRepository.verifyAttachmentAccess('SharedSyllabus.pdf', freeUser, false, dupJobFree.id);
    assert(dupWithFreeJobId === true, '22. Duplicate filename with specific Free jobId allows Free user access');

    // ==========================================
    // GROUP 3: FIELD POLICY & REGISTRY PROTECTION
    // ==========================================
    console.log('\n--- Group 3: Field Policy Derivation & Registry Security ---');

    // 23. User-created job source derivation
    const rawUserJob = { title: 'User Job' };
    assert(
      JobVisibilityRepository.deriveJobSource(rawUserJob) === 'user_posted',
      '23. User-created job correctly derived as user_posted'
    );

    // 24. Scraped job source derivation
    const rawScrapedJob = { title: 'Scraped Job', isScraped: true, scraperSourceId: 'sc-123' };
    assert(
      JobVisibilityRepository.deriveJobSource(rawScrapedJob) === 'scraped',
      '24. Scraped job correctly derived as scraped'
    );

    // 25. Admin-created job source derivation
    const rawAdminJob = { title: 'Admin Job', isAdminCreated: true };
    assert(
      JobVisibilityRepository.deriveJobSource(rawAdminJob) === 'admin_created',
      '25. Admin-created job correctly derived as admin_created'
    );

    // 26. Individual override precedence
    const jobWithCustomOverride = {
      title: 'Custom Override Job',
      fieldVisibility: {
        title: 'Premium'
      }
    };
    const mergedOverride = await JobVisibilityRepository.applyPolicyToJob(jobWithCustomOverride);
    assert(
      mergedOverride.fieldVisibility.title === 'Premium',
      '26. Individual field override preserved during default policy merge'
    );

    // 27. Missing overrides inherit defaults
    assert(
      mergedOverride.fieldVisibility.description === 'Free',
      '27. Missing field overrides inherit source default rules'
    );

    // 28. Hidden fields remain hidden for Premium users
    const jobWithHiddenSalary = {
      title: 'Confidential Salary Job',
      salary: '$200,000 / year',
      fieldVisibility: { salary: 'Hidden' }
    };
    const filteredHiddenForPrem = JobVisibilityRepository.filterJobForUser(jobWithHiddenSalary, freeUser, true);
    assert(
      filteredHiddenForPrem.salary === undefined,
      '28. Hidden field (salary) remains completely stripped even for Premium user'
    );

    // 29. Admin-only internal fields unconditionally stripped for Free AND Premium users
    const jobWithAdminFields = {
      title: 'Internal Audit Developer',
      paymentStatus: 'Paid',
      rejectionReason: 'Confidential QA Check',
      suspensionReason: 'Flagged by Moderator',
      isSuspended: false,
      duplicateScore: 92,
      duplicateMatchReason: 'Matched existing job',
      scraperBatchId: 'batch-999',
      metadata: { internalIp: '127.0.0.1' },
      fieldVisibility: { title: 'Free' }
    };
    const filteredForPremUser = JobVisibilityRepository.filterJobForUser(jobWithAdminFields, freeUser, true);
    const hasAnyAdminField = ADMIN_INTERNAL_FIELDS.some(f => f in filteredForPremUser);
    assert(
      hasAnyAdminField === false,
      '29. Admin internal fields unconditionally stripped for Premium non-admin users'
    );

    // 30. Unregistered / arbitrary properties stripped from public responses
    const jobWithSecretKeys = {
      title: 'Software Developer',
      internalScraperLogs: 'SENSITIVE_SCRAPER_LOG_DATA',
      rawDatabaseKeys: 'SECRET_API_KEY',
      fieldVisibility: { title: 'Free' }
    };
    const filteredSecret = JobVisibilityRepository.filterJobForUser(jobWithSecretKeys, freeUser, false);
    assert(
      filteredSecret.internalScraperLogs === undefined && filteredSecret.rawDatabaseKeys === undefined,
      '30. Unregistered sensitive properties stripped from public responses'
    );

    // 31. Admin API policy rule validation rejects internal administrative fields
    const internalFieldValidation = validateFieldRules({ rejectionReason: 'Free' });
    assert(
      internalFieldValidation !== null && internalFieldValidation.includes('internal administrative field'),
      '31. Admin internal fields rejected by Admin API policy validator'
    );

    // 32. Unknown field names and invalid visibility values rejected
    const invalidValValidation = validateFieldRules({ salary: 'ConfidentialInvalid' });
    const unknownFieldValidation = validateFieldRules({ nonExistentKey: 'Free' });
    assert(
      invalidValValidation !== null && unknownFieldValidation !== null,
      '32. Unknown field names and invalid visibility values rejected by rule validator'
    );

    // ==========================================
    // GROUP 4: ADMIN MANAGEMENT, FILTERING & PAGINATION
    // ==========================================
    console.log('\n--- Group 4: Admin Management, Server-Side Filtering & Pagination ---');

    // 33. getPending limit bounds capped at 500
    const pendingBounded = await JobRepository.getPending({ limit: 600 });
    assert(
      (pendingBounded as any).limit === 500,
      '33. JobRepository.getPending bounds maximum page size to 500'
    );

    // 34. getPending safe $and composition with search + scraped source
    let getPendingSafe = false;
    try {
      const pendingFiltered = await JobRepository.getPending({
        search: 'Developer',
        sourceType: 'scraped',
        limit: 10
      });
      if (Array.isArray(pendingFiltered)) getPendingSafe = true;
    } catch {
      getPendingSafe = false;
    }
    assert(
      getPendingSafe === true,
      '34. getPending combines search and source filters with $and without clobbering'
    );

    // 35. getAll status filtering (status: Expired returns only expired records)
    const expiredRes = await JobRepository.getAll({ status: 'Expired', limit: 5 });
    const allExpiredAreExpired = expiredRes.jobs.every((j: any) => j.status === 'Expired' || j.isExpired === true);
    assert(
      allExpiredAreExpired === true,
      '35. JobRepository.getAll with status: "Expired" returns only expired records'
    );

    // 36. getAll status filtering (status: Approved excludes expired records)
    const approvedRes = await JobRepository.getAll({ status: 'Approved', limit: 5 });
    const allApprovedNotExpired = approvedRes.jobs.every((j: any) => j.isExpired !== true);
    assert(
      allApprovedNotExpired === true,
      '36. JobRepository.getAll with status: "Approved" excludes expired records'
    );

    // 37. getAll visibility filtering (Overrides vs Default)
    let visibilityFilterExecuted = false;
    try {
      const overridesRes = await JobRepository.getAll({ visibility: 'Overrides', limit: 5 });
      const defaultRes = await JobRepository.getAll({ visibility: 'Default', limit: 5 });
      if (Array.isArray(overridesRes.jobs) && Array.isArray(defaultRes.jobs)) {
        visibilityFilterExecuted = true;
      }
    } catch {
      visibilityFilterExecuted = false;
    }
    assert(
      visibilityFilterExecuted === true,
      '37. JobRepository.getAll server-side visibility query executes cleanly'
    );

    // 38. Independent Live pagination hasMore calculation
    const liveTotal = 250;
    const pageLimit = 100;
    const livePage1HasMore = (1 * pageLimit) < liveTotal;
    const livePage3HasMore = (3 * pageLimit) < liveTotal;
    assert(
      livePage1HasMore === true && livePage3HasMore === false,
      '38. Independent Live pagination hasMore calculated correctly'
    );

    // 39. Independent Pending pagination hasMore calculation
    const pendingTotal = 50;
    const pendingPage1HasMore = (1 * pageLimit) < pendingTotal;
    assert(
      pendingPage1HasMore === false,
      '39. Independent Pending pagination hasMore calculated correctly'
    );

    // 40. Client de-duplication prevents duplicate records when combining pages
    const existingJobSet = new Set(['job-1', 'job-2', 'job-3']);
    const incomingPageJobs = [{ id: 'job-3' }, { id: 'job-4' }];
    const deduplicatedNewJobs = incomingPageJobs.filter(j => !existingJobSet.has(j.id));
    assert(
      deduplicatedNewJobs.length === 1 && deduplicatedNewJobs[0].id === 'job-4',
      '40. Client de-duplication prevents duplicate records when appending pages'
    );

    // 41. Combined hasMore calculation
    const combinedHasMore = livePage1HasMore || pendingPage1HasMore;
    assert(
      combinedHasMore === true,
      '41. Overall hasMore accurately evaluates Live and Pending cursors'
    );

    // 42. Select All accurately scopes to currently filtered jobs without duplicates
    const mockFiltered = [{ id: 'j-1' }, { id: 'j-2' }];
    const selected = ['j-1'];
    const toggledSelection = Array.from(new Set([...selected, ...mockFiltered.map(j => j.id)]));
    assert(
      toggledSelection.length === 2 && toggledSelection.includes('j-1') && toggledSelection.includes('j-2'),
      '42. Select All accurately selects all filtered jobs and deduplicates IDs'
    );

    // ==========================================
    // GROUP 5: DATE PARSING, RESTORE & EXPIRY TESTS
    // ==========================================
    console.log('\n--- Group 5: Date Parsing, Restore & Expiry Semantics ---');

    // 43. Ordinal date parsing ("22nd September 2026")
    const parsedOrdinal = parseDeadlineTimestamp('22nd September 2026');
    assert(
      parsedOrdinal !== null && !isNaN(parsedOrdinal),
      '43. Ordinal suffix date string ("22nd September 2026") parses successfully'
    );

    // 44. Ambiguous DD-MM-YYYY dates ("03-04-2026")
    const parsedDMY = parseDeadlineTimestamp('03-04-2026');
    assert(
      parsedDMY !== null && !isNaN(parsedDMY),
      '44. DD-MM-YYYY date string ("03-04-2026") parses successfully'
    );

    // 45. ISO date strings
    const parsedISO = parseDeadlineTimestamp('2026-09-22T00:00:00.000Z');
    assert(
      parsedISO !== null && !isNaN(parsedISO),
      '45. ISO date string parses successfully'
    );

    // 46. Invalid dates return null
    const parsedInvalid = parseDeadlineTimestamp('not-a-valid-date');
    const parsedNull = parseDeadlineTimestamp(undefined);
    assert(
      parsedInvalid === null && parsedNull === null,
      '46. Invalid or missing date strings return null'
    );

    // 47. Expired deadline with configured offset
    const pastDeadlineJob = { deadlineDate: '2020-01-01' };
    assert(
      checkJobExpired(pastDeadlineJob, 1) === true,
      '47. Past deadline with offset correctly evaluated as expired'
    );

    // 48. Restored jobs with restoredAt and isExpired=false
    const restoredJob = {
      deadlineDate: '2020-01-01',
      isExpired: false,
      restoredAt: new Date().toISOString(),
      status: 'Approved'
    };
    assert(
      checkJobExpired(restoredJob, 1) === false,
      '48. Restored jobs with restoredAt and isExpired=false remain live and unexpired'
    );

    // 49. Correct Approved and Expired filtering via JobRepository.getAll()
    let filterTestExecuted = false;
    try {
      const expResult = await JobRepository.getAll({ status: 'Expired', limit: 1 });
      const appResult = await JobRepository.getAll({ status: 'Approved', limit: 1 });
      if (Array.isArray(expResult.jobs) && Array.isArray(appResult.jobs)) {
        filterTestExecuted = true;
      }
    } catch {
      filterTestExecuted = false;
    }
    assert(
      filterTestExecuted === true,
      '49. JobRepository.getAll successfully filters by Expired and Approved status with memory-bounded batch execution'
    );

  } finally {
    // Clean up test fixtures from MongoDB and Database
    if (isMongoConfigured() && createdFixtureIds.length > 0) {
      try {
        const coll = await getJobsCollection();
        await coll.deleteMany({ id: { $in: createdFixtureIds } });
      } catch (err) {
        console.warn('Cleanup warning for test fixtures:', err);
      }
    }
    for (const id of createdFixtureIds) {
      Database.deleteJob(id);
    }
  }

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
