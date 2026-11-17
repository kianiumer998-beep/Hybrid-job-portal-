// MUST set process.env.IS_TEST = 'true' BEFORE importing any repository or route module
process.env.IS_TEST = 'true';
// Simulate MongoDB URI being configured before module import to verify zero background connect/index on import
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mock_payment_index_test_db';

import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MongoClient, Collection } from 'mongodb';

let mongoConnectCalls = 0;
let mongoCreateIndexCalls = 0;

const origMongoConnect = MongoClient.prototype.connect;
MongoClient.prototype.connect = function (...args: any[]) {
  mongoConnectCalls++;
  return origMongoConnect.apply(this, args);
};

const origPrototypeCreateIndex = Collection.prototype.createIndex;
Collection.prototype.createIndex = function (...args: any[]) {
  mongoCreateIndexCalls++;
  return origPrototypeCreateIndex.apply(this, args);
};

const origPrototypeCreateIndexes = Collection.prototype.createIndexes;
Collection.prototype.createIndexes = function (...args: any[]) {
  mongoCreateIndexCalls++;
  return origPrototypeCreateIndexes.apply(this, args);
};

function hashFile(relPath: string): string {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return 'FILE_NOT_FOUND';
  return crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
}

interface MockCollectionOptions {
  createIndexDelayMs?: number;
  failOnCreateIndexCall?: number | null;
  createIndexError?: Error | null;
  onInsertOne?: (doc: any, callNum: number) => Promise<void> | void;
  onFindOneAndUpdate?: (filter: any, update: any) => Promise<void> | void;
}

class MockTransactionsCollection {
  docs: any[] = [];
  events: string[] = [];
  createIndexRequests: Array<{ keys: Record<string, any>; options: Record<string, any> }> = [];
  insertOneCalls = 0;
  createIndexCalls = 0;
  options: MockCollectionOptions;

  constructor(options: MockCollectionOptions = {}) {
    this.options = options;
  }

  async createIndex(keys: Record<string, any>, options: Record<string, any> = {}) {
    this.createIndexCalls++;
    const callNum = this.createIndexCalls;
    const keyName = Object.keys(keys).join(',');
    this.events.push(`createIndex:start:${keyName}`);
    if (this.options.createIndexDelayMs && this.options.createIndexDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.options.createIndexDelayMs));
    }
    if (
      this.options.createIndexError &&
      (this.options.failOnCreateIndexCall == null || callNum >= this.options.failOnCreateIndexCall)
    ) {
      this.events.push(`createIndex:fail:${keyName}`);
      throw this.options.createIndexError;
    }
    this.createIndexRequests.push({ keys: { ...keys }, options: { ...options } });
    this.events.push(`createIndex:done:${keyName}`);
    return `${keyName}_1`;
  }

  async insertOne(doc: Record<string, any>) {
    this.insertOneCalls++;
    const callNum = this.insertOneCalls;
    this.events.push(`insertOne:${doc.id}`);

    if (this.options.onInsertOne) {
      await this.options.onInsertOne(doc, callNum);
    }

    // Enforce unique sparse semantics on id, transactionId, idempotencyKey
    for (const field of ['id', 'transactionId', 'idempotencyKey']) {
      const val = doc[field];
      if (val === undefined) continue; // sparse skips missing field
      const duplicate = this.docs.find((existing) => existing[field] === val);
      if (duplicate) {
        const dupErr: any = new Error(
          `E11000 duplicate key error collection: secret_prod_db.transactions index: ${field}_1 dup key: { ${field}: "${String(val)}" }`
        );
        dupErr.code = 11000;
        dupErr.keyPattern = { [field]: 1 };
        dupErr.keyValue = { [field]: val };
        throw dupErr;
      }
    }

    const stored = { _id: `mongo-${this.docs.length + 1}`, ...doc };
    this.docs.push(stored);
    return { acknowledged: true, insertedId: stored._id };
  }

  async findOne(query: Record<string, any>) {
    const match = this.docs.find((d) =>
      Object.entries(query).every(([k, v]) => d[k] === v)
    );
    return match ? { ...match } : null;
  }

  find(query: Record<string, any> = {}) {
    const filtered = this.docs
      .filter((d) => Object.entries(query).every(([k, v]) => d[k] === v))
      .map((d) => ({ ...d }));
    return {
      sort: (sortSpec: Record<string, number>) => {
        const [field, dir] = Object.entries(sortSpec)[0] || ['createdAt', -1];
        const sorted = [...filtered].sort((a, b) => {
          const av = String(a[field] || '');
          const bv = String(b[field] || '');
          return dir < 0 ? bv.localeCompare(av) : av.localeCompare(bv);
        });
        return {
          toArray: async () => sorted
        };
      },
      toArray: async () => filtered
    };
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>) {
    const idx = this.docs.findIndex((d) =>
      Object.entries(filter).every(([k, v]) => d[k] === v)
    );
    if (idx === -1) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }
    const next = { ...this.docs[idx] };
    if (update.$set) {
      Object.assign(next, update.$set);
    }
    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) {
        delete next[k];
      }
    }
    this.docs[idx] = next;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async findOneAndUpdate(
    filter: Record<string, any>,
    update: Record<string, any>,
    _options?: Record<string, any>
  ) {
    if (this.options.onFindOneAndUpdate) {
      await this.options.onFindOneAndUpdate(filter, update);
    }
    const idx = this.docs.findIndex((d) =>
      Object.entries(filter).every(([k, v]) => d[k] === v)
    );
    if (idx === -1) {
      return { value: null };
    }
    const next = { ...this.docs[idx] };
    if (update.$set) {
      Object.assign(next, update.$set);
    }
    this.docs[idx] = next;
    return { value: { ...next } };
  }
}

async function runTests() {
  console.log('=== Starting PaymentRepository Index, Readiness & Idempotency Tests (STEP-PR-02) ===\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ''}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failCount++;
    }
  }

  const preTransactionsHash = hashFile('data/transactions.json');
  const preUsersHash = hashFile('data/users.json');
  const preAuditHash = hashFile('data/audit_logs.json');

  // Dynamic imports AFTER IS_TEST=true is configured
  const paymentRepoMod = await import('../db/repositories/PaymentRepository');
  const {
    PaymentRepository,
    ensureTransactionIndexesReady,
    areTransactionIndexesReady,
    setMockTransactionsCollectionForTests,
    resetTransactionIndexStateForTests,
    TransactionIndexInitializationError,
    InvalidIdempotencyKeyError,
    MongoDuplicateTransactionError,
    normalizeIdempotencyKey
  } = paymentRepoMod;

  const { UserRepository } = await import('../db/repositories/UserRepository');
  const { JobRepository } = await import('../db/repositories/JobRepository');
  const { AdRepository } = await import('../db/repositories/AdRepository');
  const { AuditRepository } = await import('../db/repositories/AuditRepository');
  const { NotificationRepository } = await import('../db/repositories/NotificationRepository');
  const { PaymentSettingsRepository } = await import('../db/repositories/PaymentSettingsRepository');
  const { PricingRepository } = await import('../db/repositories/PricingRepository');
  const { Database } = await import('../db/database');
  const { transactionRouter } = await import('../routes/transactionRoutes');

  // Save originals to restore cleanly in finally
  const origDbAddTx = Database.addTransaction;
  const origUserGetByIdAsync = UserRepository.getByIdAsync;
  const origUserDeductWalletAsync = UserRepository.deductWalletBalanceAsync;
  const origUserCreditWalletAsync = UserRepository.creditWalletBalanceAsync;
  const origUserUpdateAsync = UserRepository.updateAsync;
  const origPricingGet = PricingRepository.get;
  const origPricingCalcAd = PricingRepository.calculateAdPrice;
  const origSettingsPublic = PaymentSettingsRepository.getPublicSettings;
  const origJobApprovePending = JobRepository.approvePending;
  const origAdUpdate = AdRepository.update;
  const origAuditAddAfter = AuditRepository.addAfterPrimaryOperation;
  const origNotifCreateAsync = NotificationRepository.createAsync;
  const origConsoleError = console.error;

  let server: http.Server | null = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: No background index creation or Mongo connect during module import
    // -------------------------------------------------------------------------
    assert(
      mongoConnectCalls === 0 && mongoCreateIndexCalls === 0,
      '1. No background index creation or MongoDB connection occurs during module import',
      `connects=${mongoConnectCalls}, createIndex=${mongoCreateIndexCalls}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Creates the 3 required unique sparse indexes
    // -------------------------------------------------------------------------
    resetTransactionIndexStateForTests();
    const mockColl2 = new MockTransactionsCollection();
    setMockTransactionsCollectionForTests(mockColl2);

    await ensureTransactionIndexesReady();
    const hasIdIdx = mockColl2.createIndexRequests.some(
      (r) => r.keys.id === 1 && r.options.unique === true && r.options.sparse === true
    );
    const hasTidIdx = mockColl2.createIndexRequests.some(
      (r) => r.keys.transactionId === 1 && r.options.unique === true && r.options.sparse === true
    );
    const hasIdemIdx = mockColl2.createIndexRequests.some(
      (r) => r.keys.idempotencyKey === 1 && r.options.unique === true && r.options.sparse === true
    );
    assert(
      mockColl2.createIndexCalls === 3 && hasIdIdx && hasTidIdx && hasIdemIdx && areTransactionIndexesReady(),
      '2. Creates exact 3 unique sparse indexes on {id}, {transactionId}, {idempotencyKey}',
      `calls=${mockColl2.createIndexCalls}`
    );

    // -------------------------------------------------------------------------
    // TEST 3 & 4: Concurrent calls share single-flight init AND insert waits for slow createIndex
    // -------------------------------------------------------------------------
    resetTransactionIndexStateForTests();
    const mockColl3 = new MockTransactionsCollection({ createIndexDelayMs: 30 });
    setMockTransactionsCollectionForTests(mockColl3);

    assert(areTransactionIndexesReady() === false, '3a. Readiness starts false before initialization');

    const [txA, txB, txC] = await Promise.all([
      PaymentRepository.createAsync({ id: 'TX-SF-1', transactionId: 'TID-SF-1', amount: 100, type: 'Wallet Deposit' }),
      PaymentRepository.createAsync({ id: 'TX-SF-2', transactionId: 'TID-SF-2', amount: 200, type: 'Wallet Deposit' }),
      PaymentRepository.createAsync({ id: 'TX-SF-3', transactionId: 'TID-SF-3', amount: 300, type: 'Wallet Deposit' })
    ]);

    const lastCreateIndexDoneIdx = Math.max(
      mockColl3.events.indexOf('createIndex:done:id'),
      mockColl3.events.indexOf('createIndex:done:transactionId'),
      mockColl3.events.indexOf('createIndex:done:idempotencyKey')
    );
    const firstInsertIdx = Math.min(
      mockColl3.events.indexOf('insertOne:TX-SF-1'),
      mockColl3.events.indexOf('insertOne:TX-SF-2'),
      mockColl3.events.indexOf('insertOne:TX-SF-3')
    );

    assert(
      mockColl3.createIndexCalls === 3 && Boolean(txA && txB && txC),
      '3. Concurrent createAsync calls share one single-flight initialization promise',
      `createIndexCalls=${mockColl3.createIndexCalls}`
    );
    assert(
      lastCreateIndexDoneIdx >= 0 && firstInsertIdx > lastCreateIndexDoneIdx,
      '4. Transaction insert waits until slow async createIndex completes before insertOne runs',
      `lastIndexDone=${lastCreateIndexDoneIdx}, firstInsert=${firstInsertIdx}`
    );

    // -------------------------------------------------------------------------
    // TEST 5, 6 & 7: Failed init blocks insert, keeps ready=false, and later retry succeeds
    // -------------------------------------------------------------------------
    resetTransactionIndexStateForTests();
    const mockColl5 = new MockTransactionsCollection({
      failOnCreateIndexCall: 2,
      createIndexError: new Error('Simulated connection timeout to mongodb+srv://user:secret@cluster0.mongodb.net')
    });
    setMockTransactionsCollectionForTests(mockColl5);

    // Suppress expected console error noise during failure simulation
    let capturedErrLog = '';
    console.error = (...args: any[]) => {
      capturedErrLog += args.map(String).join(' ') + '\n';
    };

    let initErr: any = null;
    try {
      await PaymentRepository.createAsync({ id: 'TX-FAIL-1', transactionId: 'TID-FAIL-1', amount: 500 });
    } catch (e) {
      initErr = e;
    } finally {
      console.error = origConsoleError;
    }

    assert(
      initErr instanceof TransactionIndexInitializationError &&
        initErr.statusCode === 503 &&
        initErr.code === 'TRANSACTION_INDEX_NOT_READY' &&
        mockColl5.insertOneCalls === 0,
      '5. Index initialization failure blocks coll.insertOne from executing',
      `insertOneCalls=${mockColl5.insertOneCalls}`
    );
    assert(
      areTransactionIndexesReady() === false && !capturedErrLog.includes('mongodb+srv://'),
      '6. Failed initialization leaves areTransactionIndexesReady() === false and logs no secrets'
    );

    // Now clear the simulated fault and retry
    mockColl5.options.createIndexError = null;
    mockColl5.options.failOnCreateIndexCall = null;
    const retryTx = await PaymentRepository.createAsync({
      id: 'TX-RETRY-1',
      transactionId: 'TID-RETRY-1',
      amount: 500
    });
    assert(
      areTransactionIndexesReady() === true && retryTx.id === 'TX-RETRY-1' && mockColl5.insertOneCalls === 1,
      '7. Later retry after failed initialization succeeds cleanly',
      `ready=${areTransactionIndexesReady()}, insertCalls=${mockColl5.insertOneCalls}`
    );

    // -------------------------------------------------------------------------
    // TEST 8 & 9: Duplicate-key error code 11000 preserved & keyValue / raw error NOT exposed
    // -------------------------------------------------------------------------
    resetTransactionIndexStateForTests();
    const mockColl8 = new MockTransactionsCollection();
    setMockTransactionsCollectionForTests(mockColl8);

    await PaymentRepository.createAsync({
      id: 'TX-DUP-ORIG',
      transactionId: 'SECRET-DUP-TX-999',
      amount: 100
    });

    let dupThrown: any = null;
    try {
      await PaymentRepository.createAsync({
        id: 'TX-DUP-RACE',
        transactionId: 'SECRET-DUP-TX-999',
        amount: 100
      });
    } catch (e) {
      dupThrown = e;
    }

    const dupSerialized = JSON.stringify({
      message: dupThrown?.message,
      keyPattern: dupThrown?.keyPattern,
      keyValue: dupThrown?.keyValue,
      code: dupThrown?.code
    });

    assert(
      dupThrown instanceof MongoDuplicateTransactionError &&
        dupThrown.code === 11000 &&
        dupThrown.keyPattern?.transactionId === 1,
      '8. Duplicate-key error preserves code 11000 and safe keyPattern',
      `code=${dupThrown?.code}`
    );
    assert(
      dupThrown?.keyValue === undefined &&
        !dupSerialized.includes('SECRET-DUP-TX-999') &&
        !dupSerialized.includes('secret_prod_db') &&
        !dupSerialized.includes('E11000'),
      '9. Raw keyValue and raw MongoDB error strings are never exposed on thrown repository errors'
    );

    // -------------------------------------------------------------------------
    // TEST 10, 11, 12, 13: Optional idempotencyKey omission, trimming, rejection & normalized lookup
    // -------------------------------------------------------------------------
    resetTransactionIndexStateForTests();
    const mockColl10 = new MockTransactionsCollection();
    setMockTransactionsCollectionForTests(mockColl10);

    const txMissingUndef = await PaymentRepository.createAsync({
      id: 'TX-IDEM-UNDEF',
      transactionId: 'TID-IDEM-1',
      amount: 100,
      idempotencyKey: undefined
    });
    const txMissingNull = await PaymentRepository.createAsync({
      id: 'TX-IDEM-NULL',
      transactionId: 'TID-IDEM-2',
      amount: 100,
      idempotencyKey: null
    });
    const txBlankEmpty = await PaymentRepository.createAsync({
      id: 'TX-IDEM-EMPTY',
      transactionId: 'TID-IDEM-3',
      amount: 100,
      idempotencyKey: ''
    });
    const txBlankSpaces = await PaymentRepository.createAsync({
      id: 'TX-IDEM-SPACES',
      transactionId: 'TID-IDEM-4',
      amount: 100,
      idempotencyKey: '   \t  '
    });

    const omittedEverywhere = [txMissingUndef, txMissingNull, txBlankEmpty, txBlankSpaces].every(
      (t) => !Object.prototype.hasOwnProperty.call(t, 'idempotencyKey')
    );
    const storedOmittedEverywhere = mockColl10.docs.every(
      (d) => !Object.prototype.hasOwnProperty.call(d, 'idempotencyKey')
    );

    assert(
      omittedEverywhere && storedOmittedEverywhere && mockColl10.docs.length === 4,
      '10. Missing/null/blank idempotencyKey values are omitted and never cause false sparse collisions'
    );

    const txTrimmed = await PaymentRepository.createAsync({
      id: 'TX-IDEM-TRIM',
      transactionId: 'TID-IDEM-5',
      amount: 250,
      idempotencyKey: '  trimmed-key-abc  '
    });
    const storedTrimmedDoc = mockColl10.docs.find((d) => d.id === 'TX-IDEM-TRIM');
    assert(
      txTrimmed.idempotencyKey === 'trimmed-key-abc' && storedTrimmedDoc?.idempotencyKey === 'trimmed-key-abc',
      '11. Valid idempotencyKey values are trimmed before persistence'
    );

    const invalidInputs: any[] = [12345, { key: 'x' }, ['x'], true, 'k'.repeat(256)];
    let allRejected = true;
    for (const bad of invalidInputs) {
      let threw = false;
      try {
        await PaymentRepository.createAsync({
          id: 'TX-BAD-IDEM',
          transactionId: 'TID-BAD',
          amount: 10,
          idempotencyKey: bad
        });
      } catch (e) {
        threw = e instanceof InvalidIdempotencyKeyError && e.statusCode === 400;
      }
      if (!threw) allRejected = false;
    }
    assert(
      allRejected && normalizeIdempotencyKey('   ') === undefined,
      '12. Non-string and >255 char idempotencyKey values are cleanly rejected with InvalidIdempotencyKeyError'
    );

    const foundNormalized = await PaymentRepository.findByIdempotencyKeyAsync('  trimmed-key-abc   ');
    assert(
      foundNormalized?.id === 'TX-IDEM-TRIM' && (await PaymentRepository.findByIdempotencyKeyAsync('   ')) === null,
      '13a. findByIdempotencyKeyAsync normalizes/trims lookup keys properly'
    );

    // -------------------------------------------------------------------------
    // TEST 13b, 14, 15, 16: HTTP transactionRoutes end-to-end safety tests
    // -------------------------------------------------------------------------
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const uid = req.header('x-test-user-id');
      const role = req.header('x-test-role') || 'User';
      if (uid) {
        (req as any).user = {
          id: uid,
          userId: uid,
          name: `Test ${uid}`,
          email: `${uid}@example.com`,
          role
        };
      }
      next();
    });
    app.use('/api/transactions', transactionRouter);

    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/transactions`;

    // Install deterministic spies / stubs for route dependencies
    let walletDeductCalls = 0;
    let userUpdateCalls = 0;
    let jobApproveCalls = 0;
    let adUpdateCalls = 0;
    let auditCalls = 0;
    let notifCalls = 0;
    let dbAddTxCalls = 0;

    Database.addTransaction = ((..._args: any[]) => {
      dbAddTxCalls++;
      throw new Error('Database.addTransaction must NOT be called in MongoDB mode!');
    }) as any;

    UserRepository.getByIdAsync = async (uid: string) => ({
      id: uid,
      name: `Test ${uid}`,
      email: `${uid}@example.com`,
      walletBalance: 5000,
      membershipTier: 'Free',
      membershipStatus: 'Inactive'
    });
    UserRepository.deductWalletBalanceAsync = async (_uid: string, _amt: number) => {
      walletDeductCalls++;
      return { id: _uid, walletBalance: 5000 - _amt };
    };
    UserRepository.creditWalletBalanceAsync = async (_uid: string, _amt: number) => ({
      id: _uid,
      walletBalance: 5000
    });
    UserRepository.updateAsync = async (_uid: string, _updates: any) => {
      userUpdateCalls++;
      return { id: _uid };
    };
    PaymentSettingsRepository.getPublicSettings = async () => ({
      isConfigured: true,
      settings: {
        methods: {
          easypaisa: {
            id: 'easypaisa',
            name: 'Easypaisa',
            enabled: true,
            accountTitle: 'Test Account',
            accountNumber: '03001234567',
            transactionIdRequired: true,
            screenshotRequired: false,
            senderNameRequired: false,
            senderPhoneRequired: false,
            proofNoteRequired: false,
            customFields: []
          }
        }
      } as any
    });
    PricingRepository.get = async () => ({
      subscriptionPackages: [
        { id: 'pro-monthly', name: 'Pro Plan', pricePkr: 1000, durationDays: 30, enabled: true }
      ]
    });
    PricingRepository.calculateAdPrice = async () => ({
      finalPrice: 1200,
      breakdown: [{ name: 'Ad', amount: 1200 }],
      placement: 'sidebar',
      durationUnit: 'days',
      durationValue: 7,
      durationHours: 168,
      durationDays: 7,
      durationDisplay: '7 days',
      targetPages: ['all'],
      smsRecipientsCount: 0,
      placementMultiplier: 1,
      pageMultiplier: 1,
      baseCost: 1200,
      smsFee: 0,
      totalCostPkr: 1200,
      isFreeOverride: false
    } as any);
    JobRepository.approvePending = async () => {
      jobApproveCalls++;
      return { id: 'job-1', status: 'Approved' };
    };
    AdRepository.update = (() => {
      adUpdateCalls++;
      return null;
    }) as any;
    AuditRepository.addAfterPrimaryOperation = async () => {
      auditCalls++;
      return { persisted: true };
    };
    NotificationRepository.createAsync = async () => {
      notifCalls++;
      return { id: 'notif-1' } as any;
    };

    // Route Test 13b: cleanIdempotencyKey lookup + omission of blank key on HTTP POST
    resetTransactionIndexStateForTests();
    const routeColl = new MockTransactionsCollection();
    setMockTransactionsCollectionForTests(routeColl);

    const createBlankRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': 'user-1' },
      body: JSON.stringify({
        type: 'Wallet Deposit',
        amount: 400,
        paymentMethod: 'Easypaisa',
        transactionId: 'TID-HTTP-BLANK-1',
        idempotencyKey: '    '
      })
    });
    const createBlankBody: any = await createBlankRes.json();
    const blankStoredDoc = routeColl.docs.find((d) => d.transactionId === 'TID-HTTP-BLANK-1');

    const createTrimmedRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': 'user-1' },
      body: JSON.stringify({
        type: 'Wallet Deposit',
        amount: 500,
        paymentMethod: 'Easypaisa',
        transactionId: 'TID-HTTP-TRIM-1',
        idempotencyKey: '  route-idem-1  '
      })
    });
    const createTrimmedBody: any = await createTrimmedRes.json();

    const replayTrimmedRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': 'user-1' },
      body: JSON.stringify({
        type: 'Wallet Deposit',
        amount: 500,
        paymentMethod: 'Easypaisa',
        transactionId: 'TID-HTTP-TRIM-OTHER',
        idempotencyKey: 'route-idem-1'
      })
    });
    const replayTrimmedBody: any = await replayTrimmedRes.json();

    const badRouteKeyRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': 'user-1' },
      body: JSON.stringify({
        type: 'Wallet Deposit',
        amount: 500,
        paymentMethod: 'Easypaisa',
        transactionId: 'TID-HTTP-BADKEY',
        idempotencyKey: 99999
      })
    });

    assert(
      createBlankRes.status === 201 &&
        blankStoredDoc !== undefined &&
        !Object.prototype.hasOwnProperty.call(blankStoredDoc, 'idempotencyKey') &&
        !Object.prototype.hasOwnProperty.call(createBlankBody.transaction || {}, 'idempotencyKey') &&
        createTrimmedRes.status === 201 &&
        createTrimmedBody.transaction?.idempotencyKey === 'route-idem-1' &&
        replayTrimmedRes.status === 200 &&
        replayTrimmedBody.transaction?.id === createTrimmedBody.transaction?.id &&
        badRouteKeyRes.status === 400,
      '13b. Route normalizes cleanIdempotencyKey, omits blank keys, replays normalized matches, rejects invalid keys with 400'
    );

    // Route Test 14: Duplicate-key race in POST /api/transactions returns 409 safely
    resetTransactionIndexStateForTests();
    // Simulate a record belonging to ANOTHER user already in Mongo, plus a race where pre-check returns null
    // or another user inserts same transactionId / idempotencyKey between pre-check and insertOne.
    const raceDupColl = new MockTransactionsCollection({
      onInsertOne: () => {
        const raceErr: any = new Error(
          'E11000 duplicate key error collection: prod.transactions index: idempotencyKey_1 dup key: { idempotencyKey: "SECRET-RACE-KEY-777" }'
        );
        raceErr.code = 11000;
        raceErr.keyPattern = { idempotencyKey: 1 };
        raceErr.keyValue = { idempotencyKey: 'SECRET-RACE-KEY-777' };
        throw raceErr;
      }
    });
    raceDupColl.docs.push({
      id: 'OTHER-USER-TX',
      userId: 'other-user-99',
      transactionId: 'TID-OTHER-USER',
      amount: 9999,
      status: 'Success'
    });
    setMockTransactionsCollectionForTests(raceDupColl);

    const dupRaceRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': 'user-1' },
      body: JSON.stringify({
        type: 'Wallet Deposit',
        amount: 600,
        paymentMethod: 'Easypaisa',
        transactionId: 'TID-RACE-CLIENT',
        idempotencyKey: 'client-race-key'
      })
    });
    const dupRaceRaw = await dupRaceRes.text();
    const dupRaceJson = JSON.parse(dupRaceRaw);

    assert(
      dupRaceRes.status === 409 &&
        dupRaceJson.success === false &&
        dupRaceJson.transaction === undefined &&
        !dupRaceRaw.includes('SECRET-RACE-KEY-777') &&
        !dupRaceRaw.includes('E11000') &&
        !dupRaceRaw.includes('other-user-99') &&
        !dupRaceRaw.includes('OTHER-USER-TX'),
      '14. Duplicate-key race in POST /api/transactions returns HTTP 409 with generic safe message and leaks zero secrets/other-user records',
      `status=${dupRaceRes.status}`
    );

    // Route Test 15 & 16: Readiness failure AND Wallet Balance duplicate race trigger ZERO side effects
    walletDeductCalls = 0;
    userUpdateCalls = 0;
    jobApproveCalls = 0;
    adUpdateCalls = 0;
    auditCalls = 0;
    notifCalls = 0;

    // 15a. Readiness failure on Wallet Balance Subscription POST -> HTTP 503 + zero side effects
    resetTransactionIndexStateForTests();
    const readyFailColl = new MockTransactionsCollection({
      createIndexError: new Error('MongoNetworkError: failed connecting to mongodb+srv://admin:supersecret@atlas')
    });
    setMockTransactionsCollectionForTests(readyFailColl);

    console.error = () => {};
    const readyFailRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': 'user-wallet-1' },
      body: JSON.stringify({
        type: 'Subscription',
        plan: 'pro-monthly',
        paymentMethod: 'Wallet Balance',
        idempotencyKey: 'wallet-ready-fail-1'
      })
    });
    console.error = origConsoleError;

    const readyFailRaw = await readyFailRes.text();
    const readyFailJson = JSON.parse(readyFailRaw);

    assert(
      readyFailRes.status === 503 &&
        readyFailJson.success === false &&
        /not ready/i.test(readyFailJson.message) &&
        /no new payment/i.test(readyFailJson.message) &&
        !readyFailRaw.includes('supersecret') &&
        !readyFailRaw.includes('MongoNetworkError'),
      '15. Index readiness failure in POST /api/transactions returns HTTP 503 stating no new payment was submitted without leaking Mongo errors',
      `status=${readyFailRes.status}`
    );

    // 16. Wallet Balance duplicate insert race -> HTTP 409 + ZERO wallet/subscription/job/ad/audit/notification calls
    resetTransactionIndexStateForTests();
    const walletRaceColl = new MockTransactionsCollection({
      onInsertOne: () => {
        const dup: any = new Error('E11000 duplicate key error dup key: { idempotencyKey: "SECRET-WALLET-KEY" }');
        dup.code = 11000;
        dup.keyPattern = { idempotencyKey: 1 };
        dup.keyValue = { idempotencyKey: 'SECRET-WALLET-KEY' };
        throw dup;
      }
    });
    setMockTransactionsCollectionForTests(walletRaceColl);

    const walletDupRaceRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': 'user-wallet-2' },
      body: JSON.stringify({
        type: 'Subscription',
        plan: 'pro-monthly',
        paymentMethod: 'Wallet Balance',
        idempotencyKey: 'wallet-race-key-1'
      })
    });
    const walletDupRaceRaw = await walletDupRaceRes.text();

    assert(
      walletDupRaceRes.status === 409 &&
        !walletDupRaceRaw.includes('SECRET-WALLET-KEY') &&
        walletDeductCalls === 0 &&
        userUpdateCalls === 0 &&
        jobApproveCalls === 0 &&
        adUpdateCalls === 0 &&
        auditCalls === 0 &&
        notifCalls === 0,
      '16. Wallet Balance duplicate race & index readiness failures produce ZERO wallet deductions, subscription activations, job approvals, ads, audits, or notifications',
      `deduct=${walletDeductCalls}, userUpd=${userUpdateCalls}, job=${jobApproveCalls}, ad=${adUpdateCalls}, audit=${auditCalls}, notif=${notifCalls}`
    );

    // -------------------------------------------------------------------------
    // TEST 17: Mongo-configured storage never falls back to Database JSON
    // -------------------------------------------------------------------------
    // Also verify Database.addTransaction was never called when Mongo (mock or real-configured) fails
    resetTransactionIndexStateForTests();
    const noFallbackColl = new MockTransactionsCollection({
      createIndexError: new Error('Simulated index init failure')
    });
    setMockTransactionsCollectionForTests(noFallbackColl);
    let threwSync = false;
    try {
      PaymentRepository.create({ id: 'SYNC-BLOCK', amount: 100 });
    } catch (e: any) {
      threwSync = /prohibited/i.test(e?.message || '');
    }
    let threwAsync = false;
    console.error = () => {};
    try {
      await PaymentRepository.createAsync({ id: 'ASYNC-BLOCK', amount: 100 });
    } catch (e: any) {
      threwAsync = e instanceof TransactionIndexInitializationError;
    } finally {
      console.error = origConsoleError;
    }

    // Also temporarily toggle IS_TEST unset while MONGODB_URI is set to unreachable localhost:1 to prove create() forbids JSON fallback
    let prodGuardThrew = false;
    delete process.env.IS_TEST;
    try {
      PaymentRepository.create({ id: 'PROD-SYNC-BLOCK', amount: 100 });
    } catch (e: any) {
      prodGuardThrew = /prohibited/i.test(e?.message || '');
    } finally {
      process.env.IS_TEST = 'true';
    }

    assert(
      threwSync && threwAsync && prodGuardThrew && dbAddTxCalls === 0,
      '17. Mongo-configured storage never falls back to Database.addTransaction or JSON storage',
      `dbAddTxCalls=${dbAddTxCalls}`
    );

    // -------------------------------------------------------------------------
    // TEST 18: Existing in-memory subscription_snapshot + payment verify() behavior preserved
    // -------------------------------------------------------------------------
    // 18a. Pure in-memory mode (mock collection cleared)
    resetTransactionIndexStateForTests();
    let inMemActivatedTier = '';
    let inMemActivatedStatus = '';
    UserRepository.getByIdAsync = async (uid: string) => ({
      id: uid,
      name: 'Snapshot User',
      email: 'snap@example.com',
      membershipTier: 'Free',
      membershipStatus: 'Inactive'
    });
    UserRepository.updateAsync = async (uid: string, updates: any) => {
      inMemActivatedTier = updates.membershipTier;
      inMemActivatedStatus = updates.membershipStatus;
      return { id: uid, ...updates };
    };
    PricingRepository.get = async () => ({ subscriptionPackages: [] });

    const inMemSubTx = await PaymentRepository.createAsync({
      type: 'Subscription',
      amount: 500,
      status: 'Pending',
      plan: 'Pro Plan',
      userId: 'snap-u-1',
      paymentMethod: 'Easypaisa',
      packageSnapshot: { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 }
    });
    const inMemApproved = await PaymentRepository.verify(inMemSubTx.id, 'approve', 'Verified in memory');

    const inMemBadTx = await PaymentRepository.createAsync({
      type: 'Subscription',
      amount: 300,
      status: 'Pending',
      plan: 'Pro Plan',
      userId: 'snap-u-1',
      paymentMethod: 'Easypaisa',
      packageSnapshot: { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 }
    });
    let mismatchThrew = false;
    try {
      await PaymentRepository.verify(inMemBadTx.id, 'approve');
    } catch {
      mismatchThrew = true;
    }
    const inMemBadReloaded = await PaymentRepository.getByIdAsync(inMemBadTx.id);

    const inMemRejectTx = await PaymentRepository.createAsync({
      type: 'Subscription',
      amount: 500,
      status: 'Pending',
      plan: 'Pro Plan',
      userId: 'snap-u-1',
      paymentMethod: 'Easypaisa',
      packageSnapshot: { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 }
    });
    const inMemRejected = await PaymentRepository.verify(inMemRejectTx.id, 'reject', undefined, 'Invalid receipt');

    // 18b. Mock-Mongo mode verify() enforces ensureTransactionIndexesReady and atomic claim
    resetTransactionIndexStateForTests();
    const verifyMongoColl = new MockTransactionsCollection();
    setMockTransactionsCollectionForTests(verifyMongoColl);
    const mongoSubTx = await PaymentRepository.createAsync({
      type: 'Subscription',
      amount: 500,
      status: 'Pending',
      plan: 'Pro Plan',
      userId: 'snap-u-1',
      paymentMethod: 'Easypaisa',
      packageSnapshot: { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 }
    });
    const mongoApproved = await PaymentRepository.verify(mongoSubTx.id, 'approve', 'Verified in mock Mongo');

    assert(
      inMemApproved?.status === 'Success' &&
        inMemActivatedTier === 'Pro Plan' &&
        inMemActivatedStatus === 'Active' &&
        mismatchThrew &&
        inMemBadReloaded?.status === 'Pending' &&
        inMemRejected?.status === 'Failed' &&
        mongoApproved?.status === 'Success' &&
        areTransactionIndexesReady(),
      '18. Existing subscription_snapshot and verify() approve/reject behaviors remain intact in both in-memory and Mongo modes'
    );
  } catch (err: any) {
    console.error('Fatal error during payment repository index tests:', err?.message || err);
    failCount++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    // Restore all monkeypatched methods cleanly
    Database.addTransaction = origDbAddTx;
    UserRepository.getByIdAsync = origUserGetByIdAsync;
    UserRepository.deductWalletBalanceAsync = origUserDeductWalletAsync;
    UserRepository.creditWalletBalanceAsync = origUserCreditWalletAsync;
    UserRepository.updateAsync = origUserUpdateAsync;
    PricingRepository.get = origPricingGet;
    PricingRepository.calculateAdPrice = origPricingCalcAd;
    PaymentSettingsRepository.getPublicSettings = origSettingsPublic;
    JobRepository.approvePending = origJobApprovePending;
    AdRepository.update = origAdUpdate;
    AuditRepository.addAfterPrimaryOperation = origAuditAddAfter;
    NotificationRepository.createAsync = origNotifCreateAsync;
    console.error = origConsoleError;

    MongoClient.prototype.connect = origMongoConnect;
    Collection.prototype.createIndex = origPrototypeCreateIndex;
    Collection.prototype.createIndexes = origPrototypeCreateIndexes;

    resetTransactionIndexStateForTests();

    const postTransactionsHash = hashFile('data/transactions.json');
    const postUsersHash = hashFile('data/users.json');
    const postAuditHash = hashFile('data/audit_logs.json');

    assert(
      postTransactionsHash === preTransactionsHash &&
        postUsersHash === preUsersHash &&
        postAuditHash === preAuditHash,
      'File Integrity: data/transactions.json, data/users.json, and data/audit_logs.json remained byte-for-byte identical'
    );

    assert(
      mongoConnectCalls === 0 && mongoCreateIndexCalls === 0,
      'Isolation Final Check: Zero real MongoDB connections or prototype index calls occurred'
    );

    console.log('\n=== FINAL RESULTS ===');
    console.log(`Total Passed: ${passCount}`);
    console.log(`Total Failed: ${failCount}`);

    if (failCount > 0) process.exit(1);
    else process.exit(0);
  }
}

runTests();
