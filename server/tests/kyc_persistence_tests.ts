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

    // 2. Duplicate active request check
    let duplicateErrorCaught = false;
    try {
      await KycRepository.createRequest({
        ...newReqInput,
        id: `kyc_test_${Date.now()}_dup`,
        companyName: 'Duplicate Corp Attempt'
      }, coll);
    } catch (err: any) {
      if (err?.message?.includes('Duplicate')) {
        duplicateErrorCaught = true;
      }
    }
    if (!duplicateErrorCaught) throw new Error('Duplicate active request check failed to throw error');

    // 3. Approval persistence & fresh DB read
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

    // 4. Transition on finalized (Verified) request should be rejected
    const invalidTransition = await KycRepository.updateRequest(createdReq.id, {
      status: 'Rejected',
      rejectionReason: 'Invalid transition attempt'
    }, coll);
    if (invalidTransition !== null) {
      throw new Error('Update on finalized request must return null and be rejected');
    }

    // 5. Rejection persistence for a second user
    const uniqueUserId2 = `user_${testRunId}_2`;
    const createdReq2 = await KycRepository.createRequest({
      ...newReqInput,
      id: `kyc_test_${Date.now()}_2`,
      userId: uniqueUserId2,
      companyName: 'Test Corp Beta',
      email: `${uniqueUserId2}@corp.com`
    }, coll);
    createdIds.push(createdReq2.id);

    const rejected = await KycRepository.updateRequest(createdReq2.id, {
      status: 'Rejected',
      rejectionReason: 'Tax ID mismatch'
    }, coll);
    if (!rejected || rejected.status !== 'Rejected' || rejected.rejectionReason !== 'Tax ID mismatch') {
      throw new Error('Rejection update failed');
    }

    // 6. Legacy import with optional fields containing null
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

    // 7. Legacy import preserving existing records ($setOnInsert)
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

    console.log('[PASS] All KYC integration tests passed.');
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

runKycPersistenceTests();
