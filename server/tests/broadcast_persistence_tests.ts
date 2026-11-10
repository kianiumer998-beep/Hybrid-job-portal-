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
  return {
    docs,
    setThrowFindError(val: boolean) { throwFindError = val; },
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
  console.log('[START] Running Broadcast persistence unit tests (STEP-04.4-02.2)...');

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
  // TEST REQUIREMENT 1: Mixed array containing valid campaigns plus null
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // TEST REQUIREMENT 2: Mixed array containing valid campaigns plus primitive values
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // TEST REQUIREMENT 3: Malformed object without required campaign fields
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // TEST REQUIREMENT 4: Synthetic-only array
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // TEST REQUIREMENT 5: Same ID and identical normalized content: safe duplicate
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // TEST REQUIREMENT 6: Same ID but different title: conflict, not duplicate
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // TEST REQUIREMENT 7: Same ID but different message body: conflict, not duplicate
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // TEST REQUIREMENT 8: Database lookup failure: migration failure
  // ---------------------------------------------------------
  {
    const mockColl = createMockBroadcastCollection([]);
    mockColl.setThrowFindError(true);

    const importRes = await BroadcastRepository.importLegacyCampaigns([
      { id: 'user-id-8', ...validPayload }
    ], mockColl);

    if (importRes.failed !== 1 || importRes.allEligibleSucceeded) {
      throw new Error('Test 8 failed: Database lookup error must be reported as migration failure');
    }
  }

  // ---------------------------------------------------------
  // TEST REQUIREMENT 9: Missing legacy ID: safe and repeatable behavior
  // ---------------------------------------------------------
  {
    const mockColl = createMockBroadcastCollection([]);
    const legacyItemWithoutId = { ...validPayload, title: 'No ID Legacy Campaign' };

    const run1 = await BroadcastRepository.importLegacyCampaigns([legacyItemWithoutId], mockColl);
    if (run1.imported !== 1) {
      throw new Error(`Test 9 failed: Missing ID record should be imported deterministically, got imported=${run1.imported}`);
    }
    const importedId1 = run1.importedIds[0];

    // Retry import with same item without ID -> should produce deterministic ID and count as safe duplicate
    const run2 = await BroadcastRepository.importLegacyCampaigns([legacyItemWithoutId], mockColl);
    if (run2.duplicates !== 1 || run2.imported !== 0) {
      throw new Error(`Test 9 failed: Retry of missing ID record must be recognized as duplicate deterministically (duplicates=${run2.duplicates}, imported=${run2.imported})`);
    }
    const importedId2 = run2.duplicateIds[0];
    if (importedId1 !== importedId2) {
      throw new Error(`Test 9 failed: Deterministic ID not repeatable between runs ("${importedId1}" vs "${importedId2}")`);
    }
  }

  // ---------------------------------------------------------
  // TEST REQUIREMENT 10: Retry after partial migration: no data loss and no duplicate campaign creation
  // ---------------------------------------------------------
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'user-retry-1', ...validPayload, title: 'Retry Item 1' },
      { id: 'user-retry-2', ...validPayload, title: '' } // fails validation on first run
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const mockColl = createMockBroadcastCollection([]);

    // Fix the invalid item for retry simulation
    legacyData[1].title = 'Retry Item 2 Validated';

    // First migration attempt (fails due to invalid item)
    storage.set(STORAGE_KEY, JSON.stringify([
      { id: 'user-retry-1', ...validPayload, title: 'Retry Item 1' },
      { id: 'user-retry-2', title: '' }
    ]));
    const res1 = await simulateMigrationCheck(storage, async (items) => BroadcastRepository.importLegacyCampaigns(items, mockColl));
    if (res1.keyRemoved) {
      throw new Error('Test 10 failed: Partial migration must not remove LocalStorage key');
    }

    // Second migration attempt (retry with fixed data)
    storage.set(STORAGE_KEY, JSON.stringify(legacyData));
    const res2 = await simulateMigrationCheck(storage, async (items) => BroadcastRepository.importLegacyCampaigns(items, mockColl));
    if (!res2.keyRemoved) {
      throw new Error('Test 10 failed: Successful retry must remove LocalStorage key');
    }

    const totalInColl = await mockColl.countDocuments();
    if (totalInColl !== 2) {
      throw new Error(`Test 10 failed: Expected exactly 2 campaigns in DB, got ${totalInColl}`);
    }
  }

  // ---------------------------------------------------------
  // TEST REQUIREMENT 11: Exact original LocalStorage payload remains unchanged on every failure/conflict
  // ---------------------------------------------------------
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
      throw new Error('Test 11 failed: LocalStorage payload was modified or removed on conflict');
    }
  }

  // ---------------------------------------------------------
  // TEST REQUIREMENT 12: LocalStorage removal only after every non-synthetic record is conclusively accounted for
  // ---------------------------------------------------------
  {
    const storage = new Map<string, string>();
    const legacyData = [
      { id: 'camp-01', ...validPayload, title: 'Synthetic' }, // synthetic
      { id: 'conclusive-1', ...validPayload, title: 'Conclusive 1' },
      { id: 'conclusive-2', ...validPayload, title: 'Conclusive 2' }
    ];
    const originalRaw = JSON.stringify(legacyData);
    storage.set(STORAGE_KEY, originalRaw);

    const mockColl = createMockBroadcastCollection([]);
    const migrationResult = await simulateMigrationCheck(storage, async (items) => BroadcastRepository.importLegacyCampaigns(items, mockColl));

    if (!migrationResult.keyRemoved) {
      throw new Error('Test 12 failed: LocalStorage key must be removed when all non-synthetic records are successfully imported');
    }
  }

  console.log('[PASS] All STEP-04.4-02.2 Broadcast unit tests passed successfully.');
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

    // Integration Scenario: Content Conflict Handling
    const historicalId = `hist-conflict-${testRunId}`;
    await BroadcastRepository.createCampaign({ ...campaignInput, id: historicalId, title: 'Original DB Title' }, coll);

    const conflictingImport = [
      { id: historicalId, ...campaignInput, title: 'Conflicting Import Title' }
    ];

    const result = await BroadcastRepository.importLegacyCampaigns(conflictingImport, coll);
    if (result.failed !== 1 || result.allEligibleSucceeded) {
      throw new Error('Integration Scenario failed: Content conflict did not report failure in MongoDB integration test');
    }

    console.log('[PASS] Broadcast persistence integration test scenarios passed.');
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
