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

    // 1. Valid KYC record save & retrieval
    const uniqueId1 = `${testRunId}_1`;
    const req: EmployerKycRequest = {
      id: uniqueId1,
      userId: 'user1',
      companyName: 'Test Corp',
      contactPerson: 'Tester',
      email: 'test@corp.com',
      phone: '123',
      ntnOrTaxNumber: '12345',
      companyWebsite: 'https://test.com',
      submittedAt: new Date().toISOString(),
      status: 'Pending',
      badgeLevel: 'Standard Verified'
    };
    await coll.insertOne(req);
    createdIds.push(req.id);
    
    const retrieved = await KycRepository.getAll(coll);
    if (!retrieved.find(r => r.id === req.id)) throw new Error('Failed to retrieve');

    // 2. Approval persistence
    const approved = await KycRepository.updateRequest(req.id, { status: 'Verified', verifiedAt: '2026-11-09 10:00', badgeLevel: 'Top Employer' }, coll);
    if (!approved || approved.status !== 'Verified') throw new Error('Approval failed');

    // 3. Rejection persistence
    const uniqueId2 = `${testRunId}_2`;
    const req2: EmployerKycRequest = { ...req, id: uniqueId2, status: 'Pending' };
    await coll.insertOne(req2);
    createdIds.push(req2.id);
    const rejected = await KycRepository.updateRequest(req2.id, { status: 'Rejected', rejectionReason: 'Bad Docs' }, coll);
    if (!rejected || rejected.rejectionReason !== 'Bad Docs') throw new Error('Rejection failed');

    // 4. Legacy import (non-destructive)
    const uniqueLegacyId = `${testRunId}_legacy`;
    const legacy: EmployerKycRequest[] = [
      { ...req, id: 'kyc-01', status: 'Pending' }, // Should be skipped (Rule 3)
      { ...req, id: uniqueLegacyId, companyName: 'Legacy Corp', status: 'Pending', contactPerson: 'L', email: 'l@l.com', phone: '1', ntnOrTaxNumber: '1', companyWebsite: 'h://l.com', submittedAt: '2' } // Should be imported
    ];
    const importRes = await KycRepository.importLegacyRequests(legacy, coll);
    if (importRes.imported === 1) {
      createdIds.push(uniqueLegacyId);
    }
    const imported = await KycRepository.getAll(coll);
    if (imported.find(r => r.id === 'kyc-01')) throw new Error('Sample record kyc-01 imported');
    if (!imported.find(r => r.id === uniqueLegacyId)) throw new Error(`Legacy record ${uniqueLegacyId} not imported`);

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
