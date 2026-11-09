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

  try {
    client = new MongoClient(testDbUri);
    await client.connect();
    const coll = client.db().collection('kyc_requests');

    // 1. Valid KYC record save & retrieval
    const req: EmployerKycRequest = {
      id: `test_${Date.now()}`,
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
    
    const retrieved = await KycRepository.getAll();
    if (!retrieved.find(r => r.id === req.id)) throw new Error('Failed to retrieve');

    // 2. Approval persistence
    await KycRepository.updateRequest(req.id, { status: 'Verified', verifiedAt: '2026-11-09 10:00', badgeLevel: 'Top Employer' });
    const approved = await KycRepository.getAll();
    if (approved.find(r => r.id === req.id)?.status !== 'Verified') throw new Error('Approval failed');

    // 3. Rejection persistence
    const req2: EmployerKycRequest = { ...req, id: `test2_${Date.now()}`, status: 'Pending' };
    await coll.insertOne(req2);
    createdIds.push(req2.id);
    await KycRepository.updateRequest(req2.id, { status: 'Rejected', rejectionReason: 'Bad Docs' });
    const rejected = await KycRepository.getAll();
    if (rejected.find(r => r.id === req2.id)?.rejectionReason !== 'Bad Docs') throw new Error('Rejection failed');

    // 4. Legacy import (non-destructive)
    const legacy: EmployerKycRequest[] = [
      { ...req, id: 'kyc-01' }, // Should be skipped (Rule 3)
      { ...req, id: 'kyc-05', companyName: 'Legacy Corp' } // Should be imported
    ];
    await KycRepository.importLegacyRequests(legacy);
    const imported = await KycRepository.getAll();
    if (imported.find(r => r.id === 'kyc-01')) throw new Error('Sample record kyc-01 imported');
    if (!imported.find(r => r.id === 'kyc-05')) throw new Error('Legacy record kyc-05 not imported');

    console.log('[PASS] All KYC integration tests passed.');
  } catch (err: any) {
    console.error('[FAIL] KYC integration tests failed:', err);
    process.exit(1);
  } finally {
    if (client) {
      const coll = client.db().collection('kyc_requests');
      for (const id of createdIds) await coll.deleteOne({ id });
      await client.close();
    }
  }
}

runKycPersistenceTests();
