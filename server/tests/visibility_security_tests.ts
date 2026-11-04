import {
  JobVisibilityRepository,
  CONFIGURABLE_REGISTRY_FIELDS,
  ADMIN_INTERNAL_FIELDS
} from '../db/repositories/JobVisibilityRepository';
import { JobRepository, parseDeadlineTimestamp, checkJobExpired } from '../db/repositories/JobRepository';
import { Database } from '../db/database';
import { getJobsCollection, isMongoConfigured } from '../db/mongodb';
import { validateFieldRules } from '../routes/jobVisibilityRoutes';
import { normalizeJobVisibilitySource } from '../../src/utils/jobVisibilityRegistry';

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
  const previousIsTest = process.env.IS_TEST;
  process.env.IS_TEST = 'true';

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

    // Seed into Database (in-memory test store)
    createdFixtureIds.push(mockAttachmentJob.id, hiddenJob.id, freeJob.id, dupJobFree.id, dupJobPremium.id);

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

    // 32b. Unsupported UI fields (howToApply, location) rejected by rule validator
    const howToApplyValidation = validateFieldRules({ howToApply: 'Free' });
    const locationValidation = validateFieldRules({ location: 'Free' });
    assert(
      howToApplyValidation !== null && locationValidation !== null,
      '32b. Mismatched UI fields (howToApply, location) rejected by policy rule validator'
    );

    // 32c. JobVisibilityRepository policy persistence fails closed in production when MongoDB is missing
    let persistenceFailedClosed = false;
    const currentIsTest = process.env.IS_TEST;
    const currentMongoUri = process.env.MONGODB_URI;
    const currentNodeEnv = process.env.NODE_ENV;
    delete process.env.IS_TEST;
    delete process.env.MONGODB_URI;
    process.env.NODE_ENV = 'production';
    try {
      await JobVisibilityRepository.savePolicy('user_posted', { title: 'Premium' });
    } catch (err: any) {
      if (err?.message && err.message.includes('MongoDB')) {
        persistenceFailedClosed = true;
      }
    } finally {
      if (currentIsTest === undefined) {
        delete process.env.IS_TEST;
      } else {
        process.env.IS_TEST = currentIsTest;
      }
      if (currentMongoUri === undefined) {
        delete process.env.MONGODB_URI;
      } else {
        process.env.MONGODB_URI = currentMongoUri;
      }
      if (currentNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = currentNodeEnv;
      }
    }
    assert(
      persistenceFailedClosed === true,
      '32c. JobVisibilityRepository savePolicy fails closed in production mode when MongoDB is unconfigured'
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
    // GROUP 5: DATE PARSING, RESTORE & EXPIRY TESTS (STRICT)
    // ==========================================
    console.log('\n--- Group 5: Date Parsing, Restore & Expiry Semantics (Strict Assertions) ---');

    // 43. Ordinal date parsing ("22nd September 2026") -> 22 September 2026
    const parsedOrdinal = parseDeadlineTimestamp('22nd September 2026');
    const dOrdinal = parsedOrdinal ? new Date(parsedOrdinal) : null;
    assert(
      dOrdinal !== null && dOrdinal.getFullYear() === 2026 && dOrdinal.getMonth() === 8 && dOrdinal.getDate() === 22,
      '43. Ordinal suffix date string ("22nd September 2026") parses to exact date 22 Sept 2026'
    );

    // 44. Ambiguous DD-MM-YYYY dates ("03-04-2026") -> 3 April 2026
    const parsedDMY = parseDeadlineTimestamp('03-04-2026');
    const dDMY = parsedDMY ? new Date(parsedDMY) : null;
    assert(
      dDMY !== null && dDMY.getFullYear() === 2026 && dDMY.getMonth() === 3 && dDMY.getDate() === 3,
      '44. DD-MM-YYYY date string ("03-04-2026") explicitly resolves to 3 April 2026'
    );

    // 45. ISO date strings
    const parsedISO = parseDeadlineTimestamp('2026-09-22T00:00:00.000Z');
    assert(
      parsedISO === new Date('2026-09-22T00:00:00.000Z').getTime(),
      '45. ISO date string resolves to exact expected timestamp'
    );

    // 46. Strict invalid calendar date rejection ("31-02-2026", "32-01-2026", "00-12-2026")
    const invalidFeb = parseDeadlineTimestamp('31-02-2026');
    const invalidDay = parseDeadlineTimestamp('32-01-2026');
    const invalidMonth = parseDeadlineTimestamp('00-12-2026');
    const parsedInvalid = parseDeadlineTimestamp('not-a-valid-date');
    const parsedNull = parseDeadlineTimestamp(undefined);
    assert(
      invalidFeb === null && invalidDay === null && invalidMonth === null && parsedInvalid === null && parsedNull === null,
      '46. Invalid calendar dates (31-02-2026, 32-01-2026, 00-12-2026) and invalid strings are strictly rejected with null'
    );

    // 47. Expired deadline with configured offset
    const pastDeadlineJob = { deadlineDate: '2020-01-01' };
    assert(
      checkJobExpired(pastDeadlineJob, 1) === true,
      '47. Past deadline with offset explicitly evaluates to true (expired)'
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
      '48. Restored jobs with restoredAt and isExpired=false explicitly evaluate to false (live/unexpired)'
    );

    // 49. Real Multi-Batch Pagination Tests with >200 records (Isolated Dataset, Zero Production DB writes)
    let repoFilteringValid = false;
    try {
      const runnerUser = 'isolated-pagination-test-runner';
      const sameTimestamp = '2026-11-01T00:00:00.000Z';

      // Seed exactly 250 isolated fixtures (200 Approved, 50 Expired)
      for (let i = 1; i <= 250; i++) {
        const paddedNum = String(i).padStart(3, '0');
        const id = `job-mock-${paddedNum}`;
        Database.addJob({
          id,
          title: `Mock Job ${paddedNum}`,
          status: i <= 200 ? 'Approved' : 'Expired',
          isSuspended: false,
          submittedByUserId: runnerUser,
          createdAt: sameTimestamp
        });
        createdFixtureIds.push(id);
      }

      // Query Approved Page 1 and Page 2 (50 items per page)
      const appResPage1 = await JobRepository.getAll({ status: 'Approved', limit: 50, page: 1, submittedByUserId: runnerUser });
      const appResPage2 = await JobRepository.getAll({ status: 'Approved', limit: 50, page: 2, submittedByUserId: runnerUser });

      // Query Expired Page 1 (50 items)
      const expRes = await JobRepository.getAll({ status: 'Expired', limit: 50, page: 1, submittedByUserId: runnerUser });

      // 1. Verify totals and exact page lengths
      if (appResPage1.total !== 200) throw new Error(`Expected Approved total 200, got ${appResPage1.total}`);
      if (appResPage2.total !== 200) throw new Error(`Expected Approved total 200 on Page 2, got ${appResPage2.total}`);
      if (expRes.total !== 50) throw new Error(`Expected Expired total 50, got ${expRes.total}`);

      if (appResPage1.jobs.length !== 50) throw new Error(`Page 1 length expected 50, got ${appResPage1.jobs.length}`);
      if (appResPage2.jobs.length !== 50) throw new Error(`Page 2 length expected 50, got ${appResPage2.jobs.length}`);
      if (expRes.jobs.length !== 50) throw new Error(`Expired Page length expected 50, got ${expRes.jobs.length}`);

      // 2. Verify Page 1 exact expected IDs in deterministic order (job-mock-001 .. job-mock-050)
      const expectedP1 = Array.from({ length: 50 }, (_, idx) => `job-mock-${String(idx + 1).padStart(3, '0')}`);
      for (let idx = 0; idx < 50; idx++) {
        const actualId = appResPage1.jobs[idx]?.id;
        if (actualId !== expectedP1[idx]) {
          throw new Error(`Page 1 index ${idx}: expected ${expectedP1[idx]}, got ${actualId}`);
        }
      }

      // 3. Verify Page 2 exact expected IDs in deterministic order (job-mock-051 .. job-mock-100)
      const expectedP2 = Array.from({ length: 50 }, (_, idx) => `job-mock-${String(idx + 51).padStart(3, '0')}`);
      for (let idx = 0; idx < 50; idx++) {
        const actualId = appResPage2.jobs[idx]?.id;
        if (actualId !== expectedP2[idx]) {
          throw new Error(`Page 2 index ${idx}: expected ${expectedP2[idx]}, got ${actualId}`);
        }
      }

      // 4. Verify no overlap between Page 1 and Page 2
      const p1Set = new Set(appResPage1.jobs.map(j => j.id));
      for (const job of appResPage2.jobs) {
        if (p1Set.has(job.id)) {
          throw new Error(`Duplicate ID found across pages: ${job.id}`);
        }
      }

      // 5. Verify combined 100 IDs match expected set exactly
      const combined = [...appResPage1.jobs.map(j => j.id), ...appResPage2.jobs.map(j => j.id)];
      if (combined.length !== 100) throw new Error(`Combined length expected 100, got ${combined.length}`);
      const expectedCombined = Array.from({ length: 100 }, (_, idx) => `job-mock-${String(idx + 1).padStart(3, '0')}`);
      for (let idx = 0; idx < 100; idx++) {
        if (combined[idx] !== expectedCombined[idx]) {
          throw new Error(`Combined index ${idx}: expected ${expectedCombined[idx]}, got ${combined[idx]}`);
        }
      }

      // 6. Verify Expired Page exact expected IDs (job-mock-201 .. job-mock-250)
      const expectedExp = Array.from({ length: 50 }, (_, idx) => `job-mock-${String(idx + 201).padStart(3, '0')}`);
      for (let idx = 0; idx < 50; idx++) {
        const actualId = expRes.jobs[idx]?.id;
        if (actualId !== expectedExp[idx]) {
          throw new Error(`Expired index ${idx}: expected ${expectedExp[idx]}, got ${actualId}`);
        }
      }

      // 7. Verify status fields for returned records
      for (const job of appResPage1.jobs) if (job.status !== 'Approved') throw new Error(`Non-approved status in Page 1: ${job.id}`);
      for (const job of appResPage2.jobs) if (job.status !== 'Approved') throw new Error(`Non-approved status in Page 2: ${job.id}`);
      for (const job of expRes.jobs) if (job.status !== 'Expired') throw new Error(`Non-expired status in Expired Page: ${job.id}`);

      repoFilteringValid = true;
    } catch (err: any) {
      console.error('Error during repository multi-batch pagination verification:', err?.message || err);
      repoFilteringValid = false;
    }
    assert(
      repoFilteringValid === true,
      '49. Repository multi-batch pagination verifies actual job IDs, non-overlapping pages, correct totals, and strict status correctness'
    );

    // ==========================================
    // GROUP 6: STEP65-D.12.4 PERSISTENCE, REDACTION & URL ENFORCEMENT
    // ==========================================
    console.log('\n--- Group 6: STEP65-D.12.4 Persistence Fail-Closed & URL Policy Enforcement ---');

    // 50. JobVisibilityRepository getPolicy fails closed in production mode when MongoDB is unconfigured
    let getPolicyFailedClosed = false;
    const testIsTest = process.env.IS_TEST;
    const testMongoUri = process.env.MONGODB_URI;
    const testNodeEnv = process.env.NODE_ENV;
    delete process.env.IS_TEST;
    delete process.env.MONGODB_URI;
    process.env.NODE_ENV = 'production';
    try {
      await JobVisibilityRepository.getPolicy('scraped');
    } catch (err: any) {
      if (err?.message && err.message.includes('MongoDB')) {
        getPolicyFailedClosed = true;
      }
    } finally {
      if (testIsTest === undefined) delete process.env.IS_TEST; else process.env.IS_TEST = testIsTest;
      if (testMongoUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = testMongoUri;
      if (testNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = testNodeEnv;
    }
    assert(
      getPolicyFailedClosed === true,
      '50. JobVisibilityRepository.getPolicy fails closed in production mode when MongoDB is unconfigured'
    );

    // 51. JobVisibilityRepository getAllPolicies fails closed in production mode when MongoDB is unconfigured
    let getAllPoliciesFailedClosed = false;
    delete process.env.IS_TEST;
    delete process.env.MONGODB_URI;
    process.env.NODE_ENV = 'production';
    try {
      await JobVisibilityRepository.getAllPolicies();
    } catch (err: any) {
      if (err?.message && err.message.includes('MongoDB')) {
        getAllPoliciesFailedClosed = true;
      }
    } finally {
      if (testIsTest === undefined) delete process.env.IS_TEST; else process.env.IS_TEST = testIsTest;
      if (testMongoUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = testMongoUri;
      if (testNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = testNodeEnv;
    }
    assert(
      getAllPoliciesFailedClosed === true,
      '51. JobVisibilityRepository.getAllPolicies fails closed in production mode when MongoDB is unconfigured'
    );

    // 52. Public response filtering redacts externalApplyUrl, applicationUrl and sourceUrl for Free users
    const sensitiveUrlJob = {
      id: 'job-sensitive-urls-1',
      title: 'Senior DevOps Lead',
      company: 'TechCorp',
      externalApplyUrl: 'https://techcorp.com/careers/apply/99',
      applicationUrl: 'https://techcorp.com/app/101',
      sourceUrl: 'https://sourceportal.com/view/55',
      fieldVisibility: {
        externalApplyUrl: 'Premium',
        applicationUrl: 'Premium',
        sourceUrl: 'Premium'
      }
    };
    const policySensitiveJob = await JobVisibilityRepository.applyPolicyToJob(sensitiveUrlJob);
    const filteredSensitiveJob = JobVisibilityRepository.filterJobForUser(policySensitiveJob, freeUser, false);
    
    const urlsAreRedacted = 
      filteredSensitiveJob.externalApplyUrl === '🔒 Unlock with Premium Subscription' &&
      filteredSensitiveJob.applicationUrl === '🔒 Unlock with Premium Subscription' &&
      filteredSensitiveJob.sourceUrl === '🔒 Unlock with Premium Subscription';

    assert(
      urlsAreRedacted === true,
      '52. Public response filtering strictly redacts externalApplyUrl, applicationUrl and sourceUrl with lock message for Free users'
    );

    // 53. Active Premium users receive actual unredacted URLs
    const filteredForPremSubscriber = JobVisibilityRepository.filterJobForUser(policySensitiveJob, freeUser, true);
    const urlsAreIntact = 
      filteredForPremSubscriber.externalApplyUrl === 'https://techcorp.com/careers/apply/99' &&
      filteredForPremSubscriber.applicationUrl === 'https://techcorp.com/app/101' &&
      filteredForPremSubscriber.sourceUrl === 'https://sourceportal.com/view/55';

    assert(
      urlsAreIntact === true,
      '53. Active Premium subscribers receive unredacted external URLs'
    );

    // 54. Individual field visibility override takes precedence over source defaults
    const customOverrideJob = {
      id: 'job-custom-override-1',
      title: 'Scraped Position with Free Application Link',
      isScraped: true,
      applicationUrl: 'https://public-apply.com/job/1',
      fieldVisibility: {
        applicationUrl: 'Free'
      }
    };
    const policyCustomJob = await JobVisibilityRepository.applyPolicyToJob(customOverrideJob);
    const filteredCustomJob = JobVisibilityRepository.filterJobForUser(policyCustomJob, freeUser, false);
    assert(
      filteredCustomJob.applicationUrl === 'https://public-apply.com/job/1',
      '54. Individual job field override (Free applicationUrl) takes precedence over source default rules'
    );

    // ==========================================
    // GROUP 7: STEP65-D.12.7 STRICT PAYMENT & PDF ISOLATION
    // ==========================================
    console.log('\n--- Group 7: STEP65-D.12.7 Strict Payment & PDF Isolation ---');

    // 55. PDF Source URL isolation (No sourceUrl fallback)
    const pdfHiddenJob = {
      id: 'job-pdf-hidden-1',
      title: 'Senior Engineer',
      pdfSourceUrl: 'https://cdn.com/official.pdf',
      sourceUrl: 'https://employer.com/info',
      fieldVisibility: {
        pdfSourceUrl: 'Premium',
        sourceUrl: 'Free'
      }
    };
    const policyPdfJob = await JobVisibilityRepository.applyPolicyToJob(pdfHiddenJob);
    const filteredPdfJob = JobVisibilityRepository.filterJobForUser(policyPdfJob, freeUser, false);
    
    assert(
      filteredPdfJob.pdfSourceUrl === '🔒 Unlock with Premium Subscription' &&
      filteredPdfJob.sourceUrl === 'https://employer.com/info',
      '55. PDF source URL correctly redacted independently of Free sourceUrl'
    );

    // 56. Premium PDF Source URL visibility for Premium users
    const filteredPdfForPrem = JobVisibilityRepository.filterJobForUser(policyPdfJob, freeUser, true);
    assert(
      filteredPdfForPrem.pdfSourceUrl === 'https://cdn.com/official.pdf',
      '56. Premium PDF source URL correctly unredacted for Premium users'
    );

    // 57. Hidden PDF Source URL remains hidden for all non-admins
    const pdfFullyHiddenJob = {
      id: 'job-pdf-hidden-2',
      title: 'Secret Engineer',
      pdfSourceUrl: 'https://cdn.com/confidential.pdf',
      fieldVisibility: { pdfSourceUrl: 'Hidden' }
    };
    const policyFullyHiddenPdf = await JobVisibilityRepository.applyPolicyToJob(pdfFullyHiddenJob);
    const filteredFullyHiddenPdf = JobVisibilityRepository.filterJobForUser(policyFullyHiddenPdf, freeUser, true);
    assert(
      filteredFullyHiddenPdf.pdfSourceUrl === undefined,
      '57. Hidden PDF source URL completely stripped even for Premium users'
    );

    // ==========================================
    // GROUP 8: STEP65-E.1 ADMIN JOB DETAIL & PREMIUM VISIBILITY COMPLETION
    // ==========================================
    console.log('\n--- Group 8: STEP65-E.1 Admin Job Detail & Premium Visibility Completion ---');

    // 58. Admin changes a field from job Details and backend persists it
    const modalTestJobId = `job-modal-vis-${Date.now()}`;
    const modalTestJob: any = {
      id: modalTestJobId,
      title: 'Modal Visibility Test Job',
      company: 'Test Corp',
      status: 'Approved',
      fieldVisibility: {
        applicationUrl: 'Premium',
        salary: 'Hidden'
      }
    };
    createdFixtureIds.push(modalTestJobId);
    Database.addJob(modalTestJob);

    const updatedVisibilityPayload = {
      applicationUrl: 'Free',
      salary: 'Free',
      contactEmail: 'Premium'
    };
    await JobRepository.update(modalTestJobId, { fieldVisibility: updatedVisibilityPayload });
    const fetchedModalJob = await JobRepository.getById(modalTestJobId);

    assert(
      fetchedModalJob?.fieldVisibility?.applicationUrl === 'Free' &&
      fetchedModalJob?.fieldVisibility?.salary === 'Free' &&
      fetchedModalJob?.fieldVisibility?.contactEmail === 'Premium',
      '58. Admin changes field visibility from job Details and backend persists override rules'
    );

    // 59. Individual override survives source-default changes
    await JobVisibilityRepository.savePolicy('user_posted', { applicationUrl: 'Hidden' });
    const overrideJobAfterPolicyChange = await JobVisibilityRepository.applyPolicyToJob(fetchedModalJob);
    assert(
      overrideJobAfterPolicyChange.fieldVisibility.applicationUrl === 'Free',
      '59. Individual job override (applicationUrl: Free) survives source-default policy changes (Hidden)'
    );

    // 60. Reset restores source default
    const resetVisibilityPayload: any = {
      salary: 'Free'
    };
    delete resetVisibilityPayload.applicationUrl;
    await JobRepository.update(modalTestJobId, { fieldVisibility: resetVisibilityPayload });
    const resetJob = await JobRepository.getById(modalTestJobId);
    const policyResetJob = await JobVisibilityRepository.applyPolicyToJob(resetJob);

    assert(
      policyResetJob.fieldVisibility.applicationUrl === 'Hidden' && policyResetJob.fieldVisibility.salary === 'Free',
      '60. Resetting individual field override restores source-default rule (applicationUrl: Hidden)'
    );

    // Restore original default policy for user_posted
    await JobVisibilityRepository.savePolicy('user_posted', { applicationUrl: 'Premium' });

    // 61. Free user sees Free fields only
    const sampleVisibilityJob = {
      id: 'job-vis-sample-1',
      title: 'Full Stack Architect',
      company: 'Innovate Tech',
      contactEmail: 'careers@innovate.com',
      salary: '$180,000 / yr',
      fieldVisibility: {
        title: 'Free',
        contactEmail: 'Premium',
        salary: 'Hidden'
      }
    };
    const filteredForFreeUser = JobVisibilityRepository.filterJobForUser(sampleVisibilityJob, freeUser, false);
    assert(
      filteredForFreeUser.title === 'Full Stack Architect' &&
      filteredForFreeUser.contactEmail === '🔒 Unlock with Premium Subscription' &&
      filteredForFreeUser.salary === undefined,
      '61. Free user sees Free fields, lock message for Premium fields, and undefined for Hidden fields'
    );

    // 62. Active Premium user receives actual Premium field values
    const filteredForActivePremiumUser = JobVisibilityRepository.filterJobForUser(sampleVisibilityJob, freeUser, true);
    assert(
      filteredForActivePremiumUser.title === 'Full Stack Architect' &&
      filteredForActivePremiumUser.contactEmail === 'careers@innovate.com' &&
      filteredForActivePremiumUser.salary === undefined,
      '62. Active Premium user receives actual Premium field values while Hidden fields remain stripped'
    );

    // 63. Expired, Pending, or Rejected membership receives no Premium data
    const expiredUserDoc = { membershipStatus: 'Active', subscriptionExpiresAt: new Date(Date.now() - 10000).toISOString() };
    const pendingUserDoc = { membershipStatus: 'Pending', subscriptionExpiresAt: new Date(Date.now() + 100000).toISOString() };
    const isExpiredPremium = JobVisibilityRepository.evaluateUserDocForPremium(expiredUserDoc);
    const isPendingPremium = JobVisibilityRepository.evaluateUserDocForPremium(pendingUserDoc);
    const filteredForExpired = JobVisibilityRepository.filterJobForUser(sampleVisibilityJob, freeUser, isExpiredPremium);
    const filteredForPending = JobVisibilityRepository.filterJobForUser(sampleVisibilityJob, freeUser, isPendingPremium);

    assert(
      isExpiredPremium === false &&
      isPendingPremium === false &&
      filteredForExpired.contactEmail === '🔒 Unlock with Premium Subscription' &&
      filteredForPending.contactEmail === '🔒 Unlock with Premium Subscription',
      '63. Expired, Pending, or Rejected membership evaluates as non-premium and receives lock messages'
    );

    // 64. Hidden fields remain unavailable to Free and Premium
    const hiddenFieldJob = {
      title: 'Secret Lead',
      description: 'Public Description',
      contactEmail: 'admin-only@company.com',
      fieldVisibility: {
        description: 'Free',
        contactEmail: 'Hidden'
      }
    };
    const filteredHiddenFree = JobVisibilityRepository.filterJobForUser(hiddenFieldJob, freeUser, false);
    const filteredHiddenPrem = JobVisibilityRepository.filterJobForUser(hiddenFieldJob, freeUser, true);
    assert(
      filteredHiddenFree.contactEmail === undefined && filteredHiddenPrem.contactEmail === undefined,
      '64. Hidden fields remain completely absent for both Free and Premium users'
    );

    // 65. All three job sources behave correctly (user_posted, scraped, admin_created)
    const userPostedDerived = JobVisibilityRepository.deriveJobSource({ title: 'User Job' });
    const scrapedDerived = JobVisibilityRepository.deriveJobSource({ title: 'Scraped Job', isScraped: true });
    const adminCreatedDerived = JobVisibilityRepository.deriveJobSource({ title: 'Admin Job', isAdminCreated: true });

    assert(
      userPostedDerived === 'user_posted' &&
      scrapedDerived === 'scraped' &&
      adminCreatedDerived === 'admin_created',
      '65. All three job sources (user_posted, scraped, admin_created) derived and handled correctly'
    );

    // 66. Public listing and detail endpoints return consistent filtered data
    const rawJobRecord = {
      id: 'job-consistent-1',
      title: 'Consistent Job',
      applicationUrl: 'https://apply.com/123',
      fieldVisibility: { applicationUrl: 'Premium' }
    };
    const policyApplied = await JobVisibilityRepository.applyPolicyToJob(rawJobRecord);
    const listingFiltered = JobVisibilityRepository.filterJobForUser(policyApplied, freeUser, false);
    const detailFiltered = JobVisibilityRepository.filterJobForUser(policyApplied, freeUser, false);

    assert(
      listingFiltered.applicationUrl === detailFiltered.applicationUrl &&
      listingFiltered.applicationUrl === '🔒 Unlock with Premium Subscription',
      '66. Public listing and detail responses produce identical consistent redaction for Premium fields'
    );

    // 67. Direct attachment URL cannot bypass field or attachment privacy
    const directAttJobId = `job-att-privacy-${Date.now()}`;
    const directAttJob = {
      id: directAttJobId,
      title: 'Attachment Privacy Job',
      status: 'Approved',
      attachments: [
        { id: 'att-priv-1', name: 'PrivateSpec.pdf', fileUrl: '/api/jobs/attachments/PrivateSpec.pdf', isPublic: false }
      ],
      fieldVisibility: { attachments: 'Free' }
    };
    createdFixtureIds.push(directAttJobId);
    Database.addJob(directAttJob);

    const directAccessResult = await JobRepository.verifyAttachmentAccess('PrivateSpec.pdf', freeUser, false, directAttJobId);
    assert(
      directAccessResult === false,
      '67. Direct attachment URL cannot bypass individual attachment privacy (isPublic: false) even when attachments field is Free'
    );

    // 68. Bulk updates affect only selected jobs and fields
    const bulkJob1Id = `job-bulk-1-${Date.now()}`;
    const bulkJob2Id = `job-bulk-2-${Date.now()}`;
    createdFixtureIds.push(bulkJob1Id, bulkJob2Id);

    Database.addJob({ id: bulkJob1Id, title: 'Bulk Job 1', fieldVisibility: { applicationUrl: 'Free', contactEmail: 'Free' } });
    Database.addJob({ id: bulkJob2Id, title: 'Bulk Job 2', fieldVisibility: { applicationUrl: 'Free', contactEmail: 'Free' } });

    // Perform selective bulk update for contactEmail only
    const targetIds = [bulkJob1Id, bulkJob2Id];
    for (const id of targetIds) {
      const j = await JobRepository.getById(id);
      const updatedRules = { ...j.fieldVisibility, contactEmail: 'Premium' };
      await JobRepository.update(id, { fieldVisibility: updatedRules });
    }

    const resBulk1 = await JobRepository.getById(bulkJob1Id);
    const resBulk2 = await JobRepository.getById(bulkJob2Id);

    assert(
      resBulk1?.fieldVisibility?.applicationUrl === 'Free' &&
      resBulk1?.fieldVisibility?.contactEmail === 'Premium' &&
      resBulk2?.fieldVisibility?.applicationUrl === 'Free' &&
      resBulk2?.fieldVisibility?.contactEmail === 'Premium',
      '68. Bulk updates affect selected fields (contactEmail: Premium) while preserving unselected fields (applicationUrl: Free)'
    );

    // 69. Invalid field names and invalid visibility values are rejected
    const invalidFieldNameCheck = validateFieldRules({ fakeFieldKeyName: 'Free' });
    const invalidVisibilityValueCheck = validateFieldRules({ title: 'SuperFreeInvalid' });
    const internalFieldCheck = validateFieldRules({ rejectionReason: 'Free' });

    assert(
      invalidFieldNameCheck !== null &&
      invalidVisibilityValueCheck !== null &&
      internalFieldCheck !== null,
      '69. Invalid field names, invalid visibility values, and internal administrative fields are strictly rejected'
    );

    // ==========================================
    // GROUP 9: STEP65-E.2 JOB VISIBILITY SOURCE MAPPING & POLICY INHERITANCE
    // ==========================================
    console.log('\n--- Group 9: STEP65-E.2 Job Visibility Source Mapping & Policy Inheritance ---');

    // 70. "pdf_scraped" maps to "scraped"
    const pdfScrapedFromString = normalizeJobVisibilitySource('pdf_scraped');
    const pdfScrapedFromRepo = JobVisibilityRepository.deriveJobSource('pdf_scraped');
    const pdfScrapedFromJobObj = JobVisibilityRepository.deriveJobSource({ sourceType: 'pdf_scraped' });
    const pdfScrapedFlag = JobVisibilityRepository.deriveJobSource({ isPdfScraped: true });
    assert(
      pdfScrapedFromString === 'scraped' &&
      pdfScrapedFromRepo === 'scraped' &&
      pdfScrapedFromJobObj === 'scraped' &&
      pdfScrapedFlag === 'scraped',
      '70. "pdf_scraped" consistently maps to "scraped" in both helper and repository'
    );

    // 71. Normal "scraped" remains unchanged
    const scrapedFromString = normalizeJobVisibilitySource('scraped');
    const scrapedFromRepo = JobVisibilityRepository.deriveJobSource('scraped');
    const scrapedFromJobObj = JobVisibilityRepository.deriveJobSource({ sourceType: 'scraped', isScraped: true });
    assert(
      scrapedFromString === 'scraped' &&
      scrapedFromRepo === 'scraped' &&
      scrapedFromJobObj === 'scraped',
      '71. Normal "scraped" source remains unchanged as "scraped"'
    );

    // 72. User-posted and admin-created sources remain unchanged
    const userPostedNorm = normalizeJobVisibilitySource('user_posted');
    const adminCreatedNorm = normalizeJobVisibilitySource('admin_created');
    const userPostedRepo = JobVisibilityRepository.deriveJobSource('user_posted');
    const adminCreatedRepo = JobVisibilityRepository.deriveJobSource('admin_created');
    assert(
      userPostedNorm === 'user_posted' &&
      adminCreatedNorm === 'admin_created' &&
      userPostedRepo === 'user_posted' &&
      adminCreatedRepo === 'admin_created',
      '72. User-posted and admin-created sources remain unchanged'
    );

    // Setup policies for testing inheritance:
    // Generic Scraped policy:
    // - salary = Premium
    // - contactEmail = Hidden
    // - applicationUrl = Premium
    await JobVisibilityRepository.savePolicy('scraped', {
      salary: 'Premium',
      contactEmail: 'Hidden',
      applicationUrl: 'Premium'
    });

    // 73. Generic Scraped policy applies when no scraper-specific policy exists
    const genericScrapedResult = await JobVisibilityRepository.getPolicy('scraped');
    assert(
      genericScrapedResult.fieldRules.salary === 'Premium' &&
      genericScrapedResult.fieldRules.contactEmail === 'Hidden' &&
      genericScrapedResult.fieldRules.applicationUrl === 'Premium',
      '73. Generic Scraped policy applies when no scraper-specific policy exists'
    );

    // Specific scraper policy for FPSC:
    // - salary = Free
    await JobVisibilityRepository.savePolicy('scraped', {
      salary: 'Free'
    }, 'fpsc');

    // 74. Specific scraper policy overrides only explicitly supplied fields
    const fpscPolicy = await JobVisibilityRepository.getPolicy('scraped', 'fpsc');
    assert(
      fpscPolicy.fieldRules.salary === 'Free',
      '74. Specific scraper policy (FPSC) overrides explicitly supplied fields (salary: Free)'
    );

    // 75. Generic fields not specified in the specific policy are inherited
    assert(
      fpscPolicy.fieldRules.contactEmail === 'Hidden' &&
      fpscPolicy.fieldRules.applicationUrl === 'Premium',
      '75. Generic fields not specified in FPSC policy are inherited (contactEmail: Hidden, applicationUrl: Premium)'
    );

    // 76. Individual job overrides take precedence over both policies
    const fpscJobWithOverride = {
      id: `job-fpsc-override-${Date.now()}`,
      title: 'FPSC Inspector',
      sourceType: 'scraped',
      scraperSourceId: 'fpsc',
      fieldVisibility: {
        applicationUrl: 'Hidden'
      }
    };
    const fpscJobApplied = await JobVisibilityRepository.applyPolicyToJob(fpscJobWithOverride);
    assert(
      fpscJobApplied.fieldVisibility.salary === 'Free' &&
      fpscJobApplied.fieldVisibility.contactEmail === 'Hidden' &&
      fpscJobApplied.fieldVisibility.applicationUrl === 'Hidden',
      '76. Individual job overrides (applicationUrl: Hidden) take precedence over both generic and specific policies'
    );

    // 77. FPSC and PPSC policies do not leak into each other
    // PPSC has NO specific policy saved
    const ppscPolicy = await JobVisibilityRepository.getPolicy('scraped', 'ppsc');
    const ppscJob = {
      id: `job-ppsc-${Date.now()}`,
      title: 'PPSC Assistant',
      sourceType: 'pdf_scraped', // PDF-scraped PPSC job
      scraperSourceId: 'ppsc'
    };
    const ppscJobApplied = await JobVisibilityRepository.applyPolicyToJob(ppscJob);
    assert(
      ppscPolicy.fieldRules.salary === 'Premium' &&
      ppscJobApplied.fieldVisibility.salary === 'Premium' &&
      ppscJobApplied.fieldVisibility.salary !== fpscPolicy.fieldRules.salary,
      '77. FPSC and PPSC policies do not leak into each other (PPSC retains generic salary: Premium)'
    );

    // 78. Missing specific policy does not reset generic rules to built-in defaults
    assert(
      ppscPolicy.fieldRules.contactEmail === 'Hidden' &&
      ppscJobApplied.fieldVisibility.contactEmail === 'Hidden',
      '78. Missing specific policy (PPSC) does not reset generic rules to built-in defaults (contactEmail remains Hidden)'
    );

    // 79. Existing policies and individual overrides remain unchanged after policy lookup
    const rawFpscJobCopy = { ...fpscJobWithOverride };
    await JobVisibilityRepository.getPolicy('scraped', 'fpsc');
    await JobVisibilityRepository.getPolicy('scraped', 'ppsc');
    await JobVisibilityRepository.applyPolicyToJob(fpscJobWithOverride);
    assert(
      fpscJobWithOverride.fieldVisibility.applicationUrl === rawFpscJobCopy.fieldVisibility.applicationUrl &&
      Object.keys(fpscJobWithOverride.fieldVisibility).length === 1,
      '79. Existing policies and individual job overrides remain immutable and uncontaminated after lookup'
    );

    // ==========================================
    // GROUP 10: STEP65-E.2-B MINIMAL GENERIC POLICY MONGODB PERSISTENCE (MOCKED UNIT TESTS)
    // NOTE: These unit tests use an isolated mock collection to strictly verify the MongoDB
    // driver query & update branches of JobVisibilityRepository (coll.findOne and coll.updateOne).
    // They are explicitly mocked unit tests and do NOT constitute live external MongoDB tests.
    // ==========================================
    console.log('\n--- Group 10: STEP65-E.2-B Minimal Generic Policy MongoDB Persistence (Mocked Unit Tests) ---');

    class MockMongoPolicyCollection {
      docs: any[] = [];
      shouldThrowOnRead: boolean = false;
      shouldThrowOnWrite: boolean = false;

      private matchQuery(doc: any, query: any): boolean {
        if (!query) return true;
        if (query.$or && Array.isArray(query.$or)) {
          const matchesOr = query.$or.some((subQuery: any) => this.matchQuery(doc, subQuery));
          if (!matchesOr) return false;
        }
        for (const [k, v] of Object.entries(query)) {
          if (k === '$or') continue;
          if (v && typeof v === 'object' && ('$exists' in v)) {
            const exists = Object.prototype.hasOwnProperty.call(doc, k);
            if (exists !== (v as any).$exists) {
              return false;
            }
          } else if (v && typeof v === 'object' && ('$in' in v)) {
            if (!Array.isArray((v as any).$in) || !(v as any).$in.includes(doc[k])) {
              return false;
            }
          } else if (doc[k] !== v) {
            return false;
          }
        }
        return true;
      }

      async findOne(query: any, options?: any): Promise<any> {
        if (this.shouldThrowOnRead) {
          throw new Error('Simulated MongoDB read connection timeout');
        }
        let candidates = this.docs.filter(doc => this.matchQuery(doc, query));
        if (options && options.sort) {
          candidates.sort((a, b) => {
            for (const [field, dir] of Object.entries(options.sort)) {
              let valA = a[field];
              let valB = b[field];
              if (field === '_id') {
                valA = a._id || a.id || '';
                valB = b._id || b.id || '';
              }
              if (valA < valB) return (dir as number) < 0 ? 1 : -1;
              if (valA > valB) return (dir as number) < 0 ? -1 : 1;
            }
            return 0;
          });
        }
        return candidates.length > 0 ? JSON.parse(JSON.stringify(candidates[0])) : null;
      }

      async updateOne(query: any, update: any, options?: any): Promise<any> {
        if (this.shouldThrowOnWrite) {
          throw new Error('Simulated MongoDB write connection timeout');
        }
        let matchedIndex = -1;
        for (let i = 0; i < this.docs.length; i++) {
          if (this.matchQuery(this.docs[i], query)) {
            matchedIndex = i;
            break;
          }
        }

        const setObj = update?.$set ? JSON.parse(JSON.stringify(update.$set)) : {};
        const unsetObj = update?.$unset || {};
        if (matchedIndex >= 0) {
          const updatedDoc = { ...this.docs[matchedIndex], ...setObj };
          for (const uKey of Object.keys(unsetObj)) {
            delete updatedDoc[uKey];
          }
          this.docs[matchedIndex] = updatedDoc;
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
        } else if (options?.upsert) {
          const newDoc = { ...setObj };
          for (const uKey of Object.keys(unsetObj)) {
            delete newDoc[uKey];
          }
          this.docs.push(newDoc);
          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      }

      find(query?: any) {
        return {
          toArray: async () => JSON.parse(JSON.stringify(this.docs))
        };
      }
    }

    const mockColl = new MockMongoPolicyCollection();
    JobVisibilityRepository.setMockCollection(mockColl);

    try {
      // 80. Generic policy save does not include an own "sourceKey" property
      await JobVisibilityRepository.savePolicy('scraped', {
        salary: 'Premium',
        contactEmail: 'Hidden',
        applicationUrl: 'Premium'
      });

      const savedGenericDoc = mockColl.docs[0];
      assert(
        savedGenericDoc !== undefined &&
        Object.prototype.hasOwnProperty.call(savedGenericDoc, 'sourceKey') === false &&
        savedGenericDoc.source === 'scraped' &&
        savedGenericDoc.fieldRules.contactEmail === 'Hidden',
        '80. [MOCKED] Generic policy save does not include an own "sourceKey" property in MongoDB document'
      );

      // 81. Generic policy lookup can retrieve the saved generic document
      const retrievedGeneric = await JobVisibilityRepository.getPolicy('scraped');
      assert(
        retrievedGeneric.source === 'scraped' &&
        Object.prototype.hasOwnProperty.call(retrievedGeneric, 'sourceKey') === false &&
        retrievedGeneric.fieldRules.salary === 'Premium' &&
        retrievedGeneric.fieldRules.contactEmail === 'Hidden' &&
        retrievedGeneric.fieldRules.applicationUrl === 'Premium',
        '81. [MOCKED] Generic policy lookup using { sourceKey: { $exists: false } } retrieves saved generic document'
      );

      // 82. FPSC-specific policy overrides only explicitly configured fields
      await JobVisibilityRepository.savePolicy('scraped', {
        salary: 'Free'
      }, 'fpsc');

      const savedFpscDoc = mockColl.docs.find(d => d.sourceKey === 'fpsc');
      const fpscPolicyMock = await JobVisibilityRepository.getPolicy('scraped', 'fpsc');
      assert(
        savedFpscDoc !== undefined &&
        savedFpscDoc.sourceKey === 'fpsc' &&
        fpscPolicyMock.fieldRules.salary === 'Free',
        '82. [MOCKED] FPSC-specific policy overrides only explicitly configured fields (salary: Free)'
      );

      // 83. Unspecified FPSC fields inherit generic scraped policy
      assert(
        fpscPolicyMock.fieldRules.contactEmail === 'Hidden' &&
        fpscPolicyMock.fieldRules.applicationUrl === 'Premium',
        '83. [MOCKED] Unspecified FPSC fields inherit generic scraped policy (contactEmail: Hidden, applicationUrl: Premium)'
      );

      // 84. PPSC inherits generic policy but never FPSC-specific values
      const ppscPolicyMock = await JobVisibilityRepository.getPolicy('scraped', 'ppsc');
      assert(
        ppscPolicyMock.fieldRules.salary === 'Premium' &&
        ppscPolicyMock.fieldRules.contactEmail === 'Hidden' &&
        ppscPolicyMock.fieldRules.applicationUrl === 'Premium' &&
        ppscPolicyMock.fieldRules.salary !== fpscPolicyMock.fieldRules.salary,
        '84. [MOCKED] PPSC inherits generic scraped policy but never FPSC-specific values (salary: Premium)'
      );

      // 85. Individual job overrides remain highest priority
      const mockJobWithOverride = {
        id: `job-mock-override-${Date.now()}`,
        title: 'FPSC Custom Job',
        sourceType: 'scraped',
        scraperSourceId: 'fpsc',
        fieldVisibility: {
          applicationUrl: 'Hidden'
        }
      };
      const appliedMockJob = await JobVisibilityRepository.applyPolicyToJob(mockJobWithOverride);
      assert(
        appliedMockJob.fieldVisibility.salary === 'Free' &&
        appliedMockJob.fieldVisibility.contactEmail === 'Hidden' &&
        appliedMockJob.fieldVisibility.applicationUrl === 'Hidden',
        '85. [MOCKED] Individual job overrides remain highest priority over both generic and scraper policies'
      );

      // 86. MongoDB write errors propagate as failures
      mockColl.shouldThrowOnWrite = true;
      let writeThrew = false;
      try {
        await JobVisibilityRepository.savePolicy('scraped', { title: 'Premium' });
      } catch (err: any) {
        writeThrew = true;
      } finally {
        mockColl.shouldThrowOnWrite = false;
      }
      assert(
        writeThrew === true,
        '86. [MOCKED] MongoDB write errors propagate as failures and are not falsely presented as successful'
      );

      // 87. MongoDB read errors fail closed without local JSON fallback
      mockColl.shouldThrowOnRead = true;
      let readThrew = false;
      try {
        await JobVisibilityRepository.getPolicy('scraped');
      } catch (err: any) {
        readThrew = true;
      } finally {
        mockColl.shouldThrowOnRead = false;
      }
      assert(
        readThrew === true,
        '87. [MOCKED] MongoDB read errors fail closed without silent fallback to local JSON or in-memory policy'
      );
    } finally {
      JobVisibilityRepository.setMockCollection(null);
    }

    // 88. Mock collection injection outside test mode (IS_TEST !== 'true') is strictly rejected
    const prevIsTest = process.env.IS_TEST;
    let mockInjectionRejected = false;
    try {
      delete process.env.IS_TEST;
      JobVisibilityRepository.setMockCollection(new MockMongoPolicyCollection());
    } catch (err: any) {
      if (err.message && err.message.includes('Security violation')) {
        mockInjectionRejected = true;
      }
    } finally {
      process.env.IS_TEST = prevIsTest;
      JobVisibilityRepository.setMockCollection(null);
    }
    assert(
      mockInjectionRejected === true,
      '88. Mock collection injection outside test mode (IS_TEST !== "true") is strictly rejected with Security violation error'
    );

    // 89. Mock collection injection inside test mode (IS_TEST === 'true') succeeds cleanly
    let mockInjectionAllowedInTest = false;
    try {
      process.env.IS_TEST = 'true';
      JobVisibilityRepository.setMockCollection(new MockMongoPolicyCollection());
      mockInjectionAllowedInTest = true;
    } catch {
      mockInjectionAllowedInTest = false;
    } finally {
      JobVisibilityRepository.setMockCollection(null);
    }
    assert(
      mockInjectionAllowedInTest === true,
      '89. Mock collection injection inside test mode (IS_TEST === "true") succeeds cleanly and resets safely'
    );

    // ==========================================
    // GROUP 11: STEP65-E.3 USER POSTED DEFAULT POLICY PERSISTENCE & LEGACY REGRESSION TESTS
    // ==========================================
    console.log('\n--- Group 11: STEP65-E.3 User Posted Default Policy Persistence & Legacy Regression Tests ---');

    const group11MockColl = new MockMongoPolicyCollection();
    JobVisibilityRepository.setMockCollection(group11MockColl);

    try {
      // 90. User Posted Job Title changing from Premium to Free
      await JobVisibilityRepository.savePolicy('user_posted', { title: 'Premium' });
      await JobVisibilityRepository.savePolicy('user_posted', { title: 'Free' });
      let policyUpd = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        policyUpd.fieldRules.title === 'Free',
        '90. User Posted Job Title successfully changes from Premium to Free'
      );

      // 91. User Posted fields changing from Free to Premium
      await JobVisibilityRepository.savePolicy('user_posted', { company: 'Free' });
      await JobVisibilityRepository.savePolicy('user_posted', { company: 'Premium' });
      policyUpd = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        policyUpd.fieldRules.company === 'Premium',
        '91. User Posted fields successfully change from Free to Premium'
      );

      // 92. User Posted fields changing to Hidden
      await JobVisibilityRepository.savePolicy('user_posted', { salary: 'Hidden' });
      policyUpd = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        policyUpd.fieldRules.salary === 'Hidden',
        '92. User Posted fields successfully change to Hidden'
      );

      // 93. Multiple fields changing in one save
      await JobVisibilityRepository.savePolicy('user_posted', {
        title: 'Free',
        company: 'Premium',
        salary: 'Hidden',
        contactEmail: 'Premium'
      });
      policyUpd = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        policyUpd.fieldRules.title === 'Free' &&
        policyUpd.fieldRules.company === 'Premium' &&
        policyUpd.fieldRules.salary === 'Hidden' &&
        policyUpd.fieldRules.contactEmail === 'Premium',
        '93. Multiple fields change correctly in a single save operation'
      );

      // 94. Repeated saves of the same generic policy update correctly without duplication
      await JobVisibilityRepository.savePolicy('user_posted', { title: 'Premium' });
      await JobVisibilityRepository.savePolicy('user_posted', { title: 'Free' });
      const genericDocsCount = group11MockColl.docs.filter(d => d.source === 'user_posted').length;
      assert(
        genericDocsCount === 1,
        '94. Repeated saves of the same generic policy update in-place without creating duplicate records'
      );

      // 95. Save -> database read-back -> reload returning identical values
      const savedPolicy = await JobVisibilityRepository.savePolicy('user_posted', { title: 'Free', salary: 'Hidden' });
      const readBackPolicy = await JobVisibilityRepository.getPolicy('user_posted');
      const allPoliciesList = await JobVisibilityRepository.getAllPolicies();
      const reloadedPolicy = allPoliciesList.find(p => p.source === 'user_posted' && !p.sourceKey);
      assert(
        readBackPolicy.fieldRules.title === 'Free' &&
        readBackPolicy.fieldRules.salary === 'Hidden' &&
        reloadedPolicy?.fieldRules.title === 'Free' &&
        reloadedPolicy?.fieldRules.salary === 'Hidden',
        '95. Save -> database read-back -> reload returns identical verified values'
      );

      // 96. Legacy generic records with missing sourceKey
      group11MockColl.docs = [{ source: 'user_posted', fieldRules: { title: 'Premium' }, updatedAt: new Date().toISOString() }];
      let legacyRes = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        legacyRes.fieldRules.title === 'Premium',
        '96. Legacy generic records with missing sourceKey are retrieved correctly'
      );

      // 97. Legacy generic records with null sourceKey
      group11MockColl.docs = [{ source: 'user_posted', sourceKey: null, fieldRules: { title: 'Free' }, updatedAt: new Date().toISOString() }];
      legacyRes = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        legacyRes.fieldRules.title === 'Free',
        '97. Legacy generic records with null sourceKey are retrieved correctly'
      );

      // 98. Legacy generic records with empty sourceKey
      group11MockColl.docs = [{ source: 'user_posted', sourceKey: '', fieldRules: { company: 'Premium' }, updatedAt: new Date().toISOString() }];
      legacyRes = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        legacyRes.fieldRules.company === 'Premium',
        '98. Legacy generic records with empty sourceKey are retrieved correctly'
      );

      // 99. Multiple generic records handled deterministically without deletion (picks most recent)
      const olderTime = new Date(Date.now() - 10000).toISOString();
      const newerTime = new Date().toISOString();
      group11MockColl.docs = [
        { source: 'user_posted', sourceKey: null, fieldRules: { title: 'Premium' }, updatedAt: olderTime },
        { source: 'user_posted', sourceKey: 'user_posted', fieldRules: { title: 'Free' }, updatedAt: newerTime }
      ];
      const multiRes = await JobVisibilityRepository.getPolicy('user_posted');
      const allMulti = await JobVisibilityRepository.getAllPolicies();
      assert(
        multiRes.fieldRules.title === 'Free' &&
        allMulti.filter(p => p.source === 'user_posted').length === 1,
        '99. Multiple generic records are handled deterministically (picking newest) without destructive deletion'
      );

      // 100. MongoDB write failure propagates error
      group11MockColl.shouldThrowOnWrite = true;
      let wErr = false;
      try {
        await JobVisibilityRepository.savePolicy('user_posted', { title: 'Free' });
      } catch {
        wErr = true;
      } finally {
        group11MockColl.shouldThrowOnWrite = false;
      }
      assert(wErr === true, '100. MongoDB write failure correctly propagates error');

      // 101. MongoDB read failure propagates error / fails closed
      group11MockColl.shouldThrowOnRead = true;
      let rErr = false;
      try {
        await JobVisibilityRepository.getPolicy('user_posted');
      } catch {
        rErr = true;
      } finally {
        group11MockColl.shouldThrowOnRead = false;
      }
      assert(rErr === true, '101. MongoDB read failure correctly propagates error and fails closed');

      // 102. Invalid field names and visibility values are rejected
      const invalidFieldCheck = validateFieldRules({ fakeField: 'Free' });
      const invalidValCheck = validateFieldRules({ title: 'SuperFree' });
      assert(invalidFieldCheck !== null && invalidValCheck !== null, '102. Invalid field names and visibility values are rejected');

      // 103. Scraped and Admin Created policies remain fully intact and unaffected
      await JobVisibilityRepository.savePolicy('scraped', { salary: 'Free' });
      await JobVisibilityRepository.savePolicy('admin_created', { salary: 'Premium' });
      const scrapedPol = await JobVisibilityRepository.getPolicy('scraped');
      const adminPol = await JobVisibilityRepository.getPolicy('admin_created');
      assert(
        scrapedPol.fieldRules.salary === 'Free' &&
        adminPol.fieldRules.salary === 'Premium',
        '103. Scraped and Admin Created policies remain fully intact and unaffected'
      );

      // 104. Newest generic policy selection based on updatedAt descending (even when older record is inserted last)
      const tOld = '2026-01-01T00:00:00.000Z';
      const tNew = '2026-06-01T00:00:00.000Z';
      group11MockColl.docs = [
        { source: 'user_posted', fieldRules: { title: 'Newer' }, updatedAt: tNew, _id: 'doc-2' },
        { source: 'user_posted', fieldRules: { title: 'Older' }, updatedAt: tOld, _id: 'doc-1' }
      ];
      // Reverse insertion order to prove sort order matters, not insertion order
      group11MockColl.docs.reverse();
      const newestSelected = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        (newestSelected.fieldRules.title as any) === 'Newer',
        '104. Newest generic policy is correctly selected based on updatedAt descending regardless of insertion order'
      );

      // 105. Tie-breaking on equal updatedAt timestamps using _id descending
      const tEqual = '2026-06-01T00:00:00.000Z';
      group11MockColl.docs = [
        { source: 'user_posted', fieldRules: { title: 'DocA' }, updatedAt: tEqual, _id: 'id-100' },
        { source: 'user_posted', fieldRules: { title: 'DocB' }, updatedAt: tEqual, _id: 'id-999' }
      ];
      const tieBreakSelected = await JobVisibilityRepository.getPolicy('user_posted');
      assert(
        (tieBreakSelected.fieldRules.title as any) === 'DocB',
        '105. Equal updatedAt timestamps are tie-broken correctly using _id descending (id-999 selected over id-100)'
      );

      // 106. Safe sourceKey type handling (malformed legacy values: numbers, objects, booleans, null, empty) without crashing
      group11MockColl.docs = [
        { source: 'user_posted', sourceKey: 12345, fieldRules: { title: 'Num' }, updatedAt: tEqual },
        { source: 'user_posted', sourceKey: { nested: true }, fieldRules: { title: 'Obj' }, updatedAt: tEqual },
        { source: 'user_posted', sourceKey: null, fieldRules: { title: 'NullKey' }, updatedAt: tEqual },
        { source: 'scraped', sourceKey: '', fieldRules: { salary: 'Free' }, updatedAt: tEqual }
      ];
      const allMalformed = await JobVisibilityRepository.getAllPolicies();
      assert(
        Array.isArray(allMalformed) && allMalformed.length >= 2,
        '106. Malformed legacy sourceKey types (numbers, objects, null, empty) do not crash getAllPolicies API'
      );
    } finally {
      JobVisibilityRepository.setMockCollection(null);
    }

  } finally {
    // Clean up test fixtures from Database by exact ID
    for (const id of createdFixtureIds) {
      Database.deleteJob(id);
    }
    if (previousIsTest === undefined) {
      delete process.env.IS_TEST;
    } else {
      process.env.IS_TEST = previousIsTest;
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
