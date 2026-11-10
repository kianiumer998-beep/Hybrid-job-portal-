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
  console.log('[START] Running Broadcast persistence unit tests (STEP-04.4-02.4 restoration & Fix B hash tests)...');

  const validPayload = {
    title: 'Weekly Digest #42',
    channel: 'Email' as const,
    targetAudience: 'Job Seekers Only' as const,
    subject: 'Top Engineering Openings This Week',
    messageBody: 'Hello {{candidate_name}}, check out the top 50 jobs.',
    recipientsCount: 450,
    categoryFilter: 'All Categories'
  };

  const STORAGE_KEY = 'career_pak_broadcast_campaigns';

  // ---------------------------------------------------------
  // RESTORED PREVIOUS REGRESSION TESTS (STEP-04.4-02.2)
  // ---------------------------------------------------------

  // Test 1: Mixed array containing valid campaigns plus null
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'user-valid-1', ...validPayload, title: 'Valid 1' },
      null,
      { id: 'user-valid-2', ...validPayload, title: 'Valid 2' }
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const mockColl = createMockBroadcastCollection([]);
    const migrationResult = await simulateMigrationCheck(storage, async (items) => {
      return await BroadcastRepository.importLegacyCampaigns(items, mockColl);
    });

    if (migrationResult.keyRemoved) {
      throw new Error('Test 1 failed: Array containing null must NOT remove LocalStorage key');
    }
    if (storage.get(STORAGE_KEY) !== originalRaw) {
      throw new Error('Test 1 failed: Original storage raw JSON was altered');
    }
  }

  // Test 2: Mixed array containing valid campaigns plus primitive values
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'user-valid-1', ...validPayload, title: 'Valid 1' },
      'invalid-primitive-string',
      12345,
      true
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const mockColl = createMockBroadcastCollection([]);
    const migrationResult = await simulateMigrationCheck(storage, async (items) => {
      return await BroadcastRepository.importLegacyCampaigns(items, mockColl);
    });

    if (migrationResult.keyRemoved) {
      throw new Error('Test 2 failed: Array containing primitives must NOT remove LocalStorage key');
    }
    if (storage.get(STORAGE_KEY) !== originalRaw) {
      throw new Error('Test 2 failed: Original storage modified');
    }
  }

  // Test 3: Malformed object without required campaign fields
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'user-malformed-1', title: '' }, // empty title fails validation
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const mockColl = createMockBroadcastCollection([]);
    const migrationResult = await simulateMigrationCheck(storage, async (items) => {
      return await BroadcastRepository.importLegacyCampaigns(items, mockColl);
    });

    if (migrationResult.keyRemoved) {
      throw new Error('Test 3 failed: Malformed object must fail migration and preserve LocalStorage key');
    }
    if (storage.get(STORAGE_KEY) !== originalRaw) {
      throw new Error('Test 3 failed: Storage modified');
    }
  }

  // Test 4: Synthetic-only array
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'camp-01', ...validPayload, title: 'Synthetic 1' },
      { id: 'camp-02', ...validPayload, title: 'Synthetic 2' },
      { id: 'camp-03', ...validPayload, title: 'Synthetic 3' }
    ];
    storage.set(STORAGE_KEY, JSON.stringify(legacyData));

    const mockColl = createMockBroadcastCollection([]);
    const migrationResult = await simulateMigrationCheck(storage, async (items) => {
      return await BroadcastRepository.importLegacyCampaigns(items, mockColl);
    });

    if (!migrationResult.keyRemoved) {
      throw new Error('Test 4 failed: Synthetic-only array must remove LocalStorage key safely');
    }
  }

  // Test 5: Same ID and identical normalized content: safe duplicate
  {
    const existingDoc = { id: 'user-id-5', ...validPayload, title: 'Same Content' };
    const mockColl = createMockBroadcastCollection([existingDoc]);

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'user-id-5', ...validPayload, title: 'Same Content' }
    ], mockColl);

    if (importRes.duplicates !== 1 || importRes.imported !== 0 || importRes.failed !== 0 || !importRes.allEligibleSucceeded) {
      throw new Error(`Test 5 failed: Identical content with same ID must be counted as safe duplicate (duplicates=${importRes.duplicates}, failed=${importRes.failed})`);
    }
  }

  // Test 6: Same ID but different title: conflict, not duplicate
  {
    const existingDoc = { id: 'user-id-6', ...validPayload, title: 'Old Title' };
    const mockColl = createMockBroadcastCollection([existingDoc]);

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'user-id-6', ...validPayload, title: 'New Conflicting Title' }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.duplicates !== 0 || importRes.allEligibleSucceeded) {
      throw new Error(`Test 6 failed: Different title with same ID must be reported as failure/conflict (failed=${importRes.failed}, allEligibleSucceeded=${importRes.allEligibleSucceeded})`);
    }
  }

  // Test 7: Same ID but different message body: conflict, not duplicate
  {
    const existingDoc = { id: 'user-id-7', ...validPayload, messageBody: 'Old message body content' };
    const mockColl = createMockBroadcastCollection([existingDoc]);

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'user-id-7', ...validPayload, messageBody: 'Completely different message body text' }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.duplicates !== 0 || importRes.allEligibleSucceeded) {
      throw new Error(`Test 7 failed: Different message body with same ID must be reported as conflict/failure`);
    }
  }

  // Test 8: Database lookup failure: migration failure
  {
    const mockColl = createMockBroadcastCollection([]);
    mockColl.setSimulateCode11000OnInsert(true);
    mockColl.setThrowFindError(true);

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'user-id-8-lookup-fail', ...validPayload }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.allEligibleSucceeded) {
      throw new Error('Test 8 failed: Database lookup error must be reported as migration failure');
    }
  }

  // Test 9: Retry after partial migration: no data loss and no duplicate campaign creation
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'user-retry-1', ...validPayload, title: 'Retry Item 1' },
      { id: 'user-retry-2', ...validPayload, title: '' } // fails validation on first run
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const mockColl = createMockBroadcastCollection([]);

    legacyData[1].title = 'Retry Item 2 Validated';

    // First migration attempt (fails due to invalid item)
    storage.set(STORAGE_KEY, JSON.stringify([
      { id: 'user-retry-1', ...validPayload, title: 'Retry Item 1' },
      { id: 'user-retry-2', title: '' }
    ]));
    const res1 = await simulateMigrationCheck(storage, async (items) => BroadcastRepository.importLegacyCampaigns(items, mockColl));
    if (res1.keyRemoved) {
      throw new Error('Test 9 failed: Partial migration must not remove LocalStorage key');
    }

    // Second migration attempt (retry with fixed data)
    storage.set(STORAGE_KEY, JSON.stringify(legacyData));
    const res2 = await simulateMigrationCheck(storage, async (items) => BroadcastRepository.importLegacyCampaigns(items, mockColl));
    if (!res2.keyRemoved) {
      throw new Error('Test 9 failed: Successful retry must remove LocalStorage key');
    }

    const totalInColl = await mockColl.countDocuments();
    if (totalInColl !== 2) {
      throw new Error(`Test 9 failed: Expected exactly 2 campaigns in DB, got ${totalInColl}`);
    }
  }

  // Test 10: Exact original LocalStorage payload remains unchanged on every failure/conflict
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'conflict-id', ...validPayload, title: 'Incoming Title Conflict' }
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const mockColl = createMockBroadcastCollection([
      { id: 'conflict-id', ...validPayload, title: 'Existing DB Title' }
    ]);

    await simulateMigrationCheck(storage, async (items) => BroadcastRepository.importLegacyCampaigns(items, mockColl));

    if (storage.get(STORAGE_KEY) !== originalRaw) {
      throw new Error('Test 10 failed: LocalStorage payload was modified or removed on conflict');
    }
  }

  // Test 11: LocalStorage removal only after every non-synthetic record is conclusively accounted for
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'camp-01', ...validPayload, title: 'Synthetic' },
      { id: 'conclusive-1', ...validPayload, title: 'Conclusive 1' },
      { id: 'conclusive-2', ...validPayload, title: 'Conclusive 2' }
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const mockColl = createMockBroadcastCollection([]);
    const migrationResult = await simulateMigrationCheck(storage, async (items) => BroadcastRepository.importLegacyCampaigns(items, mockColl));

    if (!migrationResult.keyRemoved) {
      throw new Error('Test 11 failed: LocalStorage key must be removed when all non-synthetic records are successfully imported');
    }
  }

  // Malformed JSON storage test
  {
    const badJsonStorage = new Map<string, string>();
    badJsonStorage.set(STORAGE_KEY, '{"notValidJson');
    const badJsonRes = await simulateMigrationCheck(badJsonStorage, async () => ({ success: true }));
    if (badJsonRes.keyRemoved) {
      throw new Error('Malformed JSON test failed: Malformed JSON string in storage must NEVER cause deletion');
    }
  }

  // ---------------------------------------------------------
  // STEP-04.4-02.3 & 04.4-02.4 NEW REGRESSION TESTS (Fix A, Fix B Hash tests)
  // ---------------------------------------------------------

  // Test A.1: Duplicate-key insert race with identical content → safe duplicate
  {
    const existingDoc = { id: 'race-identical-id', ...validPayload, title: 'Race Identical Title' };
    const mockColl = createMockBroadcastCollection([existingDoc]);
    mockColl.setSimulateCode11000OnInsert(true);

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'race-identical-id', ...validPayload, title: 'Race Identical Title' }
    ], mockColl);

    if (importRes.duplicates !== 1 || importRes.failed !== 0 || !importRes.allEligibleSucceeded) {
      throw new Error(`Test A.1 failed: Identical content race must be counted as safe duplicate`);
    }
  }

  // Test A.2: Duplicate-key insert race with different content → failure/conflict
  {
    const existingDoc = { id: 'race-conflict-id', ...validPayload, title: 'Existing DB Title' };
    const mockColl = createMockBroadcastCollection([existingDoc]);
    mockColl.setSimulateCode11000OnInsert(true);

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'race-conflict-id', ...validPayload, title: 'Conflicting Incoming Title' }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.duplicates !== 0 || importRes.allEligibleSucceeded) {
      throw new Error(`Test A.2 failed: Different content race must be reported as conflict/failure`);
    }
  }

  // Test A.3: 11000 duplicate key error followed by missing record (phantom race) -> failure/conflict
  {
    const mockColl = createMockBroadcastCollection([]);
    mockColl.setSimulateCode11000OnInsert(true);

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'user-id-phantom', ...validPayload, title: 'Phantom Race Item' }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.duplicates !== 0 || importRes.allEligibleSucceeded) {
      throw new Error('Test A.3 failed: 11000 followed by missing record must be reported as failure/conflict');
    }
  }

  // ---------------------------------------------------------
  // DETERMINISTIC ID TESTS (Field-by-field variations)
  // ---------------------------------------------------------

  // Test B.1: Same normalized content produces same ID
  {
    const mockColl = createMockBroadcastCollection([]);
    const item1 = { ...validPayload };
    const item2 = { ...validPayload };

    const res1 = await BroadcastRepository.importLegacyCampaigns([item1], mockColl);
    const mockColl2 = createMockBroadcastCollection([]);
    const res2 = await BroadcastRepository.importLegacyCampaigns([item2], mockColl2);

    if (res1.importedIds[0] !== res2.importedIds[0]) {
      throw new Error('Test B.1 failed: Same content did not produce same deterministic ID');
    }
  }

  // Test B.2: Different fields produce different deterministic IDs
  {
    const baseColl = createMockBroadcastCollection([]);
    const baseRes = await BroadcastRepository.importLegacyCampaigns([{ ...validPayload }], baseColl);
    const baseId = baseRes.importedIds[0];

    const fieldsToTest = [
      { key: 'title', val: 'Different Title' },
      { key: 'channel', val: 'SMS' },
      { key: 'targetAudience', val: 'All Users' },
      { key: 'subject', val: 'Different Subject' },
      { key: 'messageBody', val: 'Different Message Body Content' },
      { key: 'categoryFilter', val: 'Management' }
    ];

    for (const testCase of fieldsToTest) {
      const coll = createMockBroadcastCollection([]);
      const modifiedPayload = { ...validPayload, [testCase.key]: testCase.val };
      const res = await BroadcastRepository.importLegacyCampaigns([modifiedPayload], coll);
      const modId = res.importedIds[0];
      if (modId === baseId) {
        throw new Error(`Test B.2 failed: Different ${testCase.key} produced identical deterministic ID`);
      }
    }
  }

  // Test B.5: Same missing-ID campaign imported twice → same deterministic ID and one stored record
  {
    const mockColl = createMockBroadcastCollection([]);
    const legacyItemWithoutId = { ...validPayload, title: 'Cryptographic Deterministic ID Test' };

    const run1 = await BroadcastRepository.importLegacyCampaigns([legacyItemWithoutId], mockColl);
    if (run1.imported !== 1) {
      throw new Error(`Test B.5 failed: First import failed`);
    }
    const id1 = run1.importedIds[0];

    const run2 = await BroadcastRepository.importLegacyCampaigns([legacyItemWithoutId], mockColl);
    if (run2.duplicates !== 1 || run2.imported !== 0) {
      throw new Error(`Test B.5 failed: Second import must be recognized as duplicate`);
    }
    const id2 = run2.duplicateIds[0];

    if (id1 !== id2) {
      throw new Error(`Test B.5 failed: Deterministic IDs do not match`);
    }
  }

  // Test B.6 (Enhanced): Text containing separator-like characters cannot create ambiguous identity encoding (JSON serialization)
  {
    const mockColl = createMockBroadcastCollection([]);
    const campA = { ...validPayload, title: 'Gazette || Opening', messageBody: 'Body "with" delimiters' };
    const campB = { ...validPayload, title: 'Gazette Opening', messageBody: 'Body with delimiters' };

    const importRes = await BroadcastRepository.importLegacyCampaigns([campA, campB], mockColl);
    if (importRes.imported !== 2 || importRes.importedIds[0] === importRes.importedIds[1]) {
      throw new Error('Test B.6 failed: Separator characters caused ambiguous collision');
    }
  }

  // Additional sanity checks
  const adminDashboardPath = path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx');
  const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');
  if (adminDashboardContent.includes("localStorage.setItem('career_pak_broadcast_campaigns'")) {
    throw new Error('Regression: AdminDashboard.tsx contains localStorage.setItem for career_pak_broadcast_campaigns!');
  }

  console.log('[PASS] All STEP-04.4-02.4 Broadcast unit tests passed successfully.');
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

    if (result.failed !== 1 || result.duplicates !== 0 || result.allEligibleSucceeded !== false) {
      throw new Error(`Fix C Integration failed: Expected failed=1, duplicates=0, allEligibleSucceeded=false`);
    }

    const fetchedDoc = await coll.findOne({ id: historicalId } as any);
    if (!fetchedDoc) {
      throw new Error('Fix C Integration failed: Historical document not found after conflicting import');
    }

    // Compare all original document fields to confirm no fields were modified
    const fieldsToVerify = ['id', 'title', 'channel', 'targetAudience', 'subject', 'messageBody', 'categoryFilter', 'status', 'recipientsCount', 'openRate', 'clickRate', 'createdAt', 'updatedAt'];
    for (const f of fieldsToVerify) {
      if ((fetchedDoc as any)[f] !== (originalHistoricalDoc as any)[f]) {
        throw new Error(`Fix C Integration failed: Field ${f} was changed from "${(originalHistoricalDoc as any)[f]}" to "${(fetchedDoc as any)[f]}"`);
      }
    }

    // Confirm no additional record was inserted
    const docCount = await coll.countDocuments();
    if (docCount !== 1) {
      throw new Error(`Fix C Integration failed: Expected countDocuments() === 1, got ${docCount}`);
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
