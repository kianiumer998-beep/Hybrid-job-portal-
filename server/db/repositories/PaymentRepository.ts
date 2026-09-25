import { Database } from '../database';
import { UserRepository } from './UserRepository';

export class PaymentRepository {
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

  static async verify(id: string, action: 'approve' | 'reject', note?: string, reason?: string): Promise<any | null> {
    const txs = Database.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const tx = txs[idx];
    if (action === 'approve') {
      // Credit wallet or activate features if applicable
      if (tx.type === 'Wallet Deposit' && tx.userId) {
        const user = await UserRepository.getByIdAsync(tx.userId);
        if (user) {
          const currentBal = Number(user.walletBalance || 0);
          await UserRepository.updateAsync(user.id, { walletBalance: currentBal + Number(tx.amount || 0) });
        }
      } else if (tx.type === 'Subscription' && tx.userId) {
        const user = await UserRepository.getByIdAsync(tx.userId);
        if (user) {
          await UserRepository.updateAsync(user.id, {
            membershipTier: tx.plan || 'Pro Alerts',
            membershipStatus: 'Active',
            subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          });
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
