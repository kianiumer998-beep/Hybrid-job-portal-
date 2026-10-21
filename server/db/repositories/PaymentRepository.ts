import { Database } from '../database';
import { UserRepository } from './UserRepository';
import { JobRepository } from './JobRepository';
import { AuditRepository } from './AuditRepository';
import { AdRepository } from './AdRepository';
import { PricingRepository } from './PricingRepository';
import { getMongoDb, isMongoConfigured } from '../mongodb';

const activeCompensationLocks = new Set<string>();

export type CompensationStatusState =
  | 'Compensating'
  | 'Compensated'
  | 'CompensationUncertain';

export type DepositVerificationState =
  | 'Crediting'
  | 'Completed'
  | 'CreditUncertain';

async function getTransactionsCollection() {
  const db = await getMongoDb();
  return db.collection('transactions');
}

async function ensureTransactionIndexes() {
  if (!isMongoConfigured()) return;
  try {
    const coll = await getTransactionsCollection();
    await coll.createIndex({ transactionId: 1 }, { unique: true, sparse: true });
    await coll.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
    console.log('[PaymentRepository] MongoDB unique indexes verified successfully on transactions collection.');
  } catch (err: any) {
    console.warn('[PaymentRepository] Notice: Unique index creation warning on transactions collection:', err?.message || err);
  }
}

ensureTransactionIndexes().catch(() => {});

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
    let txs = Database.getTransactions();
    if (userId) {
      txs = txs.filter(t => t && String(t.userId || '') === String(userId));
    }
    return txs;
  }

  static async getAllAsync(userId?: string): Promise<any[]> {
    if (isMongoConfigured()) {
      try {
        const coll = await getTransactionsCollection();
        const query = userId ? { userId: String(userId) } : {};
        const docs = await coll.find(query).sort({ createdAt: -1 }).toArray();
        return (docs || []).map(d => {
          const { _id, ...safe } = d;
          return safe;
        });
      } catch (err: any) {
        throw new Error(`MongoDB transactions operation failed: ${err.message || err}`);
      }
    }
    return this.getAll(userId);
  }

  static getById(id: string): any | null {
    const txs = Database.getTransactions();
    return txs.find(t => t && String(t.id) === String(id)) || null;
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (!id) return null;
    if (isMongoConfigured()) {
      try {
        const coll = await getTransactionsCollection();
        const doc = await coll.findOne({ id: String(id) });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err: any) {
        throw new Error(`MongoDB transactions operation failed: ${err.message || err}`);
      }
    }
    return this.getById(id);
  }

  static findByIdempotencyKey(key: string): any | null {
    if (!key) return null;
    const txs = Database.getTransactions();
    return txs.find(t => t && String(t.idempotencyKey) === String(key)) || null;
  }

  static async findByIdempotencyKeyAsync(key: string): Promise<any | null> {
    if (!key) return null;
    if (isMongoConfigured()) {
      try {
        const coll = await getTransactionsCollection();
        const doc = await coll.findOne({ idempotencyKey: String(key) });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err: any) {
        throw new Error(`MongoDB transactions operation failed: ${err.message || err}`);
      }
    }
    return this.findByIdempotencyKey(key);
  }

  static findByTransactionId(tid: string): any | null {
    if (!tid) return null;
    const txs = Database.getTransactions();
    return txs.find(t => t && String(t.transactionId) === String(tid)) || null;
  }

  static async findByTransactionIdAsync(tid: string): Promise<any | null> {
    if (!tid) return null;
    if (isMongoConfigured()) {
      try {
        const coll = await getTransactionsCollection();
        const doc = await coll.findOne({ transactionId: String(tid) });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err: any) {
        throw new Error(`MongoDB transactions operation failed: ${err.message || err}`);
      }
    }
    return this.findByTransactionId(tid);
  }

  static create(txData: any): any {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous create is prohibited; use createAsync.');
    }
    return Database.addTransaction(txData);
  }

  static async createAsync(txData: any): Promise<any> {
    const id = txData?.id || `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { _id: _ignored, ...clean } = txData || {};
    const txToSave = {
      ...clean,
      id,
      createdAt: txData?.createdAt || new Date().toISOString(),
      updatedAt: txData?.updatedAt || new Date().toISOString()
    };
    if (isMongoConfigured()) {
      try {
        const coll = await getTransactionsCollection();
        await coll.insertOne({ ...txToSave });
        return txToSave;
      } catch (err: any) {
        throw new Error(`MongoDB transactions insert failed: ${err.message || err}`);
      }
    }
    return Database.addTransaction(txToSave);
  }

  static async updateAsync(id: string, updates: Record<string, any>): Promise<any | null> {
    const updatedAt = new Date().toISOString();
    const updatePayload = { ...updates, updatedAt };
    if (isMongoConfigured()) {
      try {
        const coll = await getTransactionsCollection();
        await coll.updateOne({ id: String(id) }, { $set: updatePayload });
        const doc = await coll.findOne({ id: String(id) });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err: any) {
        throw new Error(`MongoDB transactions update failed: ${err.message || err}`);
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

      if (originalAmount > 0) {
        await this.updateAsync(lockKey, {
          compensationStatus: 'Compensating' as CompensationStatusState,
          updatedAt: new Date().toISOString()
        });

        const persistedClaim = await this.getByIdAsync(lockKey);
        if (!persistedClaim || persistedClaim.compensationStatus !== 'Compensating') {
          throw new Error('Failed to persist durable compensation claim before wallet credit.');
        }

        let updatedUser: any = null;
        try {
          updatedUser = await UserRepository.creditWalletBalanceAsync(user.id, originalAmount);
        } catch (creditErr) {
          await this.updateAsync(lockKey, {
            originalStatus: tx.status,
            status: 'Pending',
            compensationStatus: 'CompensationUncertain' as CompensationStatusState,
            updatedAt: new Date().toISOString()
          });
          throw creditErr;
        }

        if (!updatedUser) {
          await this.updateAsync(lockKey, {
            compensationStatus: undefined,
            updatedAt: new Date().toISOString()
          });
          throw new Error('Failed to restore user wallet balance during Advertisement payment compensation.');
        }

        restoredBalance = Number(updatedUser.walletBalance);
        currentBal = restoredBalance - originalAmount;
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

      try {
        AuditRepository.add({
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
        });
      } catch {}

      return {
        compensated: true,
        alreadyCompensated: false,
        restoredAmount: originalAmount,
        transaction: updatedTx,
        refundReferenceId
      };
    } finally {
      activeCompensationLocks.delete(lockKey);
    }
  }

  static async verify(id: string, action: 'approve' | 'reject', note?: string, reason?: string): Promise<any | null> {
    if (isMongoConfigured()) {
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
        throw new Error(`Concurrency verification claim failed: ${err.message || err}`);
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
        
        const pricing = PricingRepository.get() || {};
        
        // Strict, non-inferential duration lookup
        const authoritativeDuration = Number(
          pricing.subscriptionDurations?.[planName]
        );

        if (!Number.isFinite(authoritativeDuration) || authoritativeDuration <= 0 || !Number.isInteger(authoritativeDuration)) {
          await this.updateAsync(id, {
            status: 'Pending',
            rejectionReason: `Invalid or missing authoritative server-side duration configuration for plan "${planName}".`,
            updatedAt: new Date().toISOString()
          });
          throw new Error(`Cannot approve Subscription: authoritative server-side duration configuration is missing or invalid for plan "${planName}".`);
        }
        const durationDays = authoritativeDuration;

        let updatedUser: any = null;
        try {
          updatedUser = await UserRepository.updateAsync(user.id, {
            membershipTier: planName,
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

        await this.updateAsync(id, {
          userId: user.id,
          status: 'Success',
          verifiedAt: new Date().toISOString(),
          adminNote: note || 'Verified and approved by administrator'
        });
      } else if (tx.type === 'Job Posting Fee') {
        if (!tx.jobIdRef) {
          await this.updateAsync(id, {
            status: 'VerificationUncertain',
            rejectionReason: 'Missing jobIdRef on Job Posting transaction.',
            updatedAt: new Date().toISOString()
          });
          throw new Error('Cannot approve Job Posting Fee: transaction is missing jobIdRef.');
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
          throw new Error('Cannot approve Job Posting Fee: failed to activate pending job.');
        }

        await this.updateAsync(id, {
          status: 'Success',
          verifiedAt: new Date().toISOString(),
          adminNote: note || 'Verified and approved by administrator'
        });
      } else if (tx.type === 'Ad Campaign Fee') {
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
      }
    } else {
      if (tx.type === 'Ad Campaign Fee' && tx.adIdRef) {
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
      transactions: txs
    };
  }
}
