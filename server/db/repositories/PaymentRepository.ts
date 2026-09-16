import { Database } from '../database';
import { getTransactionsCollection, getUsersCollection, isMongoConfigured, getMongoClient } from '../mongodb';

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
      const coll = await getTransactionsCollection();
      const query: Record<string, any> = {};
      if (userId) query.userId = userId;
      if (options?.type) query.type = options.type;
      if (options?.status) query.status = options.status;

      const docs = await coll.find(query).sort({ createdAt: -1, dateTime: -1 }).toArray();
      return (docs || []).map(d => {
        const { _id, ...rest } = d;
        return rest;
      });
    }
    return this.getAll(userId, options);
  }

  static getById(id: string): any | null {
    const txs = Database.getTransactions();
    return txs.find(t => t.id === id) || null;
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (isMongoConfigured()) {
      const coll = await getTransactionsCollection();
      const doc = await coll.findOne({ id });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    }
    return this.getById(id);
  }

  static findByIdempotencyKey(key: string): any | null {
    if (!key) return null;
    const txs = Database.getTransactions();
    return txs.find(t => t.idempotencyKey === key) || null;
  }

  static async findByIdempotencyKeyAsync(key: string): Promise<any | null> {
    if (!key) return null;
    if (isMongoConfigured()) {
      const coll = await getTransactionsCollection();
      const doc = await coll.findOne({ idempotencyKey: key });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    }
    return this.findByIdempotencyKey(key);
  }

  static findByTransactionId(tid: string): any | null {
    if (!tid) return null;
    const txs = Database.getTransactions();
    return txs.find(t => t.transactionId === tid) || null;
  }

  static async findByTransactionIdAsync(tid: string): Promise<any | null> {
    if (!tid) return null;
    if (isMongoConfigured()) {
      const coll = await getTransactionsCollection();
      const doc = await coll.findOne({ transactionId: tid });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    }
    return this.findByTransactionId(tid);
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

  static async getUserWalletAsync(userId: string): Promise<WalletBalanceSummary> {
    if (isMongoConfigured()) {
      const userColl = await getUsersCollection();
      const txColl = await getTransactionsCollection();

      const user = await userColl.findOne({ id: userId });
      const balance = Number(user?.walletBalance || 0);

      const userTxs = await txColl.find({ userId }).toArray();
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
    return this.getUserWallet(userId);
  }

  /**
   * Atomic Server-Side Debit from User Wallet with Ledger Recording.
   * Throws if insufficient balance to prevent negative balances.
   * Stores balanceBefore and balanceAfter.
   * Checks idempotencyKey if supplied to prevent double deduction.
   */
  static async debitWalletAsync(
    userId: string,
    amount: number,
    type: string,
    description: string,
    meta?: Record<string, any>,
    idempotencyKey?: string
  ): Promise<{ success: boolean; newBalance: number; transaction: any }> {
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Debit amount must be strictly greater than zero.');
    }

    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKeyAsync(idempotencyKey);
      if (existing) {
        return {
          success: true,
          newBalance: existing.balanceAfter !== undefined
            ? existing.balanceAfter
            : (await this.getUserWalletAsync(userId)).walletBalance,
          transaction: existing
        };
      }
    }

    if (isMongoConfigured()) {
      const client = await getMongoClient();
      const userColl = await getUsersCollection();
      const txColl = await getTransactionsCollection();
      const session = client.startSession();

      let balanceBefore = 0;
      let balanceAfter = 0;
      let tx: any = null;

      try {
        await session.withTransaction(async () => {
          const user = await userColl.findOne({ id: userId }, { session });
          if (!user) {
            throw new Error(`User ${userId} not found.`);
          }

          balanceBefore = Number(user.walletBalance || 0);
          if (balanceBefore < amount) {
            throw new Error(`Insufficient wallet balance. Available: ${balanceBefore} PKR, Required: ${amount} PKR.`);
          }

          const updatedUser = await userColl.findOneAndUpdate(
            { id: userId, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount }, $set: { updatedAt: new Date().toISOString() } },
            { returnDocument: 'after', session }
          );

          if (!updatedUser) {
            throw new Error(`Insufficient wallet balance or concurrent modification. Required: ${amount} PKR.`);
          }

          balanceAfter = balanceBefore - amount;
          const tid = `TXN-DEBIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          tx = {
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            amount,
            currency: 'PKR',
            type,
            status: 'Success',
            paymentMethod: 'Wallet Balance',
            transactionId: tid,
            idempotencyKey: idempotencyKey || undefined,
            userId,
            userName: user.name || 'Member',
            userEmail: user.email,
            proofNote: description,
            balanceBefore,
            balanceAfter,
            verifiedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...(meta || {})
          };

          await txColl.insertOne({ ...tx }, { session });
        });
      } catch (sessionErr: any) {
        if (sessionErr?.message?.includes('replica set') || sessionErr?.message?.includes('Transaction numbers are only allowed')) {
          const user = await userColl.findOne({ id: userId });
          if (!user) throw new Error(`User ${userId} not found.`);
          balanceBefore = Number(user.walletBalance || 0);
          if (balanceBefore < amount) {
            throw new Error(`Insufficient wallet balance. Available: ${balanceBefore} PKR, Required: ${amount} PKR.`);
          }
          const updatedUser = await userColl.findOneAndUpdate(
            { id: userId, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount }, $set: { updatedAt: new Date().toISOString() } },
            { returnDocument: 'after' }
          );
          if (!updatedUser) {
            throw new Error(`Insufficient wallet balance or concurrent modification. Required: ${amount} PKR.`);
          }
          balanceAfter = balanceBefore - amount;
          const tid = `TXN-DEBIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          tx = {
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            amount,
            currency: 'PKR',
            type,
            status: 'Success',
            paymentMethod: 'Wallet Balance',
            transactionId: tid,
            idempotencyKey: idempotencyKey || undefined,
            userId,
            userName: user.name || 'Member',
            userEmail: user.email,
            proofNote: description,
            balanceBefore,
            balanceAfter,
            verifiedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...(meta || {})
          };
          try {
            await txColl.insertOne({ ...tx });
          } catch (txInsertErr) {
            await userColl.updateOne({ id: userId }, { $inc: { walletBalance: amount } }).catch(() => {});
            throw txInsertErr;
          }
        } else {
          throw sessionErr;
        }
      } finally {
        await session.endSession().catch(() => {});
      }

      try {
        Database.updateUser(userId, { walletBalance: balanceAfter });
        Database.addTransaction(tx);
      } catch {}

      return { success: true, newBalance: balanceAfter, transaction: tx };
    }

    // JSON / Development fallback
    const user = Database.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    const currentBal = Number(user.walletBalance || 0);
    if (currentBal < amount) {
      throw new Error(`Insufficient wallet balance. Available: ${currentBal} PKR, Required: ${amount} PKR.`);
    }

    const balanceBefore = currentBal;
    const balanceAfter = currentBal - amount;
    Database.updateUser(userId, { walletBalance: balanceAfter });

    const tid = `TXN-DEBIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const tx = Database.addTransaction({
      amount,
      currency: 'PKR',
      type,
      status: 'Success',
      paymentMethod: 'Wallet Balance',
      transactionId: tid,
      idempotencyKey: idempotencyKey || undefined,
      userId,
      userName: user.name || 'Member',
      userEmail: user.email,
      proofNote: description,
      balanceBefore,
      balanceAfter,
      verifiedAt: new Date().toISOString(),
      ...(meta || {})
    });

    return { success: true, newBalance: balanceAfter, transaction: tx };
  }

  static debitWallet(
    userId: string,
    amount: number,
    type: string,
    description: string,
    meta?: Record<string, any>,
    idempotencyKey?: string
  ): { success: boolean; newBalance: number; transaction: any } {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous debitWallet is prohibited to ensure authoritative persistence; use debitWalletAsync.');
    }
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
    const balanceBefore = currentBal;
    const balanceAfter = currentBal - amount;
    Database.updateUser(userId, { walletBalance: balanceAfter });
    const tid = `TXN-DEBIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const tx = Database.addTransaction({
      amount,
      currency: 'PKR',
      type,
      status: 'Success',
      paymentMethod: 'Wallet Balance',
      transactionId: tid,
      idempotencyKey: idempotencyKey || undefined,
      userId,
      userName: user.name || 'Member',
      userEmail: user.email,
      proofNote: description,
      balanceBefore,
      balanceAfter,
      verifiedAt: new Date().toISOString(),
      ...(meta || {})
    });
    return { success: true, newBalance: balanceAfter, transaction: tx };
  }

  /**
   * Atomic Server-Side Credit to User Wallet with Ledger Recording.
   */
  static async creditWalletAsync(
    userId: string,
    amount: number,
    type: string,
    description: string,
    meta?: Record<string, any>,
    idempotencyKey?: string
  ): Promise<{ success: boolean; newBalance: number; transaction: any }> {
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Credit amount must be strictly greater than zero.');
    }

    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKeyAsync(idempotencyKey);
      if (existing) {
        return {
          success: true,
          newBalance: existing.balanceAfter !== undefined
            ? existing.balanceAfter
            : (await this.getUserWalletAsync(userId)).walletBalance,
          transaction: existing
        };
      }
    }

    if (isMongoConfigured()) {
      const client = await getMongoClient();
      const userColl = await getUsersCollection();
      const txColl = await getTransactionsCollection();
      const session = client.startSession();

      let balanceBefore = 0;
      let balanceAfter = 0;
      let tx: any = null;

      try {
        await session.withTransaction(async () => {
          const user = await userColl.findOne({ id: userId }, { session });
          if (!user) {
            throw new Error(`User ${userId} not found.`);
          }

          balanceBefore = Number(user.walletBalance || 0);
          balanceAfter = balanceBefore + amount;

          await userColl.findOneAndUpdate(
            { id: userId },
            { $inc: { walletBalance: amount }, $set: { updatedAt: new Date().toISOString() } },
            { returnDocument: 'after', session }
          );

          const tid = `TXN-CREDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          tx = {
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            amount,
            currency: 'PKR',
            type,
            status: 'Success',
            paymentMethod: meta?.paymentMethod || 'System Adjustment',
            transactionId: tid,
            idempotencyKey: idempotencyKey || undefined,
            userId,
            userName: user.name || 'Member',
            userEmail: user.email,
            proofNote: description,
            balanceBefore,
            balanceAfter,
            verifiedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...(meta || {})
          };

          await txColl.insertOne({ ...tx }, { session });
        });
      } catch (sessionErr: any) {
        if (sessionErr?.message?.includes('replica set') || sessionErr?.message?.includes('Transaction numbers are only allowed')) {
          const user = await userColl.findOne({ id: userId });
          if (!user) throw new Error(`User ${userId} not found.`);
          balanceBefore = Number(user.walletBalance || 0);
          balanceAfter = balanceBefore + amount;
          await userColl.findOneAndUpdate(
            { id: userId },
            { $inc: { walletBalance: amount }, $set: { updatedAt: new Date().toISOString() } },
            { returnDocument: 'after' }
          );
          const tid = `TXN-CREDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          tx = {
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            amount,
            currency: 'PKR',
            type,
            status: 'Success',
            paymentMethod: meta?.paymentMethod || 'System Adjustment',
            transactionId: tid,
            idempotencyKey: idempotencyKey || undefined,
            userId,
            userName: user.name || 'Member',
            userEmail: user.email,
            proofNote: description,
            balanceBefore,
            balanceAfter,
            verifiedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...(meta || {})
          };
          try {
            await txColl.insertOne({ ...tx });
          } catch (txInsertErr) {
            await userColl.updateOne({ id: userId }, { $inc: { walletBalance: -amount } }).catch(() => {});
            throw txInsertErr;
          }
        } else {
          throw sessionErr;
        }
      } finally {
        await session.endSession().catch(() => {});
      }

      try {
        Database.updateUser(userId, { walletBalance: balanceAfter });
        Database.addTransaction(tx);
      } catch {}

      return { success: true, newBalance: balanceAfter, transaction: tx };
    }

    // JSON / Development fallback
    const user = Database.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    const currentBal = Number(user.walletBalance || 0);
    const balanceBefore = currentBal;
    const balanceAfter = currentBal + amount;
    Database.updateUser(userId, { walletBalance: balanceAfter });

    const tid = `TXN-CREDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const tx = Database.addTransaction({
      amount,
      currency: 'PKR',
      type,
      status: 'Success',
      paymentMethod: meta?.paymentMethod || 'System Adjustment',
      transactionId: tid,
      idempotencyKey: idempotencyKey || undefined,
      userId,
      userName: user.name || 'Member',
      userEmail: user.email,
      proofNote: description,
      balanceBefore,
      balanceAfter,
      verifiedAt: new Date().toISOString(),
      ...(meta || {})
    });

    return { success: true, newBalance: balanceAfter, transaction: tx };
  }

  static creditWallet(
    userId: string,
    amount: number,
    type: string,
    description: string,
    meta?: Record<string, any>
  ): { success: boolean; newBalance: number; transaction: any } {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous creditWallet is prohibited to ensure authoritative persistence; use creditWalletAsync.');
    }
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
      balanceBefore: currentBal,
      balanceAfter: newBalance,
      verifiedAt: new Date().toISOString(),
      ...(meta || {})
    });
    return { success: true, newBalance, transaction: tx };
  }

  /**
   * Creates a user withdrawal request. Locks the funds immediately from available wallet balance.
   */
  static async requestWithdrawalAsync(
    userId: string,
    data: {
      amount: number;
      paymentMethod: string;
      senderPhoneOrAccount: string;
      senderName: string;
      proofNote?: string;
    },
    idempotencyKey?: string
  ): Promise<any> {
    const { amount, paymentMethod, senderPhoneOrAccount, senderName, proofNote } = data;

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Withdrawal amount must be a positive number.');
    }
    if (!paymentMethod || !senderPhoneOrAccount) {
      throw new Error('Payout method and recipient account details are required.');
    }

    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKeyAsync(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    if (isMongoConfigured()) {
      const userColl = await getUsersCollection();
      const txColl = await getTransactionsCollection();

      const user = await userColl.findOne({ id: userId });
      if (!user) {
        throw new Error(`User ${userId} not found.`);
      }

      const balanceBefore = Number(user.walletBalance || 0);
      if (balanceBefore < amount) {
        throw new Error(`Insufficient funds for withdrawal. Available: ${balanceBefore} PKR, Requested: ${amount} PKR.`);
      }

      // Deduct/lock the requested amount atomically
      const updatedUser = await userColl.findOneAndUpdate(
        { id: userId, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount }, $set: { updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' }
      );

      if (!updatedUser) {
        throw new Error(`Insufficient funds for withdrawal. Available: ${balanceBefore} PKR, Requested: ${amount} PKR.`);
      }

      const balanceAfter = balanceBefore - amount;
      const tid = `WD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const tx: any = {
        id: `tx-wd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        amount,
        currency: 'PKR',
        type: 'Wallet Withdrawal',
        status: 'Pending',
        paymentMethod,
        senderPhoneOrAccount,
        senderName: senderName || user.name,
        transactionId: tid,
        idempotencyKey: idempotencyKey || undefined,
        userId,
        userName: user.name,
        userEmail: user.email,
        proofNote: proofNote || 'Withdrawal payout requested by user',
        balanceBefore,
        balanceAfter,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await txColl.insertOne({ ...tx });
      } catch (txInsertErr) {
        await userColl.updateOne({ id: userId }, { $inc: { walletBalance: amount } }).catch(() => {});
        throw txInsertErr;
      }

      try {
        Database.updateUser(userId, { walletBalance: balanceAfter });
        Database.addTransaction(tx);
      } catch {}

      return tx;
    }

    // JSON / Development fallback
    const user = Database.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    const currentBal = Number(user.walletBalance || 0);
    if (currentBal < amount) {
      throw new Error(`Insufficient funds for withdrawal. Available: ${currentBal} PKR, Requested: ${amount} PKR.`);
    }

    const balanceBefore = currentBal;
    const balanceAfter = currentBal - amount;
    Database.updateUser(userId, { walletBalance: balanceAfter });

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
      idempotencyKey: idempotencyKey || undefined,
      userId,
      userName: user.name,
      userEmail: user.email,
      proofNote: proofNote || 'Withdrawal payout requested by user',
      balanceBefore,
      balanceAfter,
      createdAt: new Date().toISOString()
    });

    return tx;
  }

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
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous requestWithdrawal is prohibited to ensure authoritative persistence; use requestWithdrawalAsync.');
    }
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
    const balanceBefore = currentBal;
    const balanceAfter = currentBal - amount;
    Database.updateUser(userId, { walletBalance: balanceAfter });
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
      balanceBefore,
      balanceAfter,
      createdAt: new Date().toISOString()
    });
    return tx;
  }

  /**
   * Admin processes withdrawal request.
   * If approved: records payout reference & receipt.
   * If rejected: automatically refunds the debited amount back to user's wallet!
   */
  static async processWithdrawalAsync(
    id: string,
    action: 'approve' | 'reject',
    details: { payoutRef?: string; proofSlipUrl?: string; note?: string; reason?: string }
  ): Promise<any | null> {
    if (isMongoConfigured()) {
      const txColl = await getTransactionsCollection();
      const userColl = await getUsersCollection();

      const tx = await txColl.findOne({ id });
      if (!tx) return null;

      if (tx.type !== 'Wallet Withdrawal') {
        throw new Error('Only transactions of type "Wallet Withdrawal" can be processed with this method.');
      }
      if (tx.status !== 'Pending') {
        throw new Error(`Withdrawal has already been marked as ${tx.status}.`);
      }

      if (action === 'approve') {
        const updatedTx = {
          ...tx,
          status: 'Success',
          verifiedAt: new Date().toISOString(),
          adminNote: details.note || 'Withdrawal approved and disbursed.',
          payoutReference: details.payoutRef,
          proofScreenshotUrl: details.proofSlipUrl || tx.proofScreenshotUrl,
          updatedAt: new Date().toISOString()
        };
        await txColl.updateOne({ id }, { $set: updatedTx });
        try {
          const txs = Database.getTransactions();
          const idx = txs.findIndex(t => t.id === id);
          if (idx !== -1) { txs[idx] = updatedTx; Database.saveTransactions(txs); }
        } catch {}
        const { _id, ...safe } = updatedTx;
        return safe;
      } else {
        const updatedTx = {
          ...tx,
          status: 'Failed',
          rejectionReason: details.reason || 'Withdrawal request rejected by administrator.',
          adminNote: details.note,
          updatedAt: new Date().toISOString()
        };
        await txColl.updateOne({ id }, { $set: updatedTx });

        // AUTOMATIC REFUND: Restore the user's balance
        if (tx.userId) {
          const user = await userColl.findOne({ id: tx.userId });
          if (user) {
            const balanceBefore = Number(user.walletBalance || 0);
            const balanceAfter = balanceBefore + Number(tx.amount || 0);
            await userColl.updateOne({ id: user.id }, { $inc: { walletBalance: Number(tx.amount || 0) } });

            const refundTx: any = {
              id: `tx-ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              amount: tx.amount,
              currency: tx.currency || 'PKR',
              type: 'Refund',
              status: 'Success',
              paymentMethod: 'System Refund',
              transactionId: `REF-${Date.now().toString(36).toUpperCase()}`,
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              proofNote: `Refund for rejected withdrawal ${tx.transactionId || tx.id}: ${updatedTx.rejectionReason}`,
              balanceBefore,
              balanceAfter,
              verifiedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await txColl.insertOne({ ...refundTx });

            try {
              Database.updateUser(user.id, { walletBalance: balanceAfter });
              Database.addTransaction(refundTx);
            } catch {}
          }
        }

        try {
          const txs = Database.getTransactions();
          const idx = txs.findIndex(t => t.id === id);
          if (idx !== -1) { txs[idx] = updatedTx; Database.saveTransactions(txs); }
        } catch {}

        const { _id, ...safe } = updatedTx;
        return safe;
      }
    }

    // JSON fallback
    return this.processWithdrawal(id, action, details);
  }

  static processWithdrawal(
    id: string,
    action: 'approve' | 'reject',
    details: { payoutRef?: string; proofSlipUrl?: string; note?: string; reason?: string }
  ): any | null {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous processWithdrawal is prohibited to ensure authoritative persistence; use processWithdrawalAsync.');
    }
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
          const balanceBefore = Number(user.walletBalance || 0);
          const balanceAfter = balanceBefore + Number(tx.amount || 0);
          Database.updateUser(user.id, { walletBalance: balanceAfter });

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
            balanceBefore,
            balanceAfter,
            verifiedAt: new Date().toISOString()
          });
        }
      }
    }

    tx.updatedAt = new Date().toISOString();
    Database.saveTransactions(txs);
    return tx;
  }

  static async createAsync(txData: any): Promise<any> {
    const id = txData.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const tx = {
      ...txData,
      id,
      createdAt: txData.createdAt || new Date().toISOString(),
      updatedAt: txData.updatedAt || new Date().toISOString()
    };

    if (isMongoConfigured()) {
      const coll = await getTransactionsCollection();
      await coll.insertOne({ ...tx });
      try { Database.addTransaction(tx); } catch {}
      return tx;
    }

    return Database.addTransaction(tx);
  }

  static create(txData: any): any {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous create is prohibited to ensure authoritative persistence; use createAsync.');
    }
    const tx = Database.addTransaction(txData);
    return tx;
  }

  static async verifyPaymentAsync(
    id: string,
    action: 'approve' | 'reject',
    note?: string,
    reason?: string
  ): Promise<any | null> {
    if (isMongoConfigured()) {
      const txColl = await getTransactionsCollection();
      const userColl = await getUsersCollection();

      const tx = await txColl.findOne({ id });
      if (!tx) return null;

      if (action === 'approve') {
        let balanceBefore: number | undefined;
        let balanceAfter: number | undefined;

        // Credit wallet if deposit
        if (tx.type === 'Wallet Deposit' && tx.userId) {
          const user = await userColl.findOne({ id: tx.userId });
          if (user) {
            balanceBefore = Number(user.walletBalance || 0);
            balanceAfter = balanceBefore + Number(tx.amount || 0);
            await userColl.updateOne({ id: user.id }, { $inc: { walletBalance: Number(tx.amount || 0) } });
            try { Database.updateUser(user.id, { walletBalance: balanceAfter }); } catch {}
          }
        } else if (tx.type === 'Subscription' && tx.userId) {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await userColl.updateOne({ id: tx.userId }, {
            $set: {
              membershipTier: tx.plan || 'Pro Alerts',
              membershipStatus: 'Active',
              subscriptionExpiresAt: expiresAt
            }
          });
          try {
            Database.updateUser(tx.userId, {
              membershipTier: tx.plan || 'Pro Alerts',
              membershipStatus: 'Active',
              subscriptionExpiresAt: expiresAt
            });
          } catch {}
        }

        const updatedTx = {
          ...tx,
          status: 'Success',
          verifiedAt: new Date().toISOString(),
          adminNote: note || 'Verified and approved by administrator',
          balanceBefore: balanceBefore ?? tx.balanceBefore,
          balanceAfter: balanceAfter ?? tx.balanceAfter,
          updatedAt: new Date().toISOString()
        };

        await txColl.updateOne({ id }, { $set: updatedTx });
        try {
          const txs = Database.getTransactions();
          const idx = txs.findIndex(t => t.id === id);
          if (idx !== -1) { txs[idx] = updatedTx; Database.saveTransactions(txs); }
        } catch {}

        const { _id, ...safe } = updatedTx;
        return safe;
      } else {
        const updatedTx = {
          ...tx,
          status: 'Failed',
          rejectionReason: reason || 'Payment proof verification rejected.',
          updatedAt: new Date().toISOString()
        };

        await txColl.updateOne({ id }, { $set: updatedTx });
        try {
          const txs = Database.getTransactions();
          const idx = txs.findIndex(t => t.id === id);
          if (idx !== -1) { txs[idx] = updatedTx; Database.saveTransactions(txs); }
        } catch {}

        const { _id, ...safe } = updatedTx;
        return safe;
      }
    }

    return this.verify(id, action, note, reason);
  }

  static verify(id: string, action: 'approve' | 'reject', note?: string, reason?: string): any | null {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous verify is prohibited to ensure authoritative persistence; use verifyPaymentAsync.');
    }
    const txs = Database.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const tx = txs[idx];
    if (action === 'approve') {
      tx.status = 'Success';
      tx.verifiedAt = new Date().toISOString();
      tx.adminNote = note || 'Verified and approved by administrator';

      if (tx.type === 'Wallet Deposit' && tx.userId) {
        const user = Database.getUserById(tx.userId);
        if (user) {
          const currentBal = Number(user.walletBalance || 0);
          tx.balanceBefore = currentBal;
          tx.balanceAfter = currentBal + Number(tx.amount || 0);
          Database.updateUser(user.id, { walletBalance: tx.balanceAfter });
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
    return tx;
  }
}
