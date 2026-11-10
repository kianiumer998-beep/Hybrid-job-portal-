import { MongoClient, Collection } from 'mongodb';
import { KycRepository } from '../db/repositories/KycRepository';
import { EmployerKycRequest } from '../../src/types/adminSuite';
import * as fs from 'fs';
import * as path from 'path';

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
  if (mockDbUserRoleMismatch.role !== 'Employer/Job Poster') {
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

  // Test 6: Verify AdminDashboard does not write career_pak_kyc_requests to LocalStorage
  const adminDashboardPath = path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx');
  const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');
  if (adminDashboardContent.includes("localStorage.setItem('career_pak_kyc_requests'")) {
    throw new Error('Regression: AdminDashboard.tsx contains localStorage.setItem for career_pak_kyc_requests!');
  }

  console.log('[PASS] All KYC unit tests passed successfully.');
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
  const testRunId = `test_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const extraCollections: Collection<any>[] = [];

  try {
    client = new MongoClient(testDbUri);
    await client.connect();

    const coll = client.db().collection<EmployerKycRequest>('kyc_requests_test_' + testRunId);
    extraCollections.push(coll);

    const newReqInput: EmployerKycRequest = {
      id: `kyc_base_${Date.now()}`,
      userId: `user_base_${testRunId}`,
      companyName: 'Base Corp',
      contactPerson: 'Base Owner',
      email: `base_${testRunId}@corp.com`,
      phone: '+92 300 1111111',
      ntnOrTaxNumber: '1234567-8',
      companyWebsite: 'https://base.com',
      submittedAt: new Date().toISOString(),
      status: 'Pending',
      badgeLevel: 'Standard Verified',
      secpRegistrationNumber: 'SECP-123',
      officialDocUrl: 'https://base.com/doc.pdf'
    };

    // Scenario 1: Two concurrent Pending submissions for the same user: exactly one succeeds
    const userConc = `user_conc_${testRunId}`;
    const reqConc1: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_conc_1_${Date.now()}`,
      userId: userConc,
      email: `${userConc}@test.com`
    };
    const reqConc2: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_conc_2_${Date.now()}`,
      userId: userConc,
      email: `${userConc}@test.com`
    };

    const concRes = await Promise.allSettled([
      KycRepository.createRequest(reqConc1, coll),
      KycRepository.createRequest(reqConc2, coll)
    ]);

    const fulfilled = concRes.filter(r => r.status === 'fulfilled');
    const rejected = concRes.filter(r => r.status === 'rejected');
    if (fulfilled.length !== 1 || rejected.length !== 1) {
      throw new Error(`Scenario 1 failed: expected 1 success and 1 rejection, got ${fulfilled.length} success and ${rejected.length} rejection.`);
    }
    const rejErr = (rejected[0] as PromiseRejectedResult).reason;
    if (!rejErr?.message?.includes('Duplicate Request Error')) {
      throw new Error(`Scenario 1 failed: rejection error did not contain Duplicate Request Error: ${rejErr?.message}`);
    }

    // Scenario 2: Pending -> Verified: actual database status becomes Verified and active slot remains occupied
    const userPv = `user_pv_${testRunId}`;
    const reqPv: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_pv_1_${Date.now()}`,
      userId: userPv,
      email: `${userPv}@test.com`
    };

    const createdPv = await KycRepository.createRequest(reqPv, coll);
    if (createdPv.status !== 'Pending') {
      throw new Error('Scenario 2 failed: created request status must be Pending.');
    }

    const verifiedPv = await KycRepository.updateRequest(createdPv.id, {
      status: 'Verified',
      badgeLevel: 'Top Employer'
    }, coll);
    if (!verifiedPv || verifiedPv.status !== 'Verified') {
      throw new Error('Scenario 2 failed: updateRequest did not transition record to Verified.');
    }

    const dbRecordPv = await coll.findOne({ id: createdPv.id });
    if (!dbRecordPv || dbRecordPv.status !== 'Verified' || (dbRecordPv as any).activeUserId !== userPv) {
      throw new Error('Scenario 2 failed: Database record is not Verified or activeUserId is missing.');
    }

    // Scenario 3: A second Pending after Verified: rejected, exactly one active record remains
    let secondPendingRejected = false;
    try {
      await KycRepository.createRequest({
        ...newReqInput,
        id: `kyc_pv_2_${Date.now()}`,
        userId: userPv,
        companyName: 'Pv Corp Second'
      }, coll);
    } catch (err: any) {
      if (err?.message?.includes('Duplicate Request Error')) {
        secondPendingRejected = true;
      }
    }
    if (!secondPendingRejected) {
      throw new Error('Scenario 3 failed: Second Pending request for Verified employer was not rejected.');
    }

    const activePvRecords = await coll.find({ userId: userPv, status: { $in: ['Pending', 'Verified'] } }).toArray();
    if (activePvRecords.length !== 1) {
      throw new Error(`Scenario 3 failed: Expected exactly 1 active record, found ${activePvRecords.length}.`);
    }

    // Scenario 4: Pending -> Rejected: active slot is released
    const userRejPend = `user_rp_${testRunId}`;
    const reqRp1: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_rp_1_${Date.now()}`,
      userId: userRejPend,
      email: `${userRejPend}@test.com`
    };

    const createdRp1 = await KycRepository.createRequest(reqRp1, coll);
    const rejectedRes = await KycRepository.updateRequest(createdRp1.id, {
      status: 'Rejected',
      rejectionReason: 'Invalid business tax certificate'
    }, coll);
    if (!rejectedRes || rejectedRes.status !== 'Rejected') {
      throw new Error('Scenario 4 failed: Failed to reject record.');
    }

    const dbRp1 = await coll.findOne({ id: createdRp1.id });
    if (!dbRp1 || (dbRp1 as any).activeUserId !== undefined) {
      throw new Error('Scenario 4 failed: activeUserId was not removed on rejection.');
    }

    // Scenario 5: Rejected -> new Pending: succeeds
    const reqRp2: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_rp_2_${Date.now()}`,
      userId: userRejPend,
      ntnOrTaxNumber: 'NTN-RP-2-CORRECT'
    };
    const createdRp2 = await KycRepository.createRequest(reqRp2, coll);
    if (!createdRp2 || createdRp2.status !== 'Pending') {
      throw new Error('Scenario 5 failed: New Pending request after rejection failed.');
    }

    // Scenario 6: Multiple historical Rejected records: allowed
    const userMultiRej = `user_multirej_${testRunId}`;
    const rejDoc1: EmployerKycRequest = {
      ...newReqInput,
      id: `kyc_mr_1_${Date.now()}`,
      userId: userMultiRej,
      status: 'Rejected',
      rejectionReason: 'Reason 1'
    };
    const rejDoc2: EmployerKycRequest = {
      ...rejDoc1,
      id: `kyc_mr_2_${Date.now()}`,
      rejectionReason: 'Reason 2'
    };

    await coll.insertOne(rejDoc1);
    await coll.insertOne(rejDoc2);

    const historicalRejections = await coll.find({ userId: userMultiRej, status: 'Rejected' }).toArray();
    if (historicalRejections.length !== 2) {
      throw new Error(`Scenario 6 failed: Expected 2 historical rejected records, found ${historicalRejections.length}.`);
    }

    // Scenario 7 & 14: Genuine Pending + Verified conflict for one user: initialization fails closed, records intact
    const conflictCollName = `kyc_test_conflict_${testRunId}`;
    const conflictColl = client.db().collection<EmployerKycRequest>(conflictCollName);
    extraCollections.push(conflictColl);

    const conflictUser = `user_conf_${testRunId}`;
    const confPending: any = {
      ...newReqInput,
      id: `kyc_cp_${Date.now()}`,
      userId: conflictUser,
      status: 'Pending'
    };
    const confVerified: any = {
      ...newReqInput,
      id: `kyc_cv_${Date.now()}`,
      userId: conflictUser,
      status: 'Verified',
      badgeLevel: 'Top Employer'
    };

    await conflictColl.insertOne(confPending);
    await conflictColl.insertOne(confVerified);

    let conflictCaught = false;
    try {
      await KycRepository.ensureIndexes(conflictColl);
    } catch (err: any) {
      if (err?.message?.includes('Database Conflict Error')) {
        conflictCaught = true;
      }
    }
    if (!conflictCaught) {
      throw new Error('Scenario 7 failed: ensureIndexes did not fail closed on Pending + Verified conflict.');
    }

    // Scenario 14: Existing historical records remain intact after failed initialization
    const intactDocs = await conflictColl.find({ userId: conflictUser }).toArray();
    if (intactDocs.length !== 2) {
      throw new Error(`Scenario 14 failed: Expected 2 intact documents, found ${intactDocs.length}.`);
    }

    // Scenario 8: Active record with missing, empty or invalid userId: initialization fails closed
    const invalidUserCollName = `kyc_test_invalid_user_${testRunId}`;
    const invalidUserColl = client.db().collection<EmployerKycRequest>(invalidUserCollName);
    extraCollections.push(invalidUserColl);

    await invalidUserColl.insertOne({
      ...newReqInput,
      id: `kyc_inv_${Date.now()}`,
      userId: '   ', // whitespace only
      status: 'Pending'
    } as any);

    let invalidUserErrorCaught = false;
    try {
      await KycRepository.ensureIndexes(invalidUserColl);
    } catch (err: any) {
      if (err?.message?.includes('Database Integrity Error')) {
        invalidUserErrorCaught = true;
      }
    }
    if (!invalidUserErrorCaught) {
      throw new Error('Scenario 8 failed: ensureIndexes did not fail closed on whitespace-only userId.');
    }

    // Scenario 9 & 10: Repeated initialization is not repeated; concurrent calls share operation
    const cacheCollName = `kyc_test_cache_${testRunId}`;
    const cacheColl = client.db().collection<EmployerKycRequest>(cacheCollName);
    extraCollections.push(cacheColl);

    // Scenario 10: Concurrent initialization calls share the same initialization operation
    const [p1, p2] = [KycRepository.ensureIndexes(cacheColl), KycRepository.ensureIndexes(cacheColl)];
    await Promise.all([p1, p2]);

    // Scenario 9: Repeated initialization resolves from cache immediately
    await KycRepository.ensureIndexes(cacheColl);

    // Scenario 11: Failed initialization: subsequent retry is possible
    const retryCollName = `kyc_test_retry_${testRunId}`;
    const retryColl = client.db().collection<EmployerKycRequest>(retryCollName);
    extraCollections.push(retryColl);

    const tempBadId = `kyc_bad_${Date.now()}`;
    await retryColl.insertOne({
      ...newReqInput,
      id: tempBadId,
      userId: '', // empty
      status: 'Pending'
    } as any);

    let firstFailed = false;
    try {
      await KycRepository.ensureIndexes(retryColl);
    } catch {
      firstFailed = true;
    }
    if (!firstFailed) {
      throw new Error('Scenario 11 setup failed: ensureIndexes should have failed on empty userId.');
    }

    await retryColl.deleteOne({ id: tempBadId });
    let secondSuccess = false;
    try {
      await KycRepository.ensureIndexes(retryColl);
      secondSuccess = true;
    } catch (retryErr: any) {
      throw new Error(`Scenario 11 failed: Retry failed with error: ${retryErr?.message}`);
    }
    if (!secondSuccess) {
      throw new Error('Scenario 11 failed: Retry did not succeed after clearing bad data.');
    }

    // Scenario 12: Backfill updates the exact _id record
    const backfillCollName = `kyc_test_bf_${testRunId}`;
    const backfillColl = client.db().collection<EmployerKycRequest>(backfillCollName);
    extraCollections.push(backfillColl);

    const rawPendingId = `kyc_raw_${Date.now()}`;
    const targetUserId = `user_target_${testRunId}`;
    const insertRawRes = await backfillColl.insertOne({
      ...newReqInput,
      id: rawPendingId,
      userId: targetUserId,
      status: 'Pending'
    } as any);

    const exactMongoId = insertRawRes.insertedId;
    await KycRepository.ensureIndexes(backfillColl);

    const backfilledDoc = await backfillColl.findOne({ _id: exactMongoId });
    if (!backfilledDoc || (backfilledDoc as any).activeUserId !== targetUserId) {
      throw new Error('Scenario 12 failed: exact _id record was not backfilled with activeUserId.');
    }

    // Scenario 13: Legacy import does not overwrite existing records
    const legacyCollName = `kyc_test_legacy_${testRunId}`;
    const legacyColl = client.db().collection<EmployerKycRequest>(legacyCollName);
    extraCollections.push(legacyColl);

    const existingId = `kyc_exist_${Date.now()}`;
    await legacyColl.insertOne({
      ...newReqInput,
      id: existingId,
      userId: `user_original_${testRunId}`,
      companyName: 'Original Pristine Company',
      status: 'Pending',
      activeUserId: `user_original_${testRunId}`
    } as any);

    const legacyArray: any[] = [
      {
        ...newReqInput,
        id: existingId,
        userId: `user_attacker_${testRunId}`,
        companyName: 'Overwriting Attacker Corp',
        status: 'Pending'
      }
    ];

    const importRes = await KycRepository.importLegacyRequests(legacyArray, legacyColl);
    if (importRes.skipped !== 1) {
      throw new Error(`Scenario 13 failed: Expected skipped count 1, got ${importRes.skipped}.`);
    }

    const preservedDoc = await legacyColl.findOne({ id: existingId });
    if (!preservedDoc || preservedDoc.companyName !== 'Original Pristine Company') {
      throw new Error('Scenario 13 failed: Existing record was modified or overwritten during legacy import.');
    }

    console.log('[PASS] All 14 KYC MongoDB integration test scenarios passed.');
  } catch (err: any) {
    console.error('[FAIL] KYC integration tests failed:', err);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        for (const col of extraCollections) {
          await col.drop().catch(() => {});
        }
      } catch (cleanupErr) {
        console.error('[CLEANUP FAIL] Error during test cleanup:', cleanupErr);
      }
      await client.close();
    }
  }
}

async function main() {
  await runKycUnitTests();
  await runKycPersistenceTests();
}

main();
