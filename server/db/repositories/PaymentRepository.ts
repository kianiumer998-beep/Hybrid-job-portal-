import { Database } from '../database';
import { UserRepository } from './UserRepository';
import { JobRepository } from './JobRepository';
import { AuditRepository } from './AuditRepository';
import { AdRepository } from './AdRepository';
import { PricingRepository } from './PricingRepository';
import { getMongoDb, isMongoConfigured } from '../mongodb';

const activeCompensationLocks = new Set<string>();
const activeEscrowSettlementLocks = new Set<string>();
const isTest = () => process.env.IS_TEST === 'true';
let mockTransactionsCollection: any = null;
const isMockMongoActive = () =>
  isTest() && process.env.NODE_ENV !== 'production' && mockTransactionsCollection !== null;
const isMongoActive = () => isMockMongoActive() || (isMongoConfigured() && !isTest());
const isPureInMemoryTest = () => isTest() && !isMockMongoActive();
const inMemoryTransactions = new Map<string, any>();

export const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

export class TransactionIndexInitializationError extends Error {
  code: string;
  statusCode: number;
  constructor(
    message = 'Transaction storage is temporarily not ready while verifying database indexes. No new payment was recorded.'
  ) {
    super(message);
    this.name = 'TransactionIndexInitializationError';
    this.code = 'TRANSACTION_INDEX_NOT_READY';
    this.statusCode = 503;
  }
}

export class InvalidIdempotencyKeyError extends Error {
  code: string;
  statusCode: number;
  constructor(message = 'Invalid idempotencyKey.') {
    super(message);
    this.name = 'InvalidIdempotencyKeyError';
    this.code = 'INVALID_IDEMPOTENCY_KEY';
    this.statusCode = 400;
  }
}

function sanitizeKeyPattern(rawPattern: unknown): Record<string, 1 | -1 | true> | undefined {
  if (!rawPattern || typeof rawPattern !== 'object' || Array.isArray(rawPattern)) {
    return undefined;
  }
  const allowedFields = new Set(['id', 'transactionId', 'idempotencyKey']);
  const safe: Record<string, 1 | -1 | true> = {};
  for (const [k, v] of Object.entries(rawPattern)) {
    if (allowedFields.has(k) && (v === 1 || v === -1 || v === true)) {
      safe[k] = v;
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export class MongoDuplicateTransactionError extends Error {
  code: number;
  keyPattern?: Record<string, 1 | -1 | true>;
  constructor(
    message = 'A transaction with this reference or idempotency key already exists.',
    code: number = 11000,
    keyPattern?: unknown
  ) {
    super(message);
    this.name = 'MongoDuplicateTransactionError';
    this.code = code;
    const safePattern = sanitizeKeyPattern(keyPattern);
    if (safePattern) {
      this.keyPattern = safePattern;
    }
  }
}

function wrapMongoTransactionError(err: any): never {
  if (
    err instanceof TransactionIndexInitializationError ||
    err instanceof MongoDuplicateTransactionError ||
    err instanceof InvalidIdempotencyKeyError
  ) {
    throw err;
  }
  if (
    err &&
    (err.code === 11000 ||
      err.code === '11000' ||
      (typeof err.message === 'string' && (err.message.includes('E11000') || /duplicate key/i.test(err.message))))
  ) {
    throw new MongoDuplicateTransactionError(
      'A transaction with this reference or idempotency key already exists.',
      11000,
      err.keyPattern
    );
  }
  throw new Error('Transaction database operation failed.');
}

export function normalizeIdempotencyKey(key: unknown): string | undefined {
  if (key === undefined || key === null) {
    return undefined;
  }
  if (typeof key !== 'string') {
    throw new InvalidIdempotencyKeyError('Invalid idempotencyKey: must be a string.');
  }
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new InvalidIdempotencyKeyError(
      `idempotencyKey exceeds maximum length of ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`
    );
  }
  return trimmed;
}

export type CompensationStatusState =
  | 'Compensating'
  | 'Compensated'
  | 'CompensationUncertain';

export type DepositVerificationState =
  | 'Crediting'
  | 'Completed'
  | 'CreditUncertain';

async function getTransactionsCollection() {
  if (isMockMongoActive()) {
    return mockTransactionsCollection;
  }
  const db = await getMongoDb();
  return db.collection('transactions');
}

let indexInitializationPromise: Promise<void> | null = null;
let indexesReady = false;

export async function ensureTransactionIndexesReady(): Promise<void> {
  if (isPureInMemoryTest() || !isMongoActive()) {
    indexesReady = true;
    return;
  }
  if (indexesReady) return;

  if (indexInitializationPromise) {
    return indexInitializationPromise;
  }

  const currentInit = (async () => {
    try {
      const coll = await getTransactionsCollection();
      await coll.createIndex({ id: 1 }, { unique: true, sparse: true });
      await coll.createIndex({ transactionId: 1 }, { unique: true, sparse: true });
      await coll.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
      indexesReady = true;
      console.log('[PaymentRepository] MongoDB unique indexes verified successfully on transactions collection.');
    } catch (err: any) {
      indexesReady = false;
      console.error(
        '[PaymentRepository] Error: Transaction index initialization failed:',
        err?.code ?? err?.name ?? 'INDEX_INIT_FAILED'
      );
      throw new TransactionIndexInitializationError();
    } finally {
      if (indexInitializationPromise === currentInit) {
        indexInitializationPromise = null;
      }
    }
  })();

  indexInitializationPromise = currentInit;
  return currentInit;
}

export function areTransactionIndexesReady(): boolean {
  if (isPureInMemoryTest() || !isMongoActive()) return true;
  return indexesReady;
}

export function setMockTransactionsCollectionForTests(coll: any): void {
  if (!isTest() || process.env.NODE_ENV === 'production') {
    throw new Error('Mock transactions collection can only be configured in non-production test mode.');
  }
  mockTransactionsCollection = coll;
}

export function resetTransactionIndexStateForTests(): void {
  if (!isTest() || process.env.NODE_ENV === 'production') {
    throw new Error('Transaction index state reset is restricted to non-production test mode.');
  }
  indexesReady = false;
  indexInitializationPromise = null;
  mockTransactionsCollection = null;
  inMemoryTransactions.clear();
}

export class PaymentRepository {
  static isTransactionCompensated(tx: any): boolean {
    if (!tx) return false;
    return Boolean(
      tx.compensated === true ||
      tx.refunded === true ||
      tx.status === 'Refunded' ||
      tx.compensationStatus === 'Compensated' ||
      tx.compensatedAt ||
      tx.refundReferenceId
    );
  }

  static isCompensationInProgressOrUncertain(tx: any): boolean {
    if (!tx) return false;
    return Boolean(
      tx.compensationStatus === 'Compensating' ||
      tx.compensationStatus === 'CompensationUncertain'
    );
  }

  static getAll(userId?: string): any[] {
    if (isPureInMemoryTest()) {
      const txs = Array.from(inMemoryTransactions.values());
      if (userId) {
        return txs.filter(t => t && String(t.userId || '') === String(userId));
      }
      return txs;
    }
    let txs = Database.getTransactions();
    if (userId) {
      txs = txs.filter(t => t && String(t.userId || '') === String(userId));
    }
    return txs;
  }

  static async getAllAsync(userId?: string): Promise<any[]> {
    if (isPureInMemoryTest()) return this.getAll(userId);
    if (isMongoActive()) {
      try {
        const coll = await getTransactionsCollection();
        const query = userId ? { userId: String(userId) } : {};
        const docs = await coll.find(query).sort({ createdAt: -1 }).toArray();
        return (docs || []).map((d: any) => {
          const { _id, ...safe } = d;
          return safe;
        });
      } catch (err: any) {
        wrapMongoTransactionError(err);
      }
    }
    return this.getAll(userId);
  }

  static getById(id: string): any | null {
    if (isPureInMemoryTest()) return inMemoryTransactions.get(id) || null;
    const txs = Database.getTransactions();
    return txs.find(t => t && String(t.id) === String(id)) || null;
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (!id) return null;
    if (isPureInMemoryTest()) return this.getById(id);
    if (isMongoActive()) {
      try {
        const coll = await getTransactionsCollection();
        const doc = await coll.findOne({ id: String(id) });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err: any) {
        wrapMongoTransactionError(err);
      }
    }
    return this.getById(id);
  }

  static findByIdempotencyKey(key: string): any | null {
    const cleanKey = normalizeIdempotencyKey(key);
    if (!cleanKey) return null;
    if (isPureInMemoryTest()) {
      return Array.from(inMemoryTransactions.values()).find(t => t && String(t.idempotencyKey) === cleanKey) || null;
    }
    const txs = Database.getTransactions();
    return txs.find(t => t && String(t.idempotencyKey) === cleanKey) || null;
  }

  static async findByIdempotencyKeyAsync(key: string): Promise<any | null> {
    const cleanKey = normalizeIdempotencyKey(key);
    if (!cleanKey) return null;
    if (isPureInMemoryTest()) return this.findByIdempotencyKey(cleanKey);
    if (isMongoActive()) {
      try {
        const coll = await getTransactionsCollection();
        const doc = await coll.findOne({ idempotencyKey: cleanKey });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err: any) {
        wrapMongoTransactionError(err);
      }
    }
    return this.findByIdempotencyKey(cleanKey);
  }

  static findByTransactionId(tid: string): any | null {
    if (!tid) return null;
    if (isPureInMemoryTest()) {
      return Array.from(inMemoryTransactions.values()).find(t => t && String(t.transactionId) === String(tid)) || null;
    }
    const txs = Database.getTransactions();
    return txs.find(t => t && String(t.transactionId) === String(tid)) || null;
  }

  static async findByTransactionIdAsync(tid: string): Promise<any | null> {
    if (!tid) return null;
    if (isPureInMemoryTest()) return this.findByTransactionId(tid);
    if (isMongoActive()) {
      try {
        const coll = await getTransactionsCollection();
        const doc = await coll.findOne({ transactionId: String(tid) });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err: any) {
        wrapMongoTransactionError(err);
      }
    }
    return this.findByTransactionId(tid);
  }

  static create(txData: any): any {
    if (isPureInMemoryTest()) {
      const id = txData?.id || `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const cleanKey = normalizeIdempotencyKey(txData?.idempotencyKey);
      const { _id: _ignored, idempotencyKey: _ignoredKey, ...clean } = txData || {};
      const tx = { ...clean, id, ...(cleanKey ? { idempotencyKey: cleanKey } : {}) };
      inMemoryTransactions.set(id, tx);
      return tx;
    }
    if (isMongoActive()) {
      throw new Error('MongoDB is configured. Synchronous create is prohibited; use createAsync.');
    }
    return Database.addTransaction(txData);
  }

  static async createAsync(txData: any): Promise<any> {
    const id = txData?.id || `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const cleanKey = normalizeIdempotencyKey(txData?.idempotencyKey);
    const { _id: _ignored, idempotencyKey: _rawKey, ...clean } = txData || {};
    const txToSave = {
      ...clean,
      id,
      ...(cleanKey ? { idempotencyKey: cleanKey } : {}),
      createdAt: txData?.createdAt || new Date().toISOString(),
      updatedAt: txData?.updatedAt || new Date().toISOString()
    };

    if (isPureInMemoryTest()) {
      inMemoryTransactions.set(id, txToSave);
      return txToSave;
    }
    if (isMongoActive()) {
      await ensureTransactionIndexesReady();
      try {
        const coll = await getTransactionsCollection();
        await coll.insertOne({ ...txToSave });
        return txToSave;
      } catch (err: any) {
        wrapMongoTransactionError(err);
      }
    }
    return Database.addTransaction(txToSave);
  }

  static async updateAsync(id: string, updates: Record<string, any>): Promise<any | null> {
    const updatedAt = new Date().toISOString();
    const hasKeyUpdate = Boolean(updates && Object.prototype.hasOwnProperty.call(updates, 'idempotencyKey'));
    const cleanKey = hasKeyUpdate ? normalizeIdempotencyKey(updates.idempotencyKey) : undefined;
    const { idempotencyKey: _rawKey, ...restUpdates } = updates || {};
    const updatePayload: Record<string, any> = {
      ...restUpdates,
      ...(hasKeyUpdate && cleanKey ? { idempotencyKey: cleanKey } : {}),
      updatedAt
    };

    if (isPureInMemoryTest()) {
      const existing = inMemoryTransactions.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updatePayload };
      if (hasKeyUpdate && !cleanKey) {
        delete updated.idempotencyKey;
      }
      inMemoryTransactions.set(id, updated);
      return updated;
    }
    if (isMongoActive()) {
      await ensureTransactionIndexesReady();
      try {
        const coll = await getTransactionsCollection();
        const mongoUpdateOp: Record<string, any> = { $set: updatePayload };
        if (hasKeyUpdate && !cleanKey) {
          mongoUpdateOp.$unset = { idempotencyKey: '' };
        }
        await coll.updateOne({ id: String(id) }, mongoUpdateOp);
        const doc = await coll.findOne({ id: String(id) });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err: any) {
        wrapMongoTransactionError(err);
      }
    }
    const txs = Database.getTransactions();
    const idx = txs.findIndex(t => t && String(t.id) === String(id));
    if (idx === -1) return null;
    txs[idx] = { ...txs[idx], ...updatePayload };
    Database.saveTransactions(txs);
    return txs[idx];
  }

  static async linkAdvertisement(txId: string, adId: string, adTitle?: string): Promise<any | null> {
    if (!txId || !adId) return null;
    const tx = await this.getByIdAsync(txId);
    if (!tx) return null;

    const updates: Record<string, any> = {
      adIdRef: adId,
      updatedAt: new Date().toISOString()
    };
    if (adTitle) {
      updates.adTitleRef = adTitle;
      if (!tx.jobTitleRef) {
        updates.jobTitleRef = adTitle;
      }
    }
    return await this.updateAsync(txId, updates);
  }

  static async compensateAdvertisementPayment(
    txIdOrRef: string,
    options: {
      authenticatedUserId: string;
      isAdmin?: boolean;
      failureReason?: string;
      adIdRef?: string;
      adTitleRef?: string;
      idempotencyKey?: string;
      actorName?: string;
    }
  ): Promise<{
    compensated: boolean;
    alreadyCompensated: boolean;
    restoredAmount: number;
    transaction: any | null;
    refundReferenceId?: string;
    reason?: string;
    auditPersisted?: boolean;
    auditWarning?: string;
  }> {
    const lookupKey = String(txIdOrRef || options?.idempotencyKey || '').trim();
    if (!lookupKey) {
      return {
        compensated: false,
        alreadyCompensated: false,
        restoredAmount: 0,
        transaction: null,
        reason: 'Transaction identifier is required for compensation.'
      };
    }

    const initialTx =
      (await this.getByIdAsync(lookupKey)) ||
      (await this.findByTransactionIdAsync(lookupKey)) ||
      (options?.idempotencyKey ? await this.findByIdempotencyKeyAsync(options.idempotencyKey) : null);

    if (!initialTx) {
      return {
        compensated: false,
        alreadyCompensated: false,
        restoredAmount: 0,
        transaction: null,
        reason: 'Original Advertisement transaction not found.'
      };
    }

    const lockKey = String(initialTx.id);
    if (activeCompensationLocks.has(lockKey)) {
      return {
        compensated: true,
        alreadyCompensated: true,
        restoredAmount: 0,
        transaction: (await this.getByIdAsync(lockKey)) || initialTx,
        reason: 'Compensation is already in progress for this transaction.'
      };
    }

    activeCompensationLocks.add(lockKey);
    try {
      const tx = await this.getByIdAsync(lockKey);
      if (!tx) {
        return {
          compensated: false,
          alreadyCompensated: false,
          restoredAmount: 0,
          transaction: null,
          reason: 'Original Advertisement transaction not found.'
        };
      }

      const authUserId = String(options?.authenticatedUserId || '').trim();
      if (!authUserId) {
        throw new Error('Authentication required to compensate advertisement transaction.');
      }
      if (!options?.isAdmin && String(tx.userId || '') !== authUserId) {
        throw new Error('Forbidden: Payment transaction does not belong to the authenticated user.');
      }

      if (tx.type !== 'Advertisement' || tx.paymentMethod !== 'Wallet Balance') {
        return {
          compensated: false,
          alreadyCompensated: false,
          restoredAmount: 0,
          transaction: tx,
          reason: 'Only Advertisement Wallet Balance transactions are eligible for automatic failure compensation.'
        };
      }

      if (this.isTransactionCompensated(tx)) {
        return {
          compensated: true,
          alreadyCompensated: true,
          restoredAmount: 0,
          transaction: tx,
          refundReferenceId: tx.refundReferenceId,
          reason: 'Transaction has already been compensated.'
        };
      }

      if (this.isCompensationInProgressOrUncertain(tx)) {
        throw new Error(
          `Cannot compensate Advertisement transaction: compensation state is ${tx.compensationStatus} and requires reconciliation.`
        );
      }

      const allAds = Database.getAds() || [];
      const linkedAd = allAds.find(
        (a: any) =>
          a &&
          (String(a.walletTxId || '') === String(tx.id) ||
            String(a.paymentTransactionId || '') === String(tx.id) ||
            (tx.transactionId && String(a.transactionRef || '') === String(tx.transactionId)) ||
            (tx.idempotencyKey && String(a.idempotencyKey || '') === String(tx.idempotencyKey)))
      );
      if (linkedAd) {
        return {
          compensated: false,
          alreadyCompensated: false,
          restoredAmount: 0,
          transaction: tx,
          reason: 'Cannot compensate payment: advertisement campaign was already created.'
        };
      }

      if (tx.status !== 'Success') {
        return {
          compensated: false,
          alreadyCompensated: false,
          restoredAmount: 0,
          transaction: tx,
          reason: `Transaction status is ${tx.status}; no wallet deduction to compensate.`
        };
      }

      const originalAmount = Number(tx.amount);
      if (!Number.isFinite(originalAmount) || originalAmount < 0) {
        throw new Error('Invalid original transaction amount for compensation.');
      }

      const targetUserId = String(tx.userId || '');
      if (!targetUserId) {
        throw new Error('Cannot compensate Advertisement transaction: missing userId on transaction.');
      }

      const user = await UserRepository.getByIdAsync(targetUserId);
      if (!user) {
        throw new Error('Cannot compensate Advertisement transaction: transaction owner not found.');
      }

      const rawCurrentBal = Number(user.walletBalance || 0);
      let currentBal = Number.isFinite(rawCurrentBal) && rawCurrentBal >= 0 ? rawCurrentBal : 0;
      let restoredBalance = currentBal + originalAmount;
      const isEscrowHeld = tx.escrowStatus === 'HELD' || tx.escrowStatus === 'SETTLING_RELEASE';

      if (originalAmount > 0) {
        await this.updateAsync(lockKey, {
          compensationStatus: 'Compensating' as CompensationStatusState,
          ...(isEscrowHeld ? { escrowStatus: 'SETTLING_RELEASE' } : {}),
          updatedAt: new Date().toISOString()
        });

        const persistedClaim = await this.getByIdAsync(lockKey);
        if (!persistedClaim || persistedClaim.compensationStatus !== 'Compensating') {
          throw new Error('Failed to persist durable compensation claim before wallet credit.');
        }

        let updatedUser: any = null;
        try {
          updatedUser = isEscrowHeld
            ? await UserRepository.settleWalletEscrowAsync(user.id, originalAmount, `settle-${lockKey}`, true)
            : await UserRepository.creditWalletBalanceAsync(user.id, originalAmount);
        } catch (creditErr) {
          await this.updateAsync(lockKey, {
            originalStatus: tx.status,
            status: 'Pending',
            compensationStatus: 'CompensationUncertain' as CompensationStatusState,
            ...(isEscrowHeld ? { escrowStatus: 'SETTLING_RELEASE' } : {}),
            updatedAt: new Date().toISOString()
          });
          throw creditErr;
        }

        if (!updatedUser) {
          await this.updateAsync(lockKey, {
            compensationStatus: undefined,
            ...(isEscrowHeld ? { escrowStatus: 'HELD' } : {}),
            updatedAt: new Date().toISOString()
          });
          throw new Error('Failed to restore user wallet balance during Advertisement payment compensation.');
        }

        restoredBalance = Number(updatedUser.walletBalance);
        currentBal = restoredBalance - (isEscrowHeld ? originalAmount : originalAmount);
      }

      const compensatedAt = new Date().toISOString();
      const refundReferenceId = `CMP-${tx.transactionId || tx.id}`;
      const effectiveReason =
        options?.failureReason || 'Advertisement campaign creation failed after wallet deduction.';

      const updatedTx = await this.updateAsync(lockKey, {
        originalStatus: tx.status,
        status: 'Refunded',
        compensated: true,
        refunded: true,
        compensationStatus: 'Compensated' as CompensationStatusState,
        ...(isEscrowHeld ? { escrowStatus: 'RELEASED' } : {}),
        originalChargedAmount: originalAmount,
        refundedAmount: originalAmount,
        compensatedAt,
        refundedAt: compensatedAt,
        refundReferenceId,
        compensationReason: effectiveReason,
        compensationBalanceBefore: currentBal,
        compensationBalanceAfter: restoredBalance,
        compensationMetadata: {
          refundReferenceId,
          originalTransactionId: tx.transactionId || tx.id,
          originalChargedAmount: originalAmount,
          restoredAmount: originalAmount,
          balanceBeforeRefund: currentBal,
          balanceAfterRefund: restoredBalance,
          failureReason: effectiveReason,
          adIdRef: options?.adIdRef || tx.adIdRef,
          adTitleRef: options?.adTitleRef || tx.adTitleRef || tx.jobTitleRef,
          idempotencyKey: options?.idempotencyKey || tx.idempotencyKey,
          compensatedAt
        },
        adminNote: `Wallet payment of ${originalAmount} ${tx.currency || 'PKR'} automatically restored due to campaign creation failure (${effectiveReason}). Ref: ${refundReferenceId}`
      });

      const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
        user: options?.actorName || tx.userName || user.name || 'Advertiser',
        role: 'Advertiser',
        action: 'Ad Payment Compensated (Wallet Refund)',
        target: `Transaction ${tx.transactionId || tx.id} (${originalAmount} ${tx.currency || 'PKR'})`,
        status: 'Warning',
        metadata: {
          walletTxId: tx.id,
          transactionId: tx.transactionId,
          refundReferenceId,
          userId: tx.userId,
          originalChargedAmount: originalAmount,
          restoredAmount: originalAmount,
          balanceBeforeRefund: currentBal,
          balanceAfterRefund: restoredBalance,
          failureReason: effectiveReason,
          adIdRef: options?.adIdRef || tx.adIdRef,
          idempotencyKey: options?.idempotencyKey || tx.idempotencyKey
        }
      }, 'PaymentRepository.compensateAdvertisementPayment');

      return {
        compensated: true,
        alreadyCompensated: false,
        restoredAmount: originalAmount,
        transaction: updatedTx,
        refundReferenceId,
        ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
      };
    } finally {
      activeCompensationLocks.delete(lockKey);
    }
  }

  static async resolveAdvertisementEscrow(
    txId: string,
    action: 'approve' | 'refund',
    actorName: string,
    actorRole: string,
    reason?: string
  ): Promise<{ transaction: any; alreadySettled: boolean; refundReferenceId?: string }> {
    const cleanId = String(txId || '').trim();
    if (!cleanId) throw new Error('Campaign wallet transaction reference is required.');
    if (activeEscrowSettlementLocks.has(cleanId)) throw new Error('This campaign wallet settlement is already being processed.');
    activeEscrowSettlementLocks.add(cleanId);
    try {
      const tx = await this.getByIdAsync(cleanId);
      if (!tx || tx.type !== 'Advertisement' || tx.paymentMethod !== 'Wallet Balance') {
        throw new Error('The linked campaign wallet transaction could not be verified.');
      }
      if (!tx.userId) throw new Error('Campaign wallet transaction is missing its user account reference.');
      const amount = Number(tx.escrowAmount ?? tx.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Campaign escrow amount is invalid.');
      const now = new Date().toISOString();
      const isRefund = action === 'refund';
      const settledState = isRefund ? 'RELEASED' : 'CAPTURED';
      const settlingState = isRefund ? 'SETTLING_RELEASE' : 'SETTLING_CAPTURE';

      if (tx.escrowStatus === settledState || (isRefund && this.isTransactionCompensated(tx))) {
        return { transaction: tx, alreadySettled: true, ...(tx.refundReferenceId ? { refundReferenceId: tx.refundReferenceId } : {}) };
      }
      if (tx.escrowStatus && !['HELD', settlingState].includes(tx.escrowStatus)) {
        throw new Error(`Campaign escrow is already in state ${tx.escrowStatus} and cannot be ${action === 'approve' ? 'approved' : 'refunded'}.`);
      }
      if (tx.status !== 'Success' && tx.escrowStatus !== settlingState) {
        throw new Error(`Campaign payment is not settled (transaction status: ${tx.status}).`);
      }

      let updatedUser: any = null;
      if (tx.escrowStatus === 'HELD' || tx.escrowStatus === settlingState) {
        if (tx.escrowStatus === 'HELD') {
          const claimed = await this.updateAsync(cleanId, {
            escrowStatus: settlingState,
            escrowSettlementAction: action,
            escrowSettlementStartedAt: now
          });
          if (!claimed || claimed.escrowStatus !== settlingState) {
            throw new Error('Could not safely claim this campaign escrow settlement.');
          }
        } else if (tx.escrowSettlementAction && tx.escrowSettlementAction !== action) {
          throw new Error('A different campaign escrow settlement action is already in progress.');
        }

        updatedUser = await UserRepository.settleWalletEscrowAsync(
          String(tx.userId),
          amount,
          `settle-${cleanId}`,
          isRefund
        );
        if (!updatedUser) {
          throw new Error('Campaign escrow could not be settled because the held wallet amount is unavailable. Manual reconciliation is required.');
        }
      } else if (isRefund && !tx.escrowStatus) {
        // Backward compatibility: refund paid campaigns created before escrow tracking existed.
        updatedUser = await UserRepository.creditWalletBalanceOnceAsync(
          String(tx.userId),
          amount,
          `ad-refund-${cleanId}`
        );
        if (!updatedUser) throw new Error('Could not restore the legacy campaign payment to the user wallet.');
      }

      const refundReferenceId = isRefund ? `AD-REF-${tx.transactionId || cleanId}` : undefined;
      const finalTx = await this.updateAsync(cleanId, {
        escrowStatus: settledState,
        escrowAmount: amount,
        escrowSettledAt: now,
        escrowSettlementAction: action,
        ...(isRefund ? {
          status: 'Refunded',
          refunded: true,
          refundedAmount: amount,
          refundedAt: now,
          refundReferenceId,
          compensationReason: reason || 'Campaign rejected by administrator; escrow released to user wallet.',
          compensationBalanceAfter: Number(updatedUser?.walletBalance ?? 0),
          adminNote: `Campaign payment of ${amount} PKR refunded to wallet. Ref: ${refundReferenceId}`
        } : {
          status: 'Success',
          capturedAmount: amount,
          capturedAt: now,
          adminNote: 'Campaign approved; escrow captured as campaign payment.'
        })
      });
      if (!finalTx) throw new Error('Wallet settlement completed but its transaction record could not be finalized. Retry the same action to reconcile safely.');

      const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
        user: actorName || 'Administrator',
        role: actorRole || 'Admin',
        action: isRefund ? 'Campaign Escrow Refunded' : 'Campaign Escrow Captured',
        target: `Transaction ${tx.transactionId || cleanId} (${amount} PKR)`,
        status: isRefund ? 'Warning' : 'Success',
        metadata: {
          transactionId: cleanId,
          userId: tx.userId,
          adId: tx.adIdRef,
          amount,
          escrowStatus: settledState,
          refundReferenceId
        }
      }, 'PaymentRepository.resolveAdvertisementEscrow');

      return {
        transaction: finalTx,
        alreadySettled: false,
        ...(refundReferenceId ? { refundReferenceId } : {}),
        ...(auditOutcome.persisted ? {} : {})
      };
    } finally {
      activeEscrowSettlementLocks.delete(cleanId);
    }
  }

  static async verify(id: string, action: 'approve' | 'reject', note?: string, reason?: string): Promise<any | null> {
    // Safe recovery for a previously approved CV package/subscription whose entitlement write or
    // transaction finalization was uncertain. The transaction ID makes the grant idempotent.
    if (action === 'approve') {
      const recoverable = await this.getByIdAsync(id);
      if (recoverable?.status === 'VerificationUncertain') {
        const snapshot = recoverable.type === 'CV Design Purchase'
          ? recoverable.cvPurchaseSnapshot
          : recoverable.type === 'Subscription' ? recoverable.packageSnapshot : null;
        const hasCvBenefitSnapshot = recoverable.type === 'CV Design Purchase'
          ? snapshot?.kind === 'package'
          : recoverable.type === 'Subscription' && snapshot?.cvBenefitsEnabled === true;
        if (hasCvBenefitSnapshot) {
          let owner: any = recoverable.userId ? await UserRepository.getByIdAsync(String(recoverable.userId)) : null;
          if (!owner && recoverable.type === 'Subscription' && recoverable.userEmail) {
            owner = await UserRepository.getByEmailAsync(String(recoverable.userEmail));
          }
          const subscriptionIsActive = recoverable.type !== 'Subscription' ||
            (owner?.membershipStatus === 'Active' && String(owner?.membershipTier || '') === String(snapshot?.name || '') &&
              Date.parse(String(owner?.subscriptionExpiresAt || '')) > Date.now());
          if (!owner || !subscriptionIsActive) {
            throw new Error('This uncertain payment requires administrator reconciliation. The linked account or subscription activation could not be confirmed.');
          }
          const grantSnapshot = recoverable.type === 'CV Design Purchase' ? snapshot : {
            packageId: `subscription:${snapshot.id}`,
            packageName: `${String(snapshot.name || snapshot.id)} CV Benefits`,
            pricePkr: Number(snapshot.pricePkr),
            durationDays: Number(snapshot.durationDays),
            cvCreateLimit: Number(snapshot.cvBenefits?.cvCreateLimit ?? 0),
            editLimit: Number(snapshot.cvBenefits?.editLimit ?? 0),
            pdfExportLimit: Number(snapshot.cvBenefits?.pdfExportLimit ?? 0),
            atsExportLimit: Number(snapshot.cvBenefits?.atsExportLimit ?? 0),
            shareLimit: Number(snapshot.cvBenefits?.shareLimit ?? 0),
            noWatermark: snapshot.cvBenefits?.noWatermark === true
          };
          const granted = await UserRepository.grantCvPackageEntitlementAsync(owner.id, grantSnapshot, String(recoverable.id));
          if (!granted) throw new Error('CV entitlement recovery could not be confirmed. The transaction remains under reconciliation.');
          return await this.updateAsync(id, {
            status: 'Success',
            ...(recoverable.type === 'CV Design Purchase' ? { cvPackageEntitlementGranted: true } : { cvPackageEntitlementGranted: true }),
            userId: owner.id,
            verifiedAt: recoverable.verifiedAt || new Date().toISOString(),
            adminNote: note || 'Previously uncertain CV entitlement was reconciled and activated.',
            rejectionReason: undefined,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
    if (isPureInMemoryTest()) {
      const tx = inMemoryTransactions.get(id);
      if (!tx) return null;
      if (tx.status !== 'Pending') {
        throw new Error(`Transaction is already ${tx.status} and cannot be processed.`);
      }
      tx.status = 'Verifying';
      tx.updatedAt = new Date().toISOString();
      inMemoryTransactions.set(id, tx);
    } else if (isMongoActive()) {
      await ensureTransactionIndexesReady();
      try {
        const coll = await getTransactionsCollection();
        const res: any = await coll.findOneAndUpdate(
          { id: String(id), status: 'Pending' },
          { $set: { status: 'Verifying', updatedAt: new Date().toISOString() } },
          { returnDocument: 'after' }
        );
        const claimed = res && typeof res === 'object' ? ('value' in res ? res.value : res) : null;
        if (!claimed) {
          const existing = await this.getByIdAsync(id);
          if (!existing) return null;
          throw new Error(`Transaction is already ${existing.status} or being processed concurrently.`);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('already')) throw err;
        wrapMongoTransactionError(err);
      }
    } else {
      const txs = Database.getTransactions();
      const idx = txs.findIndex(t => t && String(t.id) === String(id));
      if (idx === -1) return null;
      const tx = txs[idx];
      if (tx.status !== 'Pending') {
        throw new Error(`Transaction is already ${tx.status} and cannot be processed.`);
      }
      tx.status = 'Verifying';
      tx.updatedAt = new Date().toISOString();
      Database.saveTransactions(txs);
    }

    const tx = await this.getByIdAsync(id);
    if (!tx) return null;

    const supportedVerificationTypes = [
      'Wallet Deposit',
      'Subscription',
      'Job Posting',
      'Job Posting Fee',
      'Advertisement',
      'Ad Campaign Fee',
      'CV Design Purchase'
    ];

    if (!supportedVerificationTypes.includes(tx.type)) {
      await this.updateAsync(id, {
        status: 'Pending',
        rejectionReason: `Unsupported transaction type "${tx.type}".`,
        updatedAt: new Date().toISOString()
      });
      throw new Error(`Cannot ${action} transaction: unsupported transaction type "${tx.type}".`);
    }

    if (
      tx.type === 'Wallet Deposit' &&
      (tx.walletCredited === true ||
        tx.verificationState === 'Crediting' ||
        tx.verificationState === 'CreditUncertain')
    ) {
      await this.updateAsync(id, { status: 'VerificationUncertain', rejectionReason: 'Wallet deposit verification state conflict.', updatedAt: new Date().toISOString() });
      throw new Error(
        `Cannot ${action} Wallet Deposit: verification state is ${tx.verificationState || 'Completed'} and requires reconciliation.`
      );
    }

    if (action === 'approve') {
      if (tx.paymentMethod === 'Wallet Balance') {
        await this.updateAsync(id, { status: 'Pending', updatedAt: new Date().toISOString() });
        throw new Error('Wallet Balance transactions cannot be manually approved.');
      }

      if (tx.type === 'Wallet Deposit') {
        if (!tx.userId) {
          await this.updateAsync(id, { status: 'VerificationUncertain', rejectionReason: 'Missing userId on Wallet Deposit.', updatedAt: new Date().toISOString() });
          throw new Error('Cannot approve Wallet Deposit: transaction is missing userId.');
        }

        const depositAmount = Number(tx.amount);
        if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
          await this.updateAsync(id, { status: 'VerificationUncertain', rejectionReason: 'Invalid deposit amount.', updatedAt: new Date().toISOString() });
          throw new Error('Cannot approve Wallet Deposit: invalid deposit amount.');
        }

        const user = await UserRepository.getByIdAsync(tx.userId);
        if (!user) {
          await this.updateAsync(id, { status: 'VerificationUncertain', rejectionReason: 'Target user not found.', updatedAt: new Date().toISOString() });
          throw new Error('Cannot approve Wallet Deposit: target user not found.');
        }

        await this.updateAsync(id, {
          verificationState: 'Crediting' as DepositVerificationState,
          updatedAt: new Date().toISOString()
        });

        let updatedUser: any = null;
        try {
          updatedUser = await UserRepository.creditWalletBalanceAsync(user.id, depositAmount);
        } catch (creditErr: any) {
          await this.updateAsync(id, {
            verificationState: 'CreditUncertain' as DepositVerificationState,
            status: 'VerificationUncertain',
            rejectionReason: creditErr?.message || 'Wallet credit failed',
            updatedAt: new Date().toISOString()
          });
          throw creditErr;
        }

        if (!updatedUser) {
          await this.updateAsync(id, {
            verificationState: 'CreditUncertain' as DepositVerificationState,
            status: 'VerificationUncertain',
            rejectionReason: 'Failed to update user wallet balance.',
            updatedAt: new Date().toISOString()
          });
          throw new Error('Cannot approve Wallet Deposit: failed to update user wallet balance.');
        }

        const balanceAfterDeposit = Number(updatedUser.walletBalance);
        const balanceBeforeDeposit = balanceAfterDeposit - depositAmount;

        await this.updateAsync(id, {
          walletCredited: true,
          verificationState: 'Completed' as DepositVerificationState,
          balanceBefore: balanceBeforeDeposit,
          balanceAfter: balanceAfterDeposit,
          status: 'Success',
          verifiedAt: new Date().toISOString(),
          adminNote: note || 'Verified and approved by administrator'
        });
      } else if (tx.type === 'Subscription') {
        let user: any = null;
        if (tx.userId) {
          user = await UserRepository.getByIdAsync(tx.userId);
        }
        if (!user && tx.userEmail) {
          user = await UserRepository.getByEmailAsync(tx.userEmail);
        }

        if (!user) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: 'Explicit verified user account could not be resolved.',
            updatedAt: new Date().toISOString()
          });
          throw new Error('Cannot approve Subscription: explicit verified user account could not be resolved from transaction.');
        }

        const planName = tx.plan;
        if (!planName) {
           await this.updateAsync(id, {
            status: 'Pending',
            rejectionReason: 'Missing plan information in subscription transaction.',
            updatedAt: new Date().toISOString()
          });
          throw new Error('Cannot approve Subscription: transaction is missing plan information.');
        }
        
        const pricing = (await PricingRepository.get()) || {};
        
        // Priority: Use the server-verified snapshot stored at transaction creation
        const snapshot = tx.packageSnapshot;
        let durationDays = 0;
        let membershipTier = '';

        const failSnapshot = async (reason: string) => {
          await this.updateAsync(id, {
            status: 'Pending',
            rejectionReason: reason,
            updatedAt: new Date().toISOString()
          });
          throw new Error(`Cannot approve Subscription: ${reason}`);
        };

        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
          await failSnapshot('Manual Review Required: Missing or invalid package snapshot.');
        }

        // 1. Snapshot ID & Name
        if (!snapshot.id || typeof snapshot.id !== 'string' || !snapshot.id.trim()) {
          await failSnapshot('Invalid package ID in snapshot.');
        }
        if (!snapshot.name || typeof snapshot.name !== 'string' || !snapshot.name.trim()) {
          await failSnapshot('Invalid package name in snapshot.');
        }

        // 2. Snapshot Price vs Transaction Amount
        const snapPrice = Number(snapshot.pricePkr);
        const txAmount = Number(tx.amount);
        if (!Number.isFinite(snapPrice) || snapPrice <= 0) {
          await failSnapshot('Invalid price in package snapshot.');
        }
        if (!Number.isFinite(txAmount) || Math.abs(txAmount - snapPrice) > 0.01) {
          await failSnapshot(`Transaction amount mismatch (Tx: ${txAmount}, Snapshot: ${snapPrice}).`);
        }

        // 3. Duration Days
        const snapDuration = Number(snapshot.durationDays);
        if (!Number.isFinite(snapDuration) || snapDuration <= 0 || !Number.isInteger(snapDuration)) {
          await failSnapshot('Invalid duration in package snapshot.');
        }

        durationDays = snapDuration;
        membershipTier = snapshot.name;

        let updatedUser: any = null;
        try {
          updatedUser = await UserRepository.updateAsync(user.id, {
            membershipTier: membershipTier,
            membershipStatus: 'Active',
            subscriptionExpiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
          });
        } catch (subErr: any) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: subErr?.message || 'Membership update uncertain',
            updatedAt: new Date().toISOString()
          });
          throw subErr;
        }

        if (!updatedUser) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: 'Failed to activate user membership.',
            updatedAt: new Date().toISOString()
          });
          throw new Error('Cannot approve Subscription: failed to activate user membership.');
        }

        if (snapshot.cvBenefitsEnabled === true) {
          const benefits = snapshot.cvBenefits || {};
          try {
            const cvGrant = await UserRepository.grantCvPackageEntitlementAsync(user.id, {
              packageId: `subscription:${snapshot.id}`,
              packageName: `${membershipTier} CV Benefits`,
              pricePkr: snapPrice,
              durationDays,
              cvCreateLimit: Number(benefits.cvCreateLimit ?? 0),
              editLimit: Number(benefits.editLimit ?? 0),
              pdfExportLimit: Number(benefits.pdfExportLimit ?? 0),
              atsExportLimit: Number(benefits.atsExportLimit ?? 0),
              shareLimit: Number(benefits.shareLimit ?? 0),
              noWatermark: benefits.noWatermark === true
            }, String(tx.id));
            if (!cvGrant) throw new Error('Subscription activated, but its CV benefits could not be saved to the account.');
          } catch (cvBenefitErr: any) {
            await this.updateAsync(id, {
              status: 'VerificationUncertain',
              rejectionReason: cvBenefitErr?.message || 'Subscription CV benefit activation is uncertain; manual reconciliation is required.',
              updatedAt: new Date().toISOString()
            });
            throw cvBenefitErr;
          }
        }

        await this.updateAsync(id, {
          userId: user.id,
          status: 'Success',
          verifiedAt: new Date().toISOString(),
          adminNote: note || 'Verified and approved by administrator'
        });
      } else if (tx.type === 'CV Design Purchase') {
        const snapshot = tx.cvPurchaseSnapshot;
        if (snapshot?.kind === 'package') {
          const packageId = String(snapshot.packageId || '').trim();
          const snapshotPrice = Number(snapshot.pricePkr);
          const transactionAmount = Number(tx.amount);
          const durationDays = Number(snapshot.durationDays);
          const quotaFields = ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit'];
          const validQuotas = quotaFields.every((field) => Number.isInteger(Number(snapshot[field])) && Number(snapshot[field]) >= 0 && Number(snapshot[field]) <= 10000);
          if (!tx.userId || !packageId || !Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3650 ||
            !Number.isFinite(snapshotPrice) || snapshotPrice <= 0 || !Number.isFinite(transactionAmount) ||
            Math.abs(snapshotPrice - transactionAmount) > 0.01 || !validQuotas) {
            await this.updateAsync(id, { status: 'VerificationUncertain', rejectionReason: 'CV package purchase details or server price/quota snapshot are missing or inconsistent.', updatedAt: new Date().toISOString() });
            throw new Error('Cannot approve CV package purchase: its server-verified package and price details are invalid.');
          }
          try {
            const user = await UserRepository.getByIdAsync(String(tx.userId));
            if (!user) throw new Error('The purchasing user account could not be found.');
            const updatedUser = await UserRepository.grantCvPackageEntitlementAsync(user.id, snapshot, String(tx.id));
            if (!updatedUser) throw new Error('The CV package entitlement could not be saved to the user account.');
            await this.updateAsync(id, {
              status: 'Success',
              cvPackageEntitlementGranted: true,
              verifiedAt: new Date().toISOString(),
              adminNote: note || 'CV package payment verified and quota package activated.'
            });
          } catch (packageErr: any) {
            await this.updateAsync(id, {
              status: 'VerificationUncertain',
              rejectionReason: packageErr?.message || 'CV package entitlement update is uncertain; manual reconciliation is required.',
              updatedAt: new Date().toISOString()
            });
            throw packageErr;
          }
        } else {

        const templateId = String(snapshot?.templateId || tx.cvTemplateId || '').trim();
        const templateName = String(snapshot?.templateName || '').trim();
        const snapshotPrice = Number(snapshot?.pricePkr);
        const transactionAmount = Number(tx.amount);
        if (!tx.userId || !templateId || !templateName ||
          !Number.isFinite(snapshotPrice) || snapshotPrice <= 0 ||
          !Number.isFinite(transactionAmount) || Math.abs(snapshotPrice - transactionAmount) > 0.01 ||
          String(tx.cvTemplateId || '') !== templateId) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: 'CV design purchase details or server price snapshot are missing or inconsistent.',
            updatedAt: new Date().toISOString()
          });
          throw new Error('Cannot approve CV design purchase: its server-verified design and price details are invalid.');
        }
        let user: any = null;
        try {
          user = await UserRepository.getByIdAsync(String(tx.userId));
          if (!user) throw new Error('The purchasing user account could not be found.');
          const updatedUser = await UserRepository.grantCvDesignEntitlementAsync(user.id, {
            templateId,
            templateName,
            transactionId: String(tx.id),
            amount: transactionAmount,
            purchasedAt: new Date().toISOString()
          });
          if (!updatedUser) throw new Error('The CV design entitlement could not be saved to the user account.');
          await this.updateAsync(id, {
            status: 'Success',
            cvEntitlementGranted: true,
            verifiedAt: new Date().toISOString(),
            adminNote: note || 'CV design payment verified and one-time design access granted.'
          });
        } catch (purchaseErr: any) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: purchaseErr?.message || 'CV design entitlement update is uncertain; manual reconciliation is required.',
            updatedAt: new Date().toISOString()
          });
          throw purchaseErr;
        }
        }
      } else if (tx.type === 'Job Posting Fee' || tx.type === 'Job Posting') {
        if (!tx.jobIdRef) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: 'Missing jobIdRef on Job Posting transaction.',
            updatedAt: new Date().toISOString()
          });
          throw new Error('Cannot approve Job Posting: transaction is missing jobIdRef.');
        }

        let approvedJob: any = null;
        try {
          approvedJob = await JobRepository.approvePending(String(tx.jobIdRef));
        } catch (jobErr: any) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: jobErr?.message || 'Job activation uncertain',
            updatedAt: new Date().toISOString()
          });
          throw jobErr;
        }

        if (!approvedJob) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: 'Failed to activate pending job.',
            updatedAt: new Date().toISOString()
          });
          throw new Error('Cannot approve Job Posting: failed to activate pending job.');
        }

        await this.updateAsync(id, {
          status: 'Success',
          verifiedAt: new Date().toISOString(),
          adminNote: note || 'Verified and approved by administrator'
        });
      } else if (tx.type === 'Ad Campaign Fee' || tx.type === 'Advertisement') {
        if (tx.adIdRef) {
          AdRepository.update(String(tx.adIdRef), {
            paymentStatus: 'Paid',
            approvalStatus: 'Approved',
            status: 'active'
          });
        }
        await this.updateAsync(id, {
          status: 'Success',
          verifiedAt: new Date().toISOString(),
          adminNote: note || 'Verified and approved by administrator'
        });
      } else {
        await this.updateAsync(id, {
          status: 'Pending',
          rejectionReason: `Unsupported transaction type "${tx.type}".`,
          updatedAt: new Date().toISOString()
        });
        throw new Error(`Cannot approve transaction: unsupported transaction type "${tx.type}".`);
      }
    } else {
      if ((tx.type === 'Ad Campaign Fee' || tx.type === 'Advertisement') && tx.adIdRef) {
        AdRepository.update(String(tx.adIdRef), {
          paymentStatus: 'Refunded',
          approvalStatus: 'Rejected',
          status: 'rejected'
        });
      }
      await this.updateAsync(id, {
        status: 'Failed',
        rejectionReason: reason || 'Payment proof verification rejected.',
        updatedAt: new Date().toISOString()
      });
    }

    return await this.getByIdAsync(id);
  }

  static async getUserWalletAsync(userId: string): Promise<any> {
    const user = await UserRepository.getByIdAsync(userId);
    const balance = Number(user?.walletBalance || 0);
    const txs = await this.getAllAsync(userId);
    return {
      userId,
      balance,
      availableBalance: balance,
      escrowBalance: Number(user?.walletEscrowBalance || 0),
      transactions: txs
    };
  }
}
