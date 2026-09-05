import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';

export const transactionRouter = Router();

// Get transactions (all for admin, or filtered by userId)
transactionRouter.get('/', (req, res) => {
  try {
    const { userId } = req.query as Record<string, string>;
    let txs = Database.getTransactions();
    if (userId) {
      txs = txs.filter(t => t.userId === userId);
    }
    res.json({ success: true, transactions: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching transactions' });
  }
});

// Submit manual deposit / payment proof
transactionRouter.post('/', (req, res) => {
  try {
    const { amount, currency, type, paymentMethod, transactionId, senderName, senderPhoneOrAccount, depositBankOrWalletName, proofScreenshotUrl, proofNote, userId, userName, userEmail, jobTitleRef } = req.body;

    if (!amount || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Amount and payment method are required.' });
    }

    const newTx = Database.addTransaction({
      amount: Number(amount),
      currency: currency || 'PKR',
      type: type || 'Wallet Deposit',
      status: 'Pending',
      paymentMethod,
      transactionId: transactionId || `TXN-${Date.now().toString(36).toUpperCase()}`,
      senderName,
      senderPhoneOrAccount,
      depositBankOrWalletName,
      proofScreenshotUrl,
      proofNote,
      userId,
      userName,
      userEmail,
      jobTitleRef
    });

    Database.addAuditLog({
      user: userName || 'User',
      role: 'Member',
      action: 'Payment Proof Submitted',
      target: `${amount} ${currency || 'PKR'} via ${paymentMethod}`,
      status: 'Success'
    });

    res.status(201).json({
      success: true,
      transaction: newTx,
      message: 'Payment proof submitted! Admin will verify and activate your service shortly.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating transaction' });
  }
});

// Admin Approve / Reject Payment Verification Proof
transactionRouter.patch('/:id/verify', requireAdmin, (req, res) => {
  try {
    const { action, note, reason } = req.body; // action: 'approve' | 'reject'
    const txs = Database.getTransactions();
    const idx = txs.findIndex(t => t.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    const tx = txs[idx];
    if (action === 'approve') {
      tx.status = 'Success';
      tx.verifiedAt = new Date().toISOString();
      tx.adminNote = note || 'Verified and approved by administrator';

      // If it is a wallet deposit, credit the user's wallet
      if (tx.type === 'Wallet Deposit' && tx.userId) {
        const user = Database.getUserById(tx.userId);
        if (user) {
          const currentBal = Number(user.walletBalance || 0);
          Database.updateUser(user.id, { walletBalance: currentBal + Number(tx.amount || 0) });
        }
      }
    } else {
      tx.status = 'Failed';
      tx.rejectionReason = reason || 'Payment proof verification rejected.';
    }

    Database.saveTransactions(txs);

    Database.addAuditLog({
      user: 'Administrator',
      role: 'Payment Manager',
      action: action === 'approve' ? 'Payment Approved' : 'Payment Rejected',
      target: `Transaction ID ${tx.id} (${tx.amount} ${tx.currency})`,
      status: action === 'approve' ? 'Success' : 'Warning'
    });

    res.json({ success: true, transaction: tx, message: `Transaction has been ${action === 'approve' ? 'approved' : 'rejected'}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error verifying transaction' });
  }
});
