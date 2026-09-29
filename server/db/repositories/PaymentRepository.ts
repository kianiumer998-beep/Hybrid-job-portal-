import { Database } from '../database';
import { UserRepository } from './UserRepository';
import { JobRepository } from './JobRepository';
import { AuditRepository } from './AuditRepository';

const activeCompensationLocks = new Set<string>();

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
  static getAll(userId?: string): any[] {
    let txs = Database.getTransactions();
    if (userId) {
      txs = txs.filter(t => t.userId === userId);
    }
    return txs;
  }

  static getById(id: string): any | null {
    const txs = Database.getTransactions();
    return txs.find(t => t.id === id) || null;
  }

  static findByIdempotencyKey(key: string): any | null {
    if (!key) return null;
    const txs = Database.getTransactions();
    return txs.find(t => t.idempotencyKey === key) || null;
  }

  static findByTransactionId(tid: string): any | null {
    if (!tid) return null;
    const txs = Database.getTransactions();
    return txs.find(t => t.transactionId === tid) || null;
  }

  static create(txData: any): any {
    return Database.addTransaction(txData);
  }

  static linkAdvertisement(txId: string, adId: string, adTitle?: string): any | null {
    if (!txId || !adId) return null;
    const txs = Database.getTransactions();
    const idx = txs.findIndex((t: any) => t && String(t.id) === String(txId));
    if (idx === -1) return null;

    txs[idx].adIdRef = adId;
    if (adTitle) {
      txs[idx].adTitleRef = adTitle;
      if (!txs[idx].jobTitleRef) {
        txs[idx].jobTitleRef = adTitle;
      }
    }
    txs[idx].updatedAt = new Date().toISOString();
    Database.saveTransactions(txs);
    return txs[idx];
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
      this.getById(lookupKey) ||
      this.findByTransactionId(lookupKey) ||
      (options?.idempotencyKey ? this.findByIdempotencyKey(options.idempotencyKey) : null);

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
        transaction: this.getById(lockKey) || initialTx,
        reason: 'Compensation is already in progress for this transaction.'
      };
    }

    activeCompensationLocks.add(lockKey);
    try {
      const txs = Database.getTransactions();
      const idx = txs.findIndex((t: any) => t && String(t.id) === lockKey);
      if (idx === -1) {
        return {
          compensated: false,
          alreadyCompensated: false,
          restoredAmount: 0,
          transaction: null,
          reason: 'Original Advertisement transaction not found.'
        };
      }

      const tx = txs[idx];

      // 1. Verify ownership before any state inspection or mutation
      const authUserId = String(options?.authenticatedUserId || '').trim();
      if (!authUserId) {
        throw new Error('Authentication required to compensate advertisement transaction.');
      }
      if (!options?.isAdmin && String(tx.userId || '') !== authUserId) {
        throw new Error('Forbidden: Payment transaction does not belong to the authenticated user.');
      }

      // 2. Verify transaction is an Advertisement Wallet Balance transaction
      if (tx.type !== 'Advertisement' || tx.paymentMethod !== 'Wallet Balance') {
        return {
          compensated: false,
          alreadyCompensated: false,
          restoredAmount: 0,
          transaction: tx,
          reason: 'Only Advertisement Wallet Balance transactions are eligible for automatic failure compensation.'
        };
      }

      // 3. Idempotency: prevent double refund if already compensated
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

      // 4. Ensure no advertisement campaign was actually created and linked to this transaction
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

      // 5. Only compensate transactions that actually succeeded and deducted the wallet
      if (tx.status !== 'Success') {
        return {
          compensated: false,
          alreadyCompensated: false,
          restoredAmount: 0,
          transaction: tx,
          reason: `Transaction status is ${tx.status}; no wallet deduction to compensate.`
        };
      }

      // 6. Use authoritative original transaction amount (never client-supplied amount)
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
      const currentBal = Number.isFinite(rawCurrentBal) && rawCurrentBal >= 0 ? rawCurrentBal : 0;
      const restoredBalance = currentBal + originalAmount;

      if (originalAmount > 0) {
        const updatedUser = await UserRepository.updateAsync(user.id, {
          walletBalance: restoredBalance
        });
        if (!updatedUser) {
          throw new Error('Failed to restore user wallet balance during Advertisement payment compensation.');
        }
      }

      const compensatedAt = new Date().toISOString();
      const refundReferenceId = `CMP-${tx.transactionId || tx.id}`;
      const effectiveReason =
        options?.failureReason || 'Advertisement campaign creation failed after wallet deduction.';

      tx.originalStatus = tx.status;
      tx.status = 'Refunded';
      tx.compensated = true;
      tx.refunded = true;
      tx.compensationStatus = 'Compensated';
      tx.originalChargedAmount = originalAmount;
      tx.refundedAmount = originalAmount;
      tx.compensatedAt = compensatedAt;
      tx.refundedAt = compensatedAt;
      tx.refundReferenceId = refundReferenceId;
      tx.compensationReason = effectiveReason;
      tx.compensationBalanceBefore = currentBal;
      tx.compensationBalanceAfter = restoredBalance;
      tx.compensationMetadata = {
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
      };
      tx.adminNote = `Wallet payment of ${originalAmount} ${tx.currency || 'PKR'} automatically restored due to campaign creation failure (${effectiveReason}). Ref: ${refundReferenceId}`;
      tx.updatedAt = compensatedAt;

      txs[idx] = tx;
      Database.saveTransactions(txs);

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
        transaction: tx,
        refundReferenceId
      };
    } finally {
      activeCompensationLocks.delete(lockKey);
    }
  }

  static async verify(id: string, action: 'approve' | 'reject', note?: string, reason?: string): Promise<any | null> {
    const txs = Database.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const tx = txs[idx];
    if (tx.status !== 'Pending') {
      if (tx.status === 'Success' && action === 'approve') {
        return tx;
      }
      if (tx.status === 'Failed' && action === 'reject') {
        return tx;
      }
      throw new Error(`Transaction is already ${tx.status} and cannot be ${action === 'approve' ? 'approved' : 'rejected'}.`);
    }

    if (action === 'approve') {
      if (tx.paymentMethod === 'Wallet Balance') {
        throw new Error('Wallet Balance transactions cannot be manually approved.');
      }

      // Credit wallet or activate features if applicable
      if (tx.type === 'Wallet Deposit') {
        if (!tx.userId) {
          throw new Error('Cannot approve Wallet Deposit: transaction is missing userId.');
        }

        const depositAmount = Number(tx.amount);
        if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
          throw new Error('Cannot approve Wallet Deposit: invalid deposit amount.');
        }

        const user = await UserRepository.getByIdAsync(tx.userId);
        if (!user) {
          throw new Error('Cannot approve Wallet Deposit: target user not found.');
        }

        const rawCurrentBal = Number(user.walletBalance || 0);
        const currentBal =
          Number.isFinite(rawCurrentBal) && rawCurrentBal >= 0
            ? rawCurrentBal
            : 0;

        const updatedUser = await UserRepository.updateAsync(user.id, {
          walletBalance: currentBal + depositAmount
        });

        if (!updatedUser) {
          throw new Error('Cannot approve Wallet Deposit: failed to update user wallet balance.');
        }
      } else if (tx.type === 'Subscription') {
        if (!tx.userId) {
          throw new Error('Cannot approve Subscription: transaction is missing userId.');
        }

        const user = await UserRepository.getByIdAsync(tx.userId);
        if (!user) {
          throw new Error('Cannot approve Subscription: target user not found.');
        }

        const updatedUser = await UserRepository.updateAsync(user.id, {
          membershipTier: tx.plan || 'Pro Alerts',
          membershipStatus: 'Active',
          subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        if (!updatedUser) {
          throw new Error('Cannot approve Subscription: failed to activate user membership.');
        }
      } else if (tx.type === 'Job Posting') {
        if (!tx.jobIdRef) {
          throw new Error('Cannot approve Job Posting: transaction is missing jobIdRef.');
        }

        const approvedJob = await JobRepository.approvePending(String(tx.jobIdRef));
        if (!approvedJob) {
          throw new Error('Cannot approve Job Posting: failed to activate pending job.');
        }
      }

      tx.status = 'Success';
      tx.verifiedAt = new Date().toISOString();
      tx.adminNote = note || 'Verified and approved by administrator';
    } else {
      tx.status = 'Failed';
      tx.rejectionReason = reason || 'Payment proof verification rejected.';
    }

    tx.updatedAt = new Date().toISOString();
    Database.saveTransactions(txs);
    return tx;
  }

  static async getUserWalletAsync(userId: string): Promise<any> {
    const user = await UserRepository.getByIdAsync(userId);
    const balance = Number(user?.walletBalance || 0);
    const txs = this.getAll(userId);
    return {
      userId,
      balance,
      transactions: txs
    };
  }
}
