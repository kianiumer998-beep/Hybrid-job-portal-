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
  let throwFindError = false;
  let simulateCode11000OnInsert = false;
  return {
    docs,
    setThrowFindError(val: boolean) { throwFindError = val; },
    setSimulateCode11000OnInsert(val: boolean) { simulateCode11000OnInsert = val; },
    findOne: async (filter: any) => {
      if (throwFindError) {
        throw new Error('Simulated database connection / lookup failure');
      }
      if (filter && filter.id) {
        return docs.find(d => d.id === filter.id) || null;
      }
      return null;
    },
    insertOne: async (doc: any) => {
      if (simulateCode11000OnInsert || docs.some(d => d.id === doc.id)) {
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
  importApi: (nonSyntheticItems: any[]) => Promise<any>
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

      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          storage.delete(STORAGE_KEY);
        } else {
          const syntheticItems = parsed.filter(
            c => c && typeof c === 'object' && SYNTHETIC_CAMPAIGN_IDS.includes(String(c.id).trim() as any)
          );
          const nonSyntheticItems = parsed.filter(
            c => !(c && typeof c === 'object' && SYNTHETIC_CAMPAIGN_IDS.includes(String(c.id).trim() as any))
          );

          if (nonSyntheticItems.length === 0 && syntheticItems.length > 0) {
            storage.delete(STORAGE_KEY);
          } else if (nonSyntheticItems.length > 0) {
            const importRes = await importApi(nonSyntheticItems);

            const isFullyMigrated =
              importRes &&
              importRes.success === true &&
              importRes.allEligibleSucceeded === true &&
              importRes.failed === 0 &&
              typeof importRes.imported === 'number' &&
              typeof importRes.duplicates === 'number' &&
              (importRes.imported + importRes.duplicates === nonSyntheticItems.length);

            if (isFullyMigrated) {
              storage.delete(STORAGE_KEY);
              error = null;
            } else {
              const errorDetails = importRes?.errors && importRes.errors.length > 0
                ? importRes.errors.join('; ')
                : importRes?.message || 'One or more legacy records could not be safely migrated or conflicted.';
              error = `Migration incomplete: ${errorDetails}. Original data preserved in storage.`;
            }
          }
        }
      }
    }
  } catch (migErr: any) {
    error = migErr?.message || 'Error checking legacy broadcast campaigns. Original data preserved.';
  }

  return { keyRemoved: !storage.has(STORAGE_KEY), error };
}

export async function runBroadcastUnitTests() {
  console.log('[START] Running Broadcast persistence unit tests (STEP-04.4-02.3)...');

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
  // FIX A REGRESSION TESTS: DUPLICATE-KEY RACE CONDITIONS
  // ---------------------------------------------------------

  // Test A.1: Duplicate-key insert race with identical content → safe duplicate
  {
    const existingDoc = { id: 'race-identical-id', ...validPayload, title: 'Race Identical Title' };
    const mockColl = createMockBroadcastCollection([existingDoc]);
    mockColl.setSimulateCode11000OnInsert(true); // force 11000 on insertOne

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'race-identical-id', ...validPayload, title: 'Race Identical Title' }
    ], mockColl);

    if (importRes.duplicates !== 1 || importRes.failed !== 0 || !importRes.allEligibleSucceeded) {
      throw new Error(`Test A.1 failed: Identical content race must be counted as safe duplicate (duplicates=${importRes.duplicates}, failed=${importRes.failed})`);
    }
  }

  // Test A.2: Duplicate-key insert race with different content → failure/conflict
  {
    const existingDoc = { id: 'race-conflict-id', ...validPayload, title: 'Existing DB Title' };
    const mockColl = createMockBroadcastCollection([existingDoc]);
    mockColl.setSimulateCode11000OnInsert(true); // force 11000 on insertOne

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'race-conflict-id', ...validPayload, title: 'Conflicting Incoming Title' }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.duplicates !== 0 || importRes.allEligibleSucceeded) {
      throw new Error(`Test A.2 failed: Different content race must be reported as conflict/failure (failed=${importRes.failed}, allEligibleSucceeded=${importRes.allEligibleSucceeded})`);
    }
  }

  // Test A.3: Duplicate-key follow-up lookup failure → failure
  {
    const mockColl = createMockBroadcastCollection([]);
    mockColl.setSimulateCode11000OnInsert(true);
    mockColl.setThrowFindError(true); // lookup fails during race check

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'race-fail-lookup', ...validPayload }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.allEligibleSucceeded) {
      throw new Error('Test A.3 failed: Follow-up lookup error on 11000 must result in migration failure');
    }
  }

  // Test A.4: Duplicate-key follow-up lookup returns no document → failure
  {
    const mockColl = createMockBroadcastCollection([]);
    mockColl.setSimulateCode11000OnInsert(true); // 11000 thrown, but findOne returns null (phantom/missing)

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'race-phantom-id', ...validPayload }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.allEligibleSucceeded) {
      throw new Error('Test A.4 failed: Follow-up lookup returning no document on 11000 must result in migration failure');
    }
  }

  // ---------------------------------------------------------
  // FIX B REGRESSION TESTS: CRYPTOGRAPHIC DETERMINISTIC ID
  // ---------------------------------------------------------

  // Test B.5: Same missing-ID campaign imported twice → same deterministic ID and one stored record
  {
    const mockColl = createMockBroadcastCollection([]);
    const legacyItemWithoutId = { ...validPayload, title: 'Cryptographic Deterministic ID Test' };

    const run1 = await BroadcastRepository.importLegacyCampaigns([legacyItemWithoutId], mockColl);
    if (run1.imported !== 1) {
      throw new Error(`Test B.5 failed: First import failed (imported=${run1.imported})`);
    }
    const id1 = run1.importedIds[0];

    const run2 = await BroadcastRepository.importLegacyCampaigns([legacyItemWithoutId], mockColl);
    if (run2.duplicates !== 1 || run2.imported !== 0) {
      throw new Error(`Test B.5 failed: Second import must be recognized as duplicate (duplicates=${run2.duplicates})`);
    }
    const id2 = run2.duplicateIds[0];

    if (id1 !== id2) {
      throw new Error(`Test B.5 failed: Deterministic IDs do not match ("${id1}" vs "${id2}")`);
    }
    if (mockColl.docs.length !== 1) {
      throw new Error(`Test B.5 failed: Expected exactly 1 record in collection, got ${mockColl.docs.length}`);
    }
  }

  // Test B.6: Different campaigns sharing similar title/body prefixes → distinct deterministic IDs
  {
    const mockColl = createMockBroadcastCollection([]);
    const campA = { ...validPayload, title: 'Gazette Opening A', messageBody: 'Apply for post A' };
    const campB = { ...validPayload, title: 'Gazette Opening B', messageBody: 'Apply for post B' };

    const importRes = await BroadcastRepository.importLegacyCampaigns([campA, campB], mockColl);
    if (importRes.imported !== 2) {
      throw new Error(`Test B.6 failed: Expected 2 imported, got ${importRes.imported}`);
    }
    if (importRes.importedIds[0] === importRes.importedIds[1]) {
      throw new Error('Test B.6 failed: Different campaigns produced colliding deterministic IDs');
    }
  }

  // Test B.7: Different channel, audience, or category with otherwise similar content → distinct identity
  {
    const mockColl = createMockBroadcastCollection([]);
    const camp1 = { ...validPayload, channel: 'Email' as const };
    const camp2 = { ...validPayload, channel: 'WhatsApp' as const };

    const importRes = await BroadcastRepository.importLegacyCampaigns([camp1, camp2], mockColl);
    if (importRes.imported !== 2 || importRes.importedIds[0] === importRes.importedIds[1]) {
      throw new Error('Test B.7 failed: Channel change did not produce distinct deterministic ID');
    }
  }

  // Additional sanity checks
  const adminDashboardPath = path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx');
  const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');
  if (adminDashboardContent.includes("localStorage.setItem('career_pak_broadcast_campaigns'")) {
    throw new Error('Regression: AdminDashboard.tsx contains localStorage.setItem for career_pak_broadcast_campaigns!');
  }

  console.log('[PASS] All STEP-04.4-02.3 Broadcast unit tests passed successfully.');
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

    // FIX C INTEGRATION TEST: Seed historical record directly into isolated test collection using insertOne()
    const historicalId = `hist-seed-${testRunId}`;
    const originalHistoricalDoc = {
      id: historicalId,
      title: 'Original Seeded Title',
      channel: 'Email' as const,
      targetAudience: 'Job Seekers Only' as const,
      subject: 'Original Seeded Subject',
      messageBody: 'Original Seeded Message Body',
      categoryFilter: 'Technology',
      status: 'Draft' as const,
      recipientsCount: 500,
      openRate: 0,
      clickRate: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await coll.insertOne(originalHistoricalDoc as any);

    // Submit a legacy campaign with the same ID but conflicting content
    const conflictingImport = [
      {
        id: historicalId,
        ...campaignInput,
        title: 'Conflicting Updated Title'
      }
    ];

    const result = await BroadcastRepository.importLegacyCampaigns(conflictingImport, coll);

    // Verify requirements:
    // 1. failed === 1
    if (result.failed !== 1) {
      throw new Error(`Fix C Integration failed: Expected failed === 1, got ${result.failed}`);
    }
    // 2. duplicates === 0
    if (result.duplicates !== 0) {
      throw new Error(`Fix C Integration failed: Expected duplicates === 0, got ${result.duplicates}`);
    }
    // 3. allEligibleSucceeded === false
    if (result.allEligibleSucceeded) {
      throw new Error('Fix C Integration failed: Expected allEligibleSucceeded to be false');
    }
    // 4. Fetch original MongoDB document and verify every original content field remains unchanged
    const fetchedDoc = await coll.findOne({ id: historicalId } as any);
    if (!fetchedDoc) {
      throw new Error('Fix C Integration failed: Historical document disappeared from collection');
    }
    if (fetchedDoc.title !== 'Original Seeded Title') {
      throw new Error(`Fix C Integration failed: Document title was overwritten to "${fetchedDoc.title}"`);
    }
    if (fetchedDoc.subject !== 'Original Seeded Subject') {
      throw new Error('Fix C Integration failed: Document subject was overwritten');
    }
    if (fetchedDoc.messageBody !== 'Original Seeded Message Body') {
      throw new Error('Fix C Integration failed: Document messageBody was overwritten');
    }
    // 5. Verify no extra campaign was inserted (total count is still 1)
    const totalCount = await coll.countDocuments({});
    if (totalCount !== 1) {
      throw new Error(`Fix C Integration failed: Expected exactly 1 document in collection, got ${totalCount}`);
    }

    console.log('[PASS] Broadcast persistence Fix C MongoDB integration test passed successfully.');
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
