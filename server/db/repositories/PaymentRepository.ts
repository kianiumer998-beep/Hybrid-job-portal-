import { Database } from '../database';
import { getTransactionsCollection, isMongoConfigured } from '../mongodb';

export interface WalletBalanceSummary {
  userId: string;
  walletBalance: number;
  currency: string;
  totalDeposited: number;
  totalSpent: number;
  pendingWithdrawals: number;
}

export class PaymentRepository {
  /**
   * Fetch transactions with optional filtering by user, type, status, or pagination.
   */
  static getAll(userId?: string, options?: { type?: string; status?: string }): any[] {
    let txs = Database.getTransactions();
    if (userId) {
      txs = txs.filter(t => t.userId === userId);
    }
    if (options?.type) {
      txs = txs.filter(t => t.type === options.type);
    }
    if (options?.status) {
      txs = txs.filter(t => t.status === options.status);
    }
    return txs;
  }

  static async getAllAsync(userId?: string, options?: { type?: string; status?: string }): Promise<any[]> {
    if (isMongoConfigured()) {
      try {
        const coll = await getTransactionsCollection();
        const query: Record<string, any> = {};
        if (userId) query.userId = userId;
        if (options?.type) query.type = options.type;
        if (options?.status) query.status = options.status;

        const docs = await coll.find(query).sort({ createdAt: -1, dateTime: -1 }).toArray();
        if (docs && docs.length > 0) {
          return docs.map(d => {
            const { _id, ...rest } = d;
            return rest;
          });
        }
      } catch (err: any) {
        console.warn('[MongoDB] getAllAsync transactions error, falling back:', err.message);
      }
    }
    return this.getAll(userId, options);
  }

  static getById(id: string): any | null {
    const txs = Database.getTransactions();
    return txs.find(t => t.id === id) || null;
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (isMongoConfigured()) {
      try {
        const coll = await getTransactionsCollection();
        const doc = await coll.findOne({ id });
        if (doc) {
          const { _id, ...rest } = doc;
          return rest;
        }
      } catch (err: any) {
        console.warn('[MongoDB] getByIdAsync transaction error:', err.message);
      }
    }
    return this.getById(id);
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

  /**
   * Retrieves authoritative user wallet balance & historical totals.
   */
  static getUserWallet(userId: string): WalletBalanceSummary {
    const user = Database.getUserById(userId);
    const balance = Number(user?.walletBalance || 0);

    const userTxs = Database.getTransactions().filter(t => t.userId === userId);
    
    let totalDeposited = 0;
    let totalSpent = 0;
    let pendingWithdrawals = 0;

    userTxs.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.status === 'Success') {
        if (t.type === 'Wallet Deposit') {
          totalDeposited += amt;
        } else if (['Job Posting', 'Job Posting Fee', 'Advertisement', 'Ad Click Billing', 'Ad Impression Billing', 'Subscription', 'Wallet Withdrawal'].includes(t.type)) {
          totalSpent += amt;
        }
      } else if (t.status === 'Pending' && t.type === 'Wallet Withdrawal') {
        pendingWithdrawals += amt;
      }
    });

    return {
      userId,
      walletBalance: balance,
      currency: 'PKR',
      totalDeposited,
      totalSpent,
      pendingWithdrawals
    };
  }

  /**
   * Atomic Server-Side Debit from User Wallet with Ledger Recording.
   * Throws if insufficient balance to prevent negative balances.
   */
  static debitWallet(
    userId: string,
    amount: number,
    type: string,
    description: string,
    meta?: Record<string, any>
  ): { success: boolean; newBalance: number; transaction: any } {
    if (amount <= 0) {
      throw new Error('Debit amount must be strictly greater than zero.');
    }

    const user = Database.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    const currentBal = Number(user.walletBalance || 0);
    if (currentBal < amount) {
      throw new Error(`Insufficient wallet balance. Available: ${currentBal} PKR, Required: ${amount} PKR.`);
    }

    const newBalance = currentBal - amount;
    Database.updateUser(userId, { walletBalance: newBalance });

    const tid = `TXN-DEBIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const tx = Database.addTransaction({
      amount,
      currency: 'PKR',
      type,
      status: 'Success',
      paymentMethod: 'Wallet Balance',
      transactionId: tid,
      userId,
      userName: user.name || 'Member',
      userEmail: user.email,
      proofNote: description,
      verifiedAt: new Date().toISOString(),
      ...(meta || {})
    });

    this.syncMongoTx(tx);
    return { success: true, newBalance, transaction: tx };
  }

  /**
   * Atomic Server-Side Credit to User Wallet with Ledger Recording.
   */
  static creditWallet(
    userId: string,
    amount: number,
    type: string,
    description: string,
    meta?: Record<string, any>
  ): { success: boolean; newBalance: number; transaction: any } {
    if (amount <= 0) {
      throw new Error('Credit amount must be strictly greater than zero.');
    }

    const user = Database.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    const currentBal = Number(user.walletBalance || 0);
    const newBalance = currentBal + amount;
    Database.updateUser(userId, { walletBalance: newBalance });

    const tid = `TXN-CREDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const tx = Database.addTransaction({
      amount,
      currency: 'PKR',
      type,
      status: 'Success',
      paymentMethod: meta?.paymentMethod || 'System Adjustment',
      transactionId: tid,
      userId,
      userName: user.name || 'Member',
      userEmail: user.email,
      proofNote: description,
      verifiedAt: new Date().toISOString(),
      ...(meta || {})
    });

    this.syncMongoTx(tx);
    return { success: true, newBalance, transaction: tx };
  }

  /**
   * Creates a user withdrawal request. Locks the funds immediately from available wallet balance.
   */
  static requestWithdrawal(
    userId: string,
    data: {
      amount: number;
      paymentMethod: string;
      senderPhoneOrAccount: string;
      senderName: string;
      proofNote?: string;
    }
  ): any {
    const { amount, paymentMethod, senderPhoneOrAccount, senderName, proofNote } = data;

    if (!amount || amount <= 0) {
      throw new Error('Withdrawal amount must be a positive number.');
    }
    if (!paymentMethod || !senderPhoneOrAccount) {
      throw new Error('Payout method and recipient account details are required.');
    }

    const user = Database.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    const currentBal = Number(user.walletBalance || 0);
    if (currentBal < amount) {
      throw new Error(`Insufficient funds for withdrawal. Available: ${currentBal} PKR, Requested: ${amount} PKR.`);
    }

    // Lock/deduct requested amount immediately
    Database.updateUser(userId, { walletBalance: currentBal - amount });

    const tid = `WD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const tx = Database.addTransaction({
      amount,
      currency: 'PKR',
      type: 'Wallet Withdrawal',
      status: 'Pending',
      paymentMethod,
      senderPhoneOrAccount,
      senderName: senderName || user.name,
      transactionId: tid,
      userId,
      userName: user.name,
      userEmail: user.email,
      proofNote: proofNote || 'Withdrawal payout requested by user',
      createdAt: new Date().toISOString()
    });

    this.syncMongoTx(tx);
    return tx;
  }

  /**
   * Admin processes withdrawal request.
   * If approved: records payout reference & receipt.
   * If rejected: automatically refunds the debited amount back to user's wallet!
   */
  static processWithdrawal(
    id: string,
    action: 'approve' | 'reject',
    details: { payoutRef?: string; proofSlipUrl?: string; note?: string; reason?: string }
  ): any | null {
    const txs = Database.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const tx = txs[idx];
    if (tx.type !== 'Wallet Withdrawal') {
      throw new Error('Only transactions of type "Wallet Withdrawal" can be processed with this method.');
    }
    if (tx.status !== 'Pending') {
      throw new Error(`Withdrawal has already been marked as ${tx.status}.`);
    }

    if (action === 'approve') {
      tx.status = 'Success';
      tx.verifiedAt = new Date().toISOString();
      tx.adminNote = details.note || 'Withdrawal approved and disbursed.';
      tx.payoutReference = details.payoutRef;
      tx.proofScreenshotUrl = details.proofSlipUrl || tx.proofScreenshotUrl;
    } else {
      tx.status = 'Failed';
      tx.rejectionReason = details.reason || 'Withdrawal request rejected by administrator.';
      tx.adminNote = details.note;

      // AUTOMATIC REFUND: Restore the user's balance
      if (tx.userId) {
        const user = Database.getUserById(tx.userId);
        if (user) {
          const restoredBal = Number(user.walletBalance || 0) + Number(tx.amount || 0);
          Database.updateUser(user.id, { walletBalance: restoredBal });

          // Record explicit refund ledger entry
          Database.addTransaction({
            amount: tx.amount,
            currency: tx.currency || 'PKR',
            type: 'Refund',
            status: 'Success',
            paymentMethod: 'System Refund',
            transactionId: `REF-${Date.now().toString(36).toUpperCase()}`,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            proofNote: `Refund for rejected withdrawal ${tx.transactionId || tx.id}: ${tx.rejectionReason}`,
            verifiedAt: new Date().toISOString()
          });
        }
      }
    }

    tx.updatedAt = new Date().toISOString();
    Database.saveTransactions(txs);
    this.syncMongoTx(tx);
    return tx;
  }

  static create(txData: any): any {
    const tx = Database.addTransaction(txData);
    this.syncMongoTx(tx);
    return tx;
  }

  static verify(id: string, action: 'approve' | 'reject', note?: string, reason?: string): any | null {
    const txs = Database.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const tx = txs[idx];
    if (action === 'approve') {
      tx.status = 'Success';
      tx.verifiedAt = new Date().toISOString();
      tx.adminNote = note || 'Verified and approved by administrator';

      // Credit wallet or activate features if applicable
      if (tx.type === 'Wallet Deposit' && tx.userId) {
        const user = Database.getUserById(tx.userId);
        if (user) {
          const currentBal = Number(user.walletBalance || 0);
          Database.updateUser(user.id, { walletBalance: currentBal + Number(tx.amount || 0) });
        }
      } else if (tx.type === 'Subscription' && tx.userId) {
        const user = Database.getUserById(tx.userId);
        if (user) {
          Database.updateUser(user.id, {
            membershipTier: tx.plan || 'Pro Alerts',
            membershipStatus: 'Active',
            subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          });
        }
      }
    } else {
      tx.status = 'Failed';
      tx.rejectionReason = reason || 'Payment proof verification rejected.';
    }

    tx.updatedAt = new Date().toISOString();
    Database.saveTransactions(txs);
    this.syncMongoTx(tx);
    return tx;
  }

  private static syncMongoTx(tx: any): void {
    if (!isMongoConfigured()) return;
    getTransactionsCollection()
      .then(coll => {
        coll.updateOne(
          { id: tx.id },
          { $set: tx },
          { upsert: true }
        ).catch(err => console.warn('[MongoDB] Sync Tx notice:', err.message));
      })
      .catch(() => {});
  }
}

