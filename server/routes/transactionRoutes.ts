import { Router } from 'express';
import { PaymentRepository, AuditRepository, UserRepository } from '../db/repositories';
import { requireAdmin } from '../auth/authManager';

export const transactionRouter = Router();

// 1. Get transactions (all for admin, or filtered by userId)
transactionRouter.get('/', (req, res) => {
  try {
    const { userId } = req.query as Record<string, string>;
    const txs = PaymentRepository.getAll(userId);
    res.json({ success: true, transactions: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching transactions' });
  }
});

// 2. Submit payment proof with Idempotency Protection
transactionRouter.post('/', (req, res) => {
  try {
    const {
      amount,
      currency,
      type,
      paymentMethod,
      transactionId,
      senderName,
      senderPhoneOrAccount,
      depositBankOrWalletName,
      proofScreenshotUrl,
      proofNote,
      userId,
      userName,
      userEmail,
      jobTitleRef,
      idempotencyKey
    } = req.body;

    if (!amount || Number(amount) <= 0 || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Valid positive amount and payment method are required.' });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = PaymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.json({
          success: true,
          transaction: existing,
          message: 'Payment proof already submitted (idempotent result).'
        });
      }
    }

    // Check duplicate transaction ID if provided
    if (transactionId) {
      const existingTid = PaymentRepository.findByTransactionId(transactionId);
      if (existingTid) {
        return res.status(409).json({
          success: false,
          message: `A transaction with ID ${transactionId} has already been recorded.`
        });
      }
    }

    const tid = transactionId || `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newTx = PaymentRepository.create({
      amount: Number(amount),
      currency: currency || 'PKR',
      type: type || 'Wallet Deposit',
      status: 'Pending',
      paymentMethod,
      transactionId: tid,
      idempotencyKey: idempotencyKey || undefined,
      senderName: senderName || userName || 'Customer',
      senderPhoneOrAccount,
      depositBankOrWalletName,
      proofScreenshotUrl,
      proofNote,
      userId,
      userName,
      userEmail,
      jobTitleRef,
      createdAt: new Date().toISOString()
    });

    AuditRepository.add({
      user: userName || 'User',
      role: 'Member',
      action: 'Payment Proof Submitted',
      target: `${amount} ${currency || 'PKR'} via ${paymentMethod} (Ref: ${tid})`,
      status: 'Success',
      metadata: { transactionId: tid, amount, paymentMethod }
    });

    res.status(201).json({
      success: true,
      transaction: newTx,
      message: 'Payment proof submitted successfully! Administrator verification is pending.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating transaction' });
  }
});

// 3. Admin Approve / Reject Payment Verification Proof
transactionRouter.patch('/:id/verify', requireAdmin, (req, res) => {
  try {
    const { action, note, reason } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject".' });
    }

    const tx = PaymentRepository.verify(req.params.id, action, note, reason);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    AuditRepository.add({
      user: 'Administrator',
      role: 'Payment Manager',
      action: action === 'approve' ? 'Payment Approved' : 'Payment Rejected',
      target: `Transaction ID ${tx.transactionId || tx.id} (${tx.amount} ${tx.currency})`,
      status: action === 'approve' ? 'Success' : 'Warning',
      metadata: { action, note, reason }
    });

    res.json({
      success: true,
      transaction: tx,
      message: `Transaction ${tx.transactionId || tx.id} has been ${action === 'approve' ? 'approved and activated' : 'rejected'}.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error verifying transaction' });
  }
});
