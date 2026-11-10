import { MongoClient, Collection } from 'mongodb';
import {
  BroadcastRepository,
  validateBroadcastPayload,
  isBroadcastCollectionInitialized,
  SYNTHETIC_CAMPAIGN_IDS,
  LegacyImportResult
} from '../db/repositories/BroadcastRepository';
import { BroadcastCampaign } from '../../src/types/adminSuite';
import * as fs from 'fs';
import * as path from 'path';

// Helper for test isolation check (identical to kyc and currency persistence tests)
export function isSafeDistinctTestUri(prodUri: string, testUri: string): { safe: boolean; reason?: string } {
  const cleanProd = (prodUri || '').trim();
  const cleanTest = (testUri || '').trim();
  if (!cleanProd || !cleanTest) return { safe: false, reason: 'URI missing' };
  if (cleanTest.toLowerCase() === cleanProd.toLowerCase()) return { safe: false, reason: 'Identical to production URI' };
  const parseDbInfo = (uri: string) => {
    try {
      const url = new URL(uri.replace(/^mongodb(\+srv)?:\/\//i, 'http://'));
      return { host: url.hostname, port: url.port || '27017', dbName: url.pathname.replace(/^\//, '').split('?')[0] || 'admin' };
    } catch { return null; }
  };
  const prodInfo = parseDbInfo(cleanProd);
  const testInfo = parseDbInfo(cleanTest);
  if (!prodInfo || !testInfo || prodInfo.host !== testInfo.host || prodInfo.port !== testInfo.port) return { safe: false, reason: 'Invalid host isolation' };
  if (prodInfo.dbName === testInfo.dbName) return { safe: false, reason: 'Same database name' };
  return { safe: true };
}

// In-memory mock collection for unit testing without live MongoDB
function createMockBroadcastCollection(initialDocs: any[] = []) {
  const docs: any[] = [...initialDocs];
  return {
    docs,
    findOne: async (filter: any) => {
      if (filter && filter.id) {
        return docs.find(d => d.id === filter.id) || null;
      }
      return null;
    },
    insertOne: async (doc: any) => {
      if (docs.some(d => d.id === doc.id)) {
        const err: any = new Error(`E11000 duplicate key error collection: broadcast_campaigns index: unique_broadcast_campaign_id dup key: { id: "${doc.id}" }`);
        err.code = 11000;
        throw err;
      }
      docs.push({ ...doc });
      return { insertedId: doc.id };
    },
    find: (filter: any = {}) => ({
      sort: () => ({
        toArray: async () => [...docs].reverse()
      })
    }),
    createIndex: async () => {},
    countDocuments: async () => docs.length
  } as any;
}

// Simulation of AdminDashboard migration logic
async function simulateMigrationCheck(
  storage: Map<string, string>,
  importApi: (userCreated: any[]) => Promise<any>
): Promise<{ keyRemoved: boolean; error: string | null }> {
  let error: string | null = null;
  const STORAGE_KEY = 'career_pak_broadcast_campaigns';

  try {
    const legacyRaw = storage.get(STORAGE_KEY);
    if (legacyRaw) {
      let parsed: any;
      try {
        parsed = JSON.parse(legacyRaw);
      } catch (jsonErr: any) {
        error = 'Malformed legacy broadcast data in browser storage. Preserving original data.';
        return { keyRemoved: false, error };
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        const userCreated = parsed.filter(
          c => c && typeof c === 'object' && !['camp-01', 'camp-02', 'camp-03'].includes(String(c.id).trim())
        );

        if (userCreated.length > 0) {
          const importRes = await importApi(userCreated);

          const isFullyMigrated =
            importRes &&
            importRes.success === true &&
            importRes.allEligibleSucceeded === true &&
            importRes.failed === 0 &&
            typeof importRes.imported === 'number' &&
            typeof importRes.duplicates === 'number' &&
            (importRes.imported + importRes.duplicates === userCreated.length);

          if (isFullyMigrated) {
            storage.delete(STORAGE_KEY);
            error = null;
          } else {
            const errorDetails = importRes?.errors && importRes.errors.length > 0
              ? importRes.errors.join('; ')
              : importRes?.message || 'One or more campaigns could not be safely stored.';
            error = `Migration incomplete: ${errorDetails}. Original data preserved in storage.`;
          }
        } else {
          storage.delete(STORAGE_KEY);
        }
      }
    }
  } catch (migErr: any) {
    error = migErr?.message || 'Error checking legacy broadcast campaigns. Original data preserved.';
  }

  return { keyRemoved: !storage.has(STORAGE_KEY), error };
}

export async function runBroadcastUnitTests() {
  console.log('[START] Running Broadcast persistence unit tests...');

  const validPayload = {
    title: 'Weekly Digest #42',
    channel: 'Email' as const,
    targetAudience: 'Job Seekers Only' as const,
    subject: 'Top Engineering Openings This Week',
    messageBody: 'Hello {{candidate_name}}, check out the top 50 jobs.',
    recipientsCount: 450,
    categoryFilter: 'All Categories'
  };

  // ---------------------------------------------------------
  // MIGRATION TESTS (Fix A)
  // ---------------------------------------------------------

  const STORAGE_KEY = 'career_pak_broadcast_campaigns';

  // Test 1: Complete successful import permits LocalStorage removal
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'user-camp-1', ...validPayload, title: 'Campaign 1' },
      { id: 'user-camp-2', ...validPayload, title: 'Campaign 2' }
    ];
    storage.set(STORAGE_KEY, JSON.stringify(legacyData));

    const result = await simulateMigrationCheck(storage, async (userCreated) => ({
      success: true,
      allEligibleSucceeded: true,
      imported: 2,
      duplicates: 0,
      failed: 0,
      totalProcessed: 2,
      eligibleCount: 2
    }));

    if (!result.keyRemoved) {
      throw new Error('Test 1 failed: Complete successful import must remove LocalStorage key');
    }
    if (result.error !== null) {
      throw new Error('Test 1 failed: Successful import should have null error');
    }
  }

  // Test 2: Partial import preserves LocalStorage
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'user-camp-1', ...validPayload, title: 'Campaign 1' },
      { id: 'user-camp-2', ...validPayload, title: 'Campaign 2' }
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const result = await simulateMigrationCheck(storage, async () => ({
      success: false,
      allEligibleSucceeded: false,
      imported: 1,
      duplicates: 0,
      failed: 1,
      errors: ['Failed to insert Campaign 2']
    }));

    if (result.keyRemoved) {
      throw new Error('Test 2 failed: Partial import must NEVER remove LocalStorage key');
    }
    if (storage.get(STORAGE_KEY) !== originalRaw) {
      throw new Error('Test 2 failed: Original LocalStorage content was modified on partial failure');
    }
    if (!result.error || !result.error.includes('Migration incomplete')) {
      throw new Error('Test 2 failed: Migration error banner not set on partial failure');
    }
  }

  // Test 3: Failed API request preserves LocalStorage
  {
    const storage = new Map<string, string>();
    const originalRaw = JSON.stringify([{ id: 'user-camp-1', ...validPayload }]);
    storage.set(STORAGE_KEY, originalRaw);

    const result = await simulateMigrationCheck(storage, async () => {
      throw new Error('Network Connection Refused');
    });

    if (result.keyRemoved) {
      throw new Error('Test 3 failed: Network failure must preserve LocalStorage key');
    }
    if (storage.get(STORAGE_KEY) !== originalRaw) {
      throw new Error('Test 3 failed: Original data altered after network failure');
    }
  }

  // Test 4: Uncertain or malformed API response preserves LocalStorage
  {
    const malformedResponses = [
      {},
      { success: true }, // missing allEligibleSucceeded & counts
      { success: true, allEligibleSucceeded: false },
      { success: true, allEligibleSucceeded: true, failed: 0, imported: 1, duplicates: 0 }, // mismatch with 2 items!
      null,
      undefined
    ];

    for (const badRes of malformedResponses) {
      const storage = new Map<string, string>();
      const originalRaw = JSON.stringify([
        { id: 'camp-a', ...validPayload },
        { id: 'camp-b', ...validPayload }
      ]);
      storage.set(STORAGE_KEY, originalRaw);

      const result = await simulateMigrationCheck(storage, async () => badRes);
      if (result.keyRemoved) {
        throw new Error('Test 4 failed: Uncertain or malformed response must NEVER delete LocalStorage');
      }
      if (storage.get(STORAGE_KEY) !== originalRaw) {
        throw new Error('Test 4 failed: Original data modified on uncertain response');
      }
    }

    // Also test malformed JSON string inside localStorage
    const badJsonStorage = new Map<string, string>();
    badJsonStorage.set(STORAGE_KEY, '{"notValidJson');
    const badJsonRes = await simulateMigrationCheck(badJsonStorage, async () => ({ success: true }));
    if (badJsonRes.keyRemoved) {
      throw new Error('Test 4 failed: Malformed JSON string in storage must NEVER cause deletion');
    }
  }

  // Test 5: Already-imported duplicates are handled safely
  {
    const existingDoc = { id: 'user-hist-camp-1', ...validPayload, title: 'Already In DB' };
    const mockColl = createMockBroadcastCollection([existingDoc]);

    const legacyPayload = [
      { id: 'user-hist-camp-1', ...validPayload, title: 'Duplicate Item' },
      { id: 'user-hist-camp-2', ...validPayload, title: 'Brand New Item' }
    ];

    const importRes = await BroadcastRepository.importLegacyCampaigns(legacyPayload, mockColl);
    if (importRes.imported !== 1) {
      throw new Error(`Test 5 failed: Expected 1 imported, got ${importRes.imported}`);
    }
    if (importRes.duplicates !== 1) {
      throw new Error(`Test 5 failed: Expected 1 duplicate, got ${importRes.duplicates}`);
    }
    if (importRes.failed !== 0) {
      throw new Error(`Test 5 failed: Duplicates must not be counted as failed (${importRes.failed})`);
    }
    if (!importRes.allEligibleSucceeded) {
      throw new Error('Test 5 failed: allEligibleSucceeded must be true when all records are imported or duplicate');
    }
  }

  // Test 6: Retry does not create duplicate campaigns
  {
    const mockColl = createMockBroadcastCollection([]);
    const legacyPayload = [
      { id: 'user-hist-camp-1', ...validPayload, title: 'Retry Campaign 1' },
      { id: 'user-hist-camp-2', ...validPayload, title: 'Retry Campaign 2' }
    ];

    // First attempt
    const run1 = await BroadcastRepository.importLegacyCampaigns(legacyPayload, mockColl);
    if (run1.imported !== 2 || run1.duplicates !== 0) {
      throw new Error(`Test 6 failed: Run 1 expected 2 imported, got ${run1.imported}`);
    }
    const countAfterRun1 = await mockColl.countDocuments();
    if (countAfterRun1 !== 2) {
      throw new Error(`Test 6 failed: Collection count after Run 1 should be 2, got ${countAfterRun1}`);
    }

    // Second attempt (retry)
    const run2 = await BroadcastRepository.importLegacyCampaigns(legacyPayload, mockColl);
    if (run2.imported !== 0) {
      throw new Error(`Test 6 failed: Retry should import 0 new campaigns, got ${run2.imported}`);
    }
    if (run2.duplicates !== 2) {
      throw new Error(`Test 6 failed: Retry should identify both as duplicates, got ${run2.duplicates}`);
    }
    if (run2.failed !== 0) {
      throw new Error('Test 6 failed: Retry duplicates must not be counted as failed');
    }
    const countAfterRun2 = await mockColl.countDocuments();
    if (countAfterRun2 !== 2) {
      throw new Error(`Test 6 failed: Collection count after retry should still be 2, got ${countAfterRun2}`);
    }
  }

  // Test 7: Synthetic sample IDs remain excluded
  {
    const mockColl = createMockBroadcastCollection([]);
    const syntheticPayload = [
      { id: 'camp-01', ...validPayload, title: 'Synthetic 1' },
      { id: 'camp-02', ...validPayload, title: 'Synthetic 2' },
      { id: 'camp-03', ...validPayload, title: 'Synthetic 3' },
      { id: 'user-authentic-1', ...validPayload, title: 'Authentic 1' }
    ];

    const importRes = await BroadcastRepository.importLegacyCampaigns(syntheticPayload, mockColl);
    if (importRes.syntheticSkipped !== 3) {
      throw new Error(`Test 7 failed: Expected 3 synthetic samples skipped, got ${importRes.syntheticSkipped}`);
    }
    if (importRes.imported !== 1) {
      throw new Error(`Test 7 failed: Expected 1 authentic imported, got ${importRes.imported}`);
    }
    if (importRes.eligibleCount !== 1) {
      throw new Error(`Test 7 failed: Expected 1 eligible record, got ${importRes.eligibleCount}`);
    }

    // Verify synthetic items never entered the collection
    const inColl = mockColl.docs;
    if (inColl.some((d: any) => SYNTHETIC_CAMPAIGN_IDS.includes(d.id))) {
      throw new Error('Test 7 failed: Synthetic campaign ID leaked into database collection!');
    }
  }

  // Test 8: Original legacy data is not modified before confirmed completion
  {
    const storage = new Map<string, string>();
    const rawContent = JSON.stringify([
      { id: 'user-valid', ...validPayload },
      { id: 'user-invalid', title: '' } // will fail validation
    ]);
    storage.set(STORAGE_KEY, rawContent);

    const mockColl = createMockBroadcastCollection([]);
    await simulateMigrationCheck(storage, async (items) => {
      return await BroadcastRepository.importLegacyCampaigns(items, mockColl);
    });

    if (storage.get(STORAGE_KEY) !== rawContent) {
      throw new Error('Test 8 failed: Storage was modified before confirmed complete migration');
    }
  }

  // ---------------------------------------------------------
  // ID & DELIVERY SAFETY TESTS (Fix B)
  // ---------------------------------------------------------

  // Test 9: Normal creation ignores client-supplied IDs
  {
    const mockColl = createMockBroadcastCollection([]);
    const clientProvidedId = 'injected-client-id-12345';
    const created = await BroadcastRepository.createCampaign({
      ...validPayload,
      id: clientProvidedId
    }, mockColl);

    if (created.id === clientProvidedId) {
      throw new Error('Test 9 failed: createCampaign accepted and used client-supplied ID!');
    }
  }

  // Test 10: Backend generates the new campaign ID
  {
    const mockColl = createMockBroadcastCollection([]);
    const created = await BroadcastRepository.createCampaign(validPayload, mockColl);

    if (!created.id || !created.id.startsWith('camp-')) {
      throw new Error(`Test 10 failed: Backend-generated ID must start with "camp-", got "${created.id}"`);
    }
    const idPattern = /^camp-[a-z0-9]+-[a-z0-9]+$/;
    if (!idPattern.test(created.id)) {
      throw new Error(`Test 10 failed: ID does not match expected format: "${created.id}"`);
    }
  }

  // Test 11: Legacy import preserves valid historical IDs
  {
    const mockColl = createMockBroadcastCollection([]);
    const historicalId = 'hist-valid-user-campaign-999';
    const legacyItem = { id: historicalId, ...validPayload, title: 'Historical Draft' };

    const importRes = await BroadcastRepository.importLegacyCampaigns([legacyItem], mockColl);
    if (importRes.imported !== 1) {
      throw new Error('Test 11 failed: Legacy item not imported');
    }

    const saved = await BroadcastRepository.getById(historicalId, mockColl);
    if (!saved || saved.id !== historicalId) {
      throw new Error(`Test 11 failed: Historical ID "${historicalId}" was not preserved! Saved: "${saved?.id}"`);
    }
  }

  // Test 12: MongoDB duplicate-key errors are handled safely
  {
    // A. createCampaign handles code 11000
    const mockCollisionColl = {
      findOne: async () => null,
      insertOne: async () => {
        const err: any = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      },
      createIndex: async () => {}
    } as any;

    let duplicateCaught = false;
    try {
      await BroadcastRepository.createCampaign(validPayload, mockCollisionColl);
    } catch (dupErr: any) {
      if (dupErr?.code === 11000 || dupErr?.message?.includes('Duplicate Campaign Error')) {
        duplicateCaught = true;
      }
    }
    if (!duplicateCaught) {
      throw new Error('Test 12A failed: createCampaign did not handle duplicate-key code 11000 properly');
    }

    // B. importLegacyCampaigns handles code 11000 without crashing
    const importRes = await BroadcastRepository.importLegacyCampaigns(
      [{ id: 'colliding-id', ...validPayload }],
      mockCollisionColl
    );
    if (importRes.duplicates !== 1) {
      throw new Error(`Test 12B failed: importLegacyCampaigns should classify code 11000 as duplicate, got duplicates=${importRes.duplicates}`);
    }
  }

  // Test 13: Delivery status and statistics remain server-controlled
  {
    const mockColl = createMockBroadcastCollection([]);
    const untrustedPayload: any = {
      ...validPayload,
      status: 'Sent',
      sentAt: '2026-09-01 12:00:00',
      openRate: 95.5,
      clickRate: 60.0
    };

    // Check normal creation
    const normalCreated = await BroadcastRepository.createCampaign(untrustedPayload, mockColl);
    if (normalCreated.status !== 'Draft') {
      throw new Error(`Test 13 failed: Normal creation must have status 'Draft', got '${normalCreated.status}'`);
    }
    if (normalCreated.sentAt !== undefined) {
      throw new Error(`Test 13 failed: Normal creation must have sentAt undefined, got '${normalCreated.sentAt}'`);
    }
    if (normalCreated.openRate !== 0 || normalCreated.clickRate !== 0) {
      throw new Error('Test 13 failed: Normal creation must have 0 openRate and clickRate');
    }

    // Check legacy import
    await BroadcastRepository.importLegacyCampaigns([{ id: 'untrusted-hist-id', ...untrustedPayload }], mockColl);
    const importedDoc = await BroadcastRepository.getById('untrusted-hist-id', mockColl);
    if (!importedDoc) {
      throw new Error('Test 13 failed: Imported doc not found');
    }
    if (importedDoc.status !== 'Draft') {
      throw new Error(`Test 13 failed: Imported doc must have status 'Draft', got '${importedDoc.status}'`);
    }
    if (importedDoc.sentAt !== undefined) {
      throw new Error(`Test 13 failed: Imported doc must have sentAt undefined, got '${importedDoc.sentAt}'`);
    }
    if (importedDoc.openRate !== 0 || importedDoc.clickRate !== 0) {
      throw new Error('Test 13 failed: Imported doc must have 0 openRate and clickRate');
    }
  }

  // Additional sanity check: AdminDashboard must NOT write career_pak_broadcast_campaigns to LocalStorage
  const adminDashboardPath = path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx');
  const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');
  if (adminDashboardContent.includes("localStorage.setItem('career_pak_broadcast_campaigns'")) {
    throw new Error('Regression: AdminDashboard.tsx contains localStorage.setItem for career_pak_broadcast_campaigns!');
  }

  console.log('[PASS] All Broadcast unit tests passed successfully.');
}

export async function runBroadcastPersistenceTests() {
  const testDbUri = process.env.TEST_MONGODB_URI || '';
  const prodDbUri = process.env.MONGODB_URI || '';
  const isolation = isSafeDistinctTestUri(prodDbUri, testDbUri);

  if (!isolation.safe) {
    console.log(`[NOT RUN] Broadcast persistence integration tests skipped: ${isolation.reason}`);
    return;
  }

  let client: MongoClient | null = null;
  const testRunId = `bcast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const extraCollections: Collection<any>[] = [];

  try {
    client = new MongoClient(testDbUri);
    await client.connect();

    const collName = `broadcast_campaigns_test_${testRunId}`;
    const coll = client.db().collection<BroadcastCampaign>(collName);
    extraCollections.push(coll);

    const campaignInput = {
      title: 'Urgent Tech Hiring Gazette Alert',
      channel: 'Email' as const,
      targetAudience: 'Job Seekers Only' as const,
      subject: '🔥 50+ New Developer Roles in Lahore & Islamabad',
      messageBody: 'Hello {{candidate_name}}, apply now on CareerPak.',
      recipientsCount: 1200,
      categoryFilter: 'Technology'
    };

    // Scenario 1: Backend generates unique ID, ignores client ID
    const clientProvidedId = `client-ignore-${testRunId}`;
    const created = await BroadcastRepository.createCampaign({ ...campaignInput, id: clientProvidedId }, coll);
    if (!created.id || created.id === clientProvidedId) {
      throw new Error(`Scenario 1 failed: Client-supplied ID must be ignored, got "${created.id}"`);
    }
    if (created.status !== 'Draft') {
      throw new Error(`Scenario 1 failed: Expected status "Draft", got "${created.status}"`);
    }

    const fetched = await BroadcastRepository.getById(created.id, coll);
    if (!fetched || fetched.title !== campaignInput.title) {
      throw new Error('Scenario 1 failed: getById did not return matching campaign');
    }

    // Scenario 2: Legacy import preserves historical ID and ignores synthetic IDs
    const historicalId = `hist-camp-${testRunId}`;
    const legacyArray = [
      { id: 'camp-01', ...campaignInput, title: 'Synthetic 1' },
      { id: 'camp-02', ...campaignInput, title: 'Synthetic 2' },
      { id: 'camp-03', ...campaignInput, title: 'Synthetic 3' },
      { id: historicalId, ...campaignInput, title: 'Valid User Historical Campaign', status: 'Sent', openRate: 80 }
    ];

    const importRes1 = await BroadcastRepository.importLegacyCampaigns(legacyArray, coll);
    if (importRes1.imported !== 1) {
      throw new Error(`Scenario 2 failed: Expected 1 imported user draft, got ${importRes1.imported}`);
    }
    if (importRes1.syntheticSkipped !== 3) {
      throw new Error(`Scenario 2 failed: Expected 3 synthetic samples skipped, got ${importRes1.syntheticSkipped}`);
    }

    const histSaved = await BroadcastRepository.getById(historicalId, coll);
    if (!histSaved || histSaved.id !== historicalId) {
      throw new Error('Scenario 2 failed: Historical ID was not preserved');
    }
    if (histSaved.status !== 'Draft' || histSaved.openRate !== 0) {
      throw new Error('Scenario 2 failed: Delivery statistics were not normalized to Draft and 0');
    }

    // Scenario 3: Legacy import retry idempotency
    const importRes2 = await BroadcastRepository.importLegacyCampaigns(legacyArray, coll);
    if (importRes2.imported !== 0) {
      throw new Error(`Scenario 3 failed: Retry should import 0 campaigns, got ${importRes2.imported}`);
    }
    if (importRes2.duplicates !== 1) {
      throw new Error(`Scenario 3 failed: Retry should identify historical campaign as duplicate, got ${importRes2.duplicates}`);
    }

    console.log('[PASS] All Broadcast persistence integration test scenarios passed.');
  } catch (err: any) {
    console.error('[FAIL] Broadcast persistence integration tests failed:', err);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        for (const c of extraCollections) {
          await c.drop().catch(() => {});
        }
      } catch (cleanupErr) {
        console.error('[CLEANUP FAIL] Error during broadcast test cleanup:', cleanupErr);
      }
      await client.close();
    }
  }
}

async function main() {
  await runBroadcastUnitTests();
  await runBroadcastPersistenceTests();
}

main();
