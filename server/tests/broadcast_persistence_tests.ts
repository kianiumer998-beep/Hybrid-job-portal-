import { MongoClient, Collection } from 'mongodb';
import {
  BroadcastRepository,
  validateBroadcastPayload,
  isBroadcastCollectionInitialized,
  SYNTHETIC_CAMPAIGN_IDS,
  ALLOWED_CHANNELS,
  ALLOWED_AUDIENCES
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

export async function runBroadcastUnitTests() {
  console.log('[START] Running Broadcast persistence unit tests...');

  // Test 1: Payload validation - valid payload
  const validPayload = {
    title: 'Weekly Digest #42',
    channel: 'Email',
    targetAudience: 'Job Seekers Only',
    subject: 'Top Engineering Openings This Week',
    messageBody: 'Hello {{candidate_name}}, check out the top 50 jobs.',
    recipientsCount: 450,
    categoryFilter: 'All Categories'
  };
  const validRes = validateBroadcastPayload(validPayload);
  if (!validRes.valid || !validRes.clean) {
    throw new Error(`validateBroadcastPayload rejected valid payload: ${validRes.error}`);
  }
  if (validRes.clean.title !== 'Weekly Digest #42') {
    throw new Error('validateBroadcastPayload altered valid title');
  }

  // Test 2: Payload validation - rejection of empty/missing title
  const invalidTitleRes = validateBroadcastPayload({ ...validPayload, title: '   ' });
  if (invalidTitleRes.valid) {
    throw new Error('validateBroadcastPayload accepted empty/whitespace title');
  }

  // Test 3: Payload validation - rejection of invalid channel
  const invalidChannelRes = validateBroadcastPayload({ ...validPayload, channel: 'CarrierPigeon' });
  if (invalidChannelRes.valid) {
    throw new Error('validateBroadcastPayload accepted invalid channel "CarrierPigeon"');
  }

  // Test 4: Payload validation - rejection of invalid audience
  const invalidAudienceRes = validateBroadcastPayload({ ...validPayload, targetAudience: 'RandomInternetStrangers' });
  if (invalidAudienceRes.valid) {
    throw new Error('validateBroadcastPayload accepted invalid audience');
  }

  // Test 5: Payload validation - rejection of empty message body
  const invalidBodyRes = validateBroadcastPayload({ ...validPayload, messageBody: '' });
  if (invalidBodyRes.valid) {
    throw new Error('validateBroadcastPayload accepted empty messageBody');
  }

  // Test 6: Delivery safety invariant - client-supplied delivery status, sentAt, and rates are NEVER trusted
  const untrustedInput: any = {
    ...validPayload,
    status: 'Sent',
    sentAt: '2026-08-25 10:00:00',
    openRate: 98.5,
    clickRate: 42.1
  };
  const dummyColl = {
    findOne: async () => null,
    insertOne: async (doc: any) => {
      // Invariant checks on the document to be inserted
      if (doc.status !== 'Draft') {
        throw new Error(`Delivery Safety Violation: status must be "Draft", got "${doc.status}"`);
      }
      if (doc.sentAt !== undefined) {
        throw new Error(`Delivery Safety Violation: sentAt must be undefined, got "${doc.sentAt}"`);
      }
      if (doc.openRate !== 0) {
        throw new Error(`Delivery Safety Violation: openRate must be 0, got "${doc.openRate}"`);
      }
      if (doc.clickRate !== 0) {
        throw new Error(`Delivery Safety Violation: clickRate must be 0, got "${doc.clickRate}"`);
      }
      return { insertedId: 'mock_id' };
    },
    createIndex: async () => {}
  } as any;

  const createdDraft = await BroadcastRepository.createCampaign(untrustedInput, dummyColl);
  if (createdDraft.status !== 'Draft') {
    throw new Error('createCampaign returned non-Draft status');
  }
  if (createdDraft.sentAt !== undefined) {
    throw new Error('createCampaign returned non-undefined sentAt');
  }
  if (createdDraft.openRate !== 0 || createdDraft.clickRate !== 0) {
    throw new Error('createCampaign returned non-zero open/click rates');
  }

  // Test 7: Synthetic sample campaigns are strictly identified
  for (const synId of SYNTHETIC_CAMPAIGN_IDS) {
    if (!['camp-01', 'camp-02', 'camp-03'].includes(synId)) {
      throw new Error(`Unexpected synthetic campaign id: ${synId}`);
    }
  }

  // Test 8: Verify AdminDashboard does NOT write career_pak_broadcast_campaigns to LocalStorage
  const adminDashboardPath = path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx');
  const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');
  if (adminDashboardContent.includes("localStorage.setItem('career_pak_broadcast_campaigns'")) {
    throw new Error('Regression: AdminDashboard.tsx contains localStorage.setItem for career_pak_broadcast_campaigns!');
  }

  // Test 9: Collection-instance cache isolation
  const mockCollA = { name: 'broadcast_mock_A' } as any;
  const mockCollB = { name: 'broadcast_mock_B' } as any;
  if (isBroadcastCollectionInitialized(mockCollA) || isBroadcastCollectionInitialized(mockCollB)) {
    throw new Error('Uninitialized mock collections should report false for isBroadcastCollectionInitialized');
  }
  BroadcastRepository.resetIndexInitialization(mockCollA);
  if (isBroadcastCollectionInitialized(mockCollA)) {
    throw new Error('Reset of uninitialized collection altered state');
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

    // Scenario 1: Create and read a campaign draft
    const campaignInput = {
      title: 'Urgent Tech Hiring Gazette Alert',
      channel: 'Email' as const,
      targetAudience: 'Job Seekers Only' as const,
      subject: '🔥 50+ New Developer Roles in Lahore & Islamabad',
      messageBody: 'Hello {{candidate_name}}, apply now on CareerPak.',
      recipientsCount: 1200,
      categoryFilter: 'Technology'
    };

    const created = await BroadcastRepository.createCampaign(campaignInput, coll);
    if (!created.id || !created.id.startsWith('camp-')) {
      throw new Error(`Scenario 1 failed: Expected id starting with "camp-", got "${created.id}"`);
    }
    if (created.status !== 'Draft') {
      throw new Error(`Scenario 1 failed: Expected status "Draft", got "${created.status}"`);
    }
    if (created.sentAt !== undefined) {
      throw new Error(`Scenario 1 failed: Expected sentAt to be undefined, got "${created.sentAt}"`);
    }

    const fetched = await BroadcastRepository.getById(created.id, coll);
    if (!fetched || fetched.title !== campaignInput.title) {
      throw new Error('Scenario 1 failed: getById did not return matching campaign');
    }
    if ((fetched as any)._id !== undefined) {
      throw new Error('Scenario 1 failed: Internal MongoDB _id leaked into returned record');
    }

    const allList = await BroadcastRepository.getAll(coll);
    if (allList.length !== 1 || allList[0].id !== created.id) {
      throw new Error(`Scenario 1 failed: Expected 1 campaign in getAll, got ${allList.length}`);
    }

    // Scenario 2: Duplicate campaign creation with stable ID fails closed
    const stableId = `camp-stable-${testRunId}`;
    await BroadcastRepository.createCampaign({ ...campaignInput, id: stableId, title: 'Stable ID Campaign' }, coll);

    let dupErrorCaught = false;
    try {
      await BroadcastRepository.createCampaign({ ...campaignInput, id: stableId, title: 'Duplicate Collision' }, coll);
    } catch (dupErr: any) {
      if (dupErr?.message?.includes('Duplicate Campaign Error')) {
        dupErrorCaught = true;
      }
    }
    if (!dupErrorCaught) {
      throw new Error('Scenario 2 failed: Duplicate campaign creation with identical ID did not throw Duplicate Campaign Error');
    }

    // Scenario 3: Invalid input fails validation
    let invalidCaught = false;
    try {
      await BroadcastRepository.createCampaign({ ...campaignInput, title: '' }, coll);
    } catch (err: any) {
      if (err?.message?.includes('Validation Error')) {
        invalidCaught = true;
      }
    }
    if (!invalidCaught) {
      throw new Error('Scenario 3 failed: Empty title did not throw Validation Error');
    }

    // Scenario 4: Fail closed when MongoDB is unavailable
    // Querying an explicitly closed client must fail closed and throw, never returning synthetic mock data
    const closedClient = new MongoClient(testDbUri);
    // Closed client collection
    const closedColl = closedClient.db('unconnected_db').collection<BroadcastCampaign>('unconnected_coll');
    let failClosedCaught = false;
    try {
      await BroadcastRepository.getAll(closedColl);
    } catch {
      failClosedCaught = true;
    }
    if (!failClosedCaught) {
      throw new Error('Scenario 4 failed: Repository did not fail closed on disconnected database');
    }

    // Scenario 5: Legacy import ignores synthetic initial sample campaigns ('camp-01', 'camp-02', 'camp-03')
    const legacyCollName = `broadcast_legacy_test_${testRunId}`;
    const legacyColl = client.db().collection<BroadcastCampaign>(legacyCollName);
    extraCollections.push(legacyColl);

    const legacyArrayWithSamples = [
      {
        id: 'camp-01',
        title: 'Weekly Top 50 Government & Private Jobs Digest',
        channel: 'Email',
        targetAudience: 'Job Seekers Only',
        subject: '🎯 Top 50 New Jobs This Week',
        messageBody: 'Hello {{candidate_name}}',
        status: 'Sent',
        recipientsCount: 1420
      },
      {
        id: 'camp-02',
        title: 'Urgent WhatsApp Alert: FPSC Deadline',
        channel: 'WhatsApp',
        targetAudience: 'Subscribed Members',
        subject: 'FPSC Deadline',
        messageBody: 'FPSC alert',
        status: 'Sent',
        recipientsCount: 890
      },
      {
        id: 'camp-03',
        title: 'Employer 30% Off Promotion',
        channel: 'Email',
        targetAudience: 'Employers / Posters',
        subject: '30% Off',
        messageBody: 'Discount promo',
        status: 'Sent',
        recipientsCount: 340
      },
      {
        id: `camp-user-custom-${testRunId}`,
        title: 'Custom User-Created Broadcast Draft',
        channel: 'Email',
        targetAudience: 'Job Seekers Only',
        subject: 'Authentic Custom Broadcast',
        messageBody: 'Real message drafted by human admin.',
        status: 'Sent', // Must be sanitized to 'Draft'
        recipientsCount: 150,
        openRate: 50.0,
        clickRate: 25.0
      }
    ];

    const importRes1 = await BroadcastRepository.importLegacyCampaigns(legacyArrayWithSamples, legacyColl);
    if (importRes1.imported !== 1) {
      throw new Error(`Scenario 5 failed: Expected exactly 1 imported user draft, got ${importRes1.imported}`);
    }
    if (importRes1.skipped !== 3) {
      throw new Error(`Scenario 5 failed: Expected 3 synthetic samples skipped, got ${importRes1.skipped}`);
    }

    // Verify imported custom draft is stored as 'Draft' with no delivery rates
    const importedDoc = await BroadcastRepository.getById(`camp-user-custom-${testRunId}`, legacyColl);
    if (!importedDoc) {
      throw new Error('Scenario 5 failed: Custom legacy campaign was not found in collection');
    }
    if (importedDoc.status !== 'Draft') {
      throw new Error(`Scenario 5 failed: Expected imported status "Draft", got "${importedDoc.status}"`);
    }
    if (importedDoc.openRate !== 0 || importedDoc.clickRate !== 0) {
      throw new Error('Scenario 5 failed: Legacy import treated sample rates as genuine');
    }

    // Scenario 6: Legacy import retry safety (idempotent re-run)
    const importRes2 = await BroadcastRepository.importLegacyCampaigns(legacyArrayWithSamples, legacyColl);
    if (importRes2.imported !== 0) {
      throw new Error(`Scenario 6 failed: Retry should import 0 campaigns, got ${importRes2.imported}`);
    }
    if (importRes2.skipped !== 4) {
      throw new Error(`Scenario 6 failed: Retry should skip all 4 records, got ${importRes2.skipped}`);
    }

    const finalCount = await legacyColl.countDocuments({});
    if (finalCount !== 1) {
      throw new Error(`Scenario 6 failed: Total documents in collection should be 1, got ${finalCount}`);
    }

    console.log('[PASS] All 6 Broadcast persistence integration test scenarios passed.');
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
