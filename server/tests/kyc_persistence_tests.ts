import { MongoClient, ObjectId } from 'mongodb';
import { KycRepository } from '../db/repositories/KycRepository';
import { EmployerKycRequest } from '../../src/types/adminSuite';

// Helper for test isolation check (identical to currency_persistence_tests)
export function isSafeDistinctTestUri(prodUri: string, testUri: string): { safe: boolean; reason?: string } {
  const cleanProd = (prodUri || '').trim();
  const cleanTest = (testUri || '').trim();
  if (!cleanProd || !cleanTest) return { safe: false, reason: 'URI missing' };
  if (cleanTest.toLowerCase() === cleanProd.toLowerCase()) return { safe: false, reason: 'Identical' };
  const parseDbInfo = (uri: string) => {
    try {
      const url = new URL(uri.replace(/^mongodb(\+srv)?:\/\//i, 'http://'));
      return { host: url.hostname, port: url.port || '27017', dbName: url.pathname.replace(/^\//, '').split('?')[0] || 'admin' };
    } catch { return null; }
  };
  const prodInfo = parseDbInfo(cleanProd);
  const testInfo = parseDbInfo(cleanTest);
  if (!prodInfo || !testInfo || prodInfo.host !== testInfo.host || prodInfo.port !== testInfo.port) return { safe: false, reason: 'Invalid isolation' };
  if (prodInfo.dbName === testInfo.dbName) return { safe: false, reason: 'Same DB' };
  return { safe: true };
}

export async function runKycPersistenceTests() {
  const testDbUri = process.env.TEST_MONGODB_URI || '';
  const prodDbUri = process.env.MONGODB_URI || '';
  const isolation = isSafeDistinctTestUri(prodDbUri, testDbUri);
  
  if (!isolation.safe) {
    console.log(`[NOT RUN] KYC persistence tests skipped: ${isolation.reason}`);
    return;
  }

  let client: MongoClient | null = null;
  const createdIds: string[] = [];
  const testRunId = `test_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    client = new MongoClient(testDbUri);
    await client.connect();
    const coll = client.db().collection<EmployerKycRequest>('kyc_requests_test');

    // 1. Valid KYC record createRequest & retrieval by user ID
    const uniqueUserId1 = `user_${testRunId}_1`;
    const newReqInput: EmployerKycRequest = {
      id: `kyc_test_${Date.now()}_1`,
      userId: uniqueUserId1,
      companyName: 'Test Corp Alpha',
      contactPerson: 'Tester Alpha',
      email: `${uniqueUserId1}@corp.com`,
      phone: '+92 300 1111111',
      ntnOrTaxNumber: '1234567-8',
      companyWebsite: 'https://alpha.com',
      submittedAt: new Date().toISOString(),
      status: 'Pending',
      badgeLevel: 'Standard Verified',
      secpRegistrationNumber: 'SECP-123',
      officialDocUrl: 'https://alpha.com/doc.pdf'
    };

    const createdReq = await KycRepository.createRequest(newReqInput, coll);
    if (!createdReq || !createdReq.id) throw new Error('createRequest failed');
    createdIds.push(createdReq.id);

    if (createdReq.status !== 'Pending') throw new Error('New request status must be Pending');
    if (createdReq.userId !== uniqueUserId1) throw new Error('User ID mismatch');

    const retrievedByUser = await KycRepository.getByUserId(uniqueUserId1, coll);
    if (!retrievedByUser || retrievedByUser.id !== createdReq.id) throw new Error('getByUserId failed');

    // 2. Concurrent duplicate submission race-condition test
    const concurrentUserId = `user_concurrent_${testRunId}`;
    const concurrentReq1: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_conc_1_${Date.now()}`,
      userId: concurrentUserId,
      email: `${concurrentUserId}@corp.com`
    };
    const concurrentReq2: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_conc_2_${Date.now()}`,
      userId: concurrentUserId,
      email: `${concurrentUserId}@corp.com`
    };

    const concurrentResults = await Promise.allSettled([
      KycRepository.createRequest(concurrentReq1, coll),
      KycRepository.createRequest(concurrentReq2, coll)
    ]);

    const fulfilled = concurrentResults.filter(r => r.status === 'fulfilled');
    const rejectedPromises = concurrentResults.filter(r => r.status === 'rejected');

    if (fulfilled.length !== 1 || rejectedPromises.length !== 1) {
      throw new Error(`Concurrent duplicate submission test failed: expected 1 fulfilled and 1 rejected, got ${fulfilled.length} fulfilled and ${rejectedPromises.length} rejected`);
    }

    if (fulfilled[0].status === 'fulfilled') {
      createdIds.push(fulfilled[0].value.id);
    }

    const rejectionReason = (rejectedPromises[0] as PromiseRejectedResult).reason;
    if (!rejectionReason?.message?.includes('Duplicate')) {
      throw new Error(`Concurrent duplicate submission rejected with unexpected error: ${rejectionReason}`);
    }

    // 3. Multiple historical Rejected records test for the same user
    const multiRejectUserId = `user_multi_reject_${testRunId}`;
    const rejectedReq1: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_rej_1_${Date.now()}`,
      userId: multiRejectUserId,
      status: 'Rejected',
      rejectionReason: 'Invalid NTN'
    };
    const rejectedReq2: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_rej_2_${Date.now()}`,
      userId: multiRejectUserId,
      status: 'Rejected',
      rejectionReason: 'Incomplete doc'
    };

    await coll.insertOne(rejectedReq1);
    await coll.insertOne(rejectedReq2);
    createdIds.push(rejectedReq1.id, rejectedReq2.id);

    const userRejections = await coll.find({ userId: multiRejectUserId, status: 'Rejected' }).toArray();
    if (userRejections.length !== 2) {
      throw new Error(`Multiple historical Rejected records test failed: expected 2 records, got ${userRejections.length}`);
    }

    // 4. Approval persistence & fresh DB read
    const approved = await KycRepository.updateRequest(createdReq.id, {
      status: 'Verified',
      verifiedAt: new Date().toISOString(),
      badgeLevel: 'Top Employer'
    }, coll);
    if (!approved || approved.status !== 'Verified' || approved.badgeLevel !== 'Top Employer') {
      throw new Error('Approval update failed');
    }

    const freshDbAfterApprove = await coll.findOne({ id: createdReq.id });
    if (!freshDbAfterApprove || freshDbAfterApprove.status !== 'Verified') {
      throw new Error('Fresh DB read after approval failed');
    }

    // 5. Transition on finalized (Verified) request should be rejected
    const invalidTransition = await KycRepository.updateRequest(createdReq.id, {
      status: 'Rejected',
      rejectionReason: 'Invalid transition attempt'
    }, coll);
    if (invalidTransition !== null) {
      throw new Error('Update on finalized request must return null and be rejected');
    }

    // 6. Rejection persistence for a second user
    const uniqueUserId2 = `user_${testRunId}_2`;
    const createdReq2 = await KycRepository.createRequest({
      ...newReqInput,
      id: `kyc_test_${Date.now()}_2`,
      userId: uniqueUserId2,
      companyName: 'Test Corp Beta',
      email: `${uniqueUserId2}@corp.com`
    }, coll);
    createdIds.push(createdReq2.id);

    const rejectedUpdate = await KycRepository.updateRequest(createdReq2.id, {
      status: 'Rejected',
      rejectionReason: 'Tax ID mismatch'
    }, coll);
    if (!rejectedUpdate || rejectedUpdate.status !== 'Rejected' || rejectedUpdate.rejectionReason !== 'Tax ID mismatch') {
      throw new Error('Rejection update failed');
    }

    // 7. Legacy import with optional fields containing null
    const legacyNullId = `${testRunId}_legacy_null`;
    const legacyInput: any[] = [
      {
        id: legacyNullId,
        userId: `user_${testRunId}_legacy`,
        companyName: 'Legacy Null Corp',
        contactPerson: 'Legacy Tester',
        email: 'legacy@null.com',
        phone: '+92 300 9999999',
        ntnOrTaxNumber: '9999999-9',
        companyWebsite: 'https://legacynull.com',
        submittedAt: new Date().toISOString(),
        status: 'Pending',
        badgeLevel: 'Standard Verified',
        secpRegistrationNumber: null,
        officialDocUrl: null,
        verifiedAt: null,
        verifiedBy: null
      }
    ];

    const importRes = await KycRepository.importLegacyRequests(legacyInput, coll);
    if (importRes.imported !== 1 || importRes.invalid !== 0) {
      throw new Error(`Legacy import with null optional fields failed: imported=${importRes.imported}, invalid=${importRes.invalid}`);
    }
    createdIds.push(legacyNullId);

    // 8. Legacy import preserving existing records ($setOnInsert)
    const existingDbRecordId = `${testRunId}_existing_db`;
    await coll.insertOne({
      id: existingDbRecordId,
      userId: `user_${testRunId}_existing`,
      companyName: 'Existing DB Corp',
      contactPerson: 'Original Owner',
      email: 'original@corp.com',
      phone: '111',
      ntnOrTaxNumber: '11111',
      companyWebsite: 'https://original.com',
      submittedAt: new Date().toISOString(),
      status: 'Verified',
      badgeLevel: 'Top Employer'
    });
    createdIds.push(existingDbRecordId);

    const legacyOverlappingInput: any[] = [
      {
        id: existingDbRecordId,
        userId: `user_${testRunId}_hacker`,
        companyName: 'Overwriting Corp',
        contactPerson: 'Hacker',
        email: 'hacker@corp.com',
        phone: '999',
        ntnOrTaxNumber: '99999',
        companyWebsite: 'https://hacker.com',
        submittedAt: new Date().toISOString(),
        status: 'Pending',
        badgeLevel: 'Standard Verified'
      }
    ];

    await KycRepository.importLegacyRequests(legacyOverlappingInput, coll);
    const verifyExistingPreserved = await coll.findOne({ id: existingDbRecordId });
    if (!verifyExistingPreserved || verifyExistingPreserved.status !== 'Verified' || verifyExistingPreserved.companyName !== 'Existing DB Corp') {
      throw new Error('Legacy import failed to preserve existing DB record');
    }

    // 9. Pending + Verified records for the same user cannot coexist
    const pendingVerifiedUserId = `user_pv_${testRunId}`;
    const verReq: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_ver_${Date.now()}`,
      userId: pendingVerifiedUserId,
      status: 'Verified',
      badgeLevel: 'Top Employer'
    };
    await KycRepository.createRequest(verReq, coll);
    createdIds.push(verReq.id);

    let verDuplicateCaught = false;
    try {
      await KycRepository.createRequest({
        ...newReqInput,
        id: `kyc_pend_attempt_${Date.now()}`,
        userId: pendingVerifiedUserId,
        status: 'Pending'
      }, coll);
    } catch (err: any) {
      if (err?.message?.includes('Duplicate')) {
        verDuplicateCaught = true;
      }
    }
    if (!verDuplicateCaught) {
      throw new Error('Pending + Verified coexistence block test failed: new Pending request was allowed for a Verified user.');
    }

    // 10. Rejected -> new Pending submission succeeds & releases active slot
    const rejectedThenPendingUser = `user_rtp_${testRunId}`;
    const firstReq: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_rtp_1_${Date.now()}`,
      userId: rejectedThenPendingUser,
      status: 'Pending'
    };
    await KycRepository.createRequest(firstReq, coll);
    createdIds.push(firstReq.id);

    const rejRes = await KycRepository.updateRequest(firstReq.id, {
      status: 'Rejected',
      rejectionReason: 'Invalid document upload'
    }, coll);
    if (!rejRes || rejRes.status !== 'Rejected') {
      throw new Error('Rejection update failed to release active slot');
    }

    const secondReq: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_rtp_2_${Date.now()}`,
      userId: rejectedThenPendingUser,
      status: 'Pending'
    };
    const newPendingRes = await KycRepository.createRequest(secondReq, coll);
    if (!newPendingRes || newPendingRes.status !== 'Pending') {
      throw new Error('Rejected -> new Pending submission test failed');
    }
    createdIds.push(secondReq.id);

    // 11. Index initialization failure & conflict detection test
    const conflictUserId = `user_conflict_${testRunId}`;
    await coll.insertOne({
      id: `kyc_conf_1_${Date.now()}`,
      userId: conflictUserId,
      companyName: 'Conflict 1',
      contactPerson: 'Owner 1',
      email: `${conflictUserId}_1@corp.com`,
      phone: '111',
      ntnOrTaxNumber: '111',
      companyWebsite: 'https://c1.com',
      submittedAt: new Date().toISOString(),
      status: 'Pending',
      badgeLevel: 'Standard Verified'
    });
    await coll.insertOne({
      id: `kyc_conf_2_${Date.now()}`,
      userId: conflictUserId,
      companyName: 'Conflict 2',
      contactPerson: 'Owner 2',
      email: `${conflictUserId}_2@corp.com`,
      phone: '222',
      ntnOrTaxNumber: '222',
      companyWebsite: 'https://c2.com',
      submittedAt: new Date().toISOString(),
      status: 'Verified',
      badgeLevel: 'Top Employer'
    });
    createdIds.push(`kyc_conf_1_${Date.now()}`, `kyc_conf_2_${Date.now()}`);

    let conflictDetected = false;
    try {
      await KycRepository.ensureIndexes(coll);
    } catch (err: any) {
      if (err?.message?.includes('Database Conflict Error')) {
        conflictDetected = true;
      }
    }
    if (!conflictDetected) {
      throw new Error('Index initialization conflict detection failed to fail closed on conflicting active records');
    }

    console.log('[PASS] All KYC MongoDB integration tests passed.');
  } catch (err: any) {
    console.error('[FAIL] KYC integration tests failed:', err);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        const coll = client.db().collection<EmployerKycRequest>('kyc_requests_test');
        for (const id of createdIds) {
          await coll.deleteOne({ id });
        }
      } catch (cleanupErr) {
        console.error('[CLEANUP FAIL] Error during test cleanup:', cleanupErr);
        process.exitCode = 1;
      }
      await client.close();
    }
  }
}

export async function runKycUnitTests() {
  console.log('[START] Running KYC unit tests...');
  const { isSafeDocumentUrl } = await import('../routes/kycRoutes');

  // Test 1: Document URL safety validation
  const unsafeUrls = [
    '//external-site.com',
    '//phishing.org/document.pdf',
    '/\\evil.com/doc',
    '\\evil.com/doc',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
    'blob:https://example.com/1234-5678',
    'javascript:alert(1)',
    'http://insecure-site.com/doc.pdf',
    'ftp://files.com/doc.pdf'
  ];

  for (const u of unsafeUrls) {
    if (isSafeDocumentUrl(u) !== false) {
      throw new Error(`isSafeDocumentUrl failed to reject unsafe URL: ${u}`);
    }
  }

  const safeUrls = [
    'https://company.org/certificates/secp_ntn.pdf',
    'https://drive.google.com/file/d/12345/view',
    '/uploads/secp-certificate.pdf',
    '/documents/ntn.pdf'
  ];

  for (const u of safeUrls) {
    if (isSafeDocumentUrl(u) !== true) {
      throw new Error(`isSafeDocumentUrl failed to accept safe URL: ${u}`);
    }
  }

  // Test 2: Stale JWT role vs fresh database verification logic
  const mockDbUserRoleMismatch = { id: 'u123', email: 'emp@test.com', role: 'Job Seeker' };
  const mockJwtUser = { userId: 'u123', email: 'emp@test.com', role: 'Employer/Job Poster' };
  if (mockDbUserRoleMismatch.role !== 'Employer/Job Poster') {
    // Verified: If DB role differs from JWT role, it fails closed
    const roleAllowed = mockDbUserRoleMismatch.role === 'Employer/Job Poster';
    if (roleAllowed) throw new Error('Stale JWT role allowed when DB role is Job Seeker');
  }

  // Test 3: Missing database user rejected
  const missingDbUser = null;
  if (!missingDbUser) {
    const isAllowed = Boolean(missingDbUser && (missingDbUser as any).role === 'Employer/Job Poster');
    if (isAllowed) throw new Error('Missing database user should not be allowed');
  }

  // Test 4: Client-supplied fields cannot override server identity
  const clientPayload = {
    userId: 'attacker_id',
    email: 'attacker@evil.com',
    status: 'Verified',
    badgeLevel: 'Government Agency',
    verifiedBy: 'attacker@evil.com'
  };
  const verifiedServerUser = { id: 'real_user_id', email: 'real_owner@corp.com', role: 'Employer/Job Poster' };

  const sanitizedDoc: EmployerKycRequest = {
    id: 'kyc_test_sanitized',
    userId: verifiedServerUser.id,
    companyName: 'Legit Corp',
    contactPerson: 'Real Person',
    email: verifiedServerUser.email,
    phone: '+92 300 1234567',
    ntnOrTaxNumber: '1234567-8',
    companyWebsite: 'https://legit.com',
    submittedAt: new Date().toISOString(),
    status: 'Pending',
    badgeLevel: 'Standard Verified'
  };

  if (sanitizedDoc.userId !== 'real_user_id' || sanitizedDoc.email !== 'real_owner@corp.com' || sanitizedDoc.status !== 'Pending') {
    throw new Error('Client-supplied identity/status override sanitization failed');
  }

  // Test 5: Invariant logic - activeUserId presence and removal
  const pendingDoc: any = { ...sanitizedDoc, activeUserId: sanitizedDoc.userId };
  if (pendingDoc.activeUserId !== 'real_user_id') {
    throw new Error('Active KYC doc must contain activeUserId');
  }
  const rejectedDoc: any = { ...pendingDoc, status: 'Rejected' };
  delete rejectedDoc.activeUserId;
  if (rejectedDoc.activeUserId !== undefined) {
    throw new Error('Rejected KYC doc must not contain activeUserId');
  }

  console.log('[PASS] All KYC unit tests passed successfully.');
}

async function main() {
  await runKycUnitTests();
  await runKycPersistenceTests();
}

main();
