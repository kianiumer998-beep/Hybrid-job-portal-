import { Router } from 'express';
import { PaymentRepository, AuditRepository, UserRepository, PricingRepository, JobRepository, CaseRepository } from '../db/repositories';
import { requireAdmin, requireAuth } from '../auth/authManager';

export const transactionRouter = Router();

// 1. Get transactions (all for admin, or filtered by userId / type / status)
transactionRouter.get('/', async (req, res) => {
  try {
    const { userId, type, status } = req.query as Record<string, string>;
    const txs = await PaymentRepository.getAllAsync(userId, { type, status });
    res.json({ success: true, transactions: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching transactions' });
  }
});


// 2. Get Authoritative User Wallet Balance & Stats
transactionRouter.get('/wallet/balance', (req, res) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required to retrieve wallet balance.' });
    }

    const summary = PaymentRepository.getUserWallet(userId);
    res.json({ success: true, wallet: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error retrieving wallet summary' });
  }
});

// 3. User Request Withdrawal Workflow
transactionRouter.post('/withdraw', (req, res) => {
  try {
    const { amount, paymentMethod, senderPhoneOrAccount, senderName, proofNote, userId } = req.body;
    const targetUserId = userId || (req as any).user?.userId;

    if (!targetUserId) {
      return res.status(401).json({ success: false, message: 'Authentication or valid userId required.' });
    }

    const tx = PaymentRepository.requestWithdrawal(targetUserId, {
      amount: Number(amount),
      paymentMethod,
      senderPhoneOrAccount,
      senderName,
      proofNote
    });

    // Create Universal Submission Case for tracking
    const newCase = CaseRepository.create({
      type: 'withdrawal',
      referenceId: tx.id,
      title: `Withdrawal Request: ${tx.amount} PKR via ${tx.paymentMethod}`,
      userId: targetUserId,
      userName: tx.userName,
      userEmail: tx.userEmail,
      status: 'pending',
      priority: 'high',
      metadata: { transactionId: tx.transactionId, amount: tx.amount, paymentMethod: tx.paymentMethod }
    });

    AuditRepository.add({
      user: tx.userName || 'Member',
      role: 'Member',
      action: 'Withdrawal Requested',
      target: `${tx.amount} PKR to ${tx.paymentMethod} (${senderPhoneOrAccount})`,
      status: 'Warning',
      metadata: { transactionId: tx.transactionId, caseId: newCase.id }
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Processing by finance team is pending.',
      transaction: tx,
      case: newCase
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to submit withdrawal request' });
  }
});

// 4. Admin Process Withdrawal (Approve with Slip / Reject with Auto-Refund)
transactionRouter.patch('/:id/withdrawal-process', requireAdmin, (req, res) => {
  try {
    const { action, payoutRef, proofSlipUrl, note, reason } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject".' });
    }

    const tx = PaymentRepository.processWithdrawal(req.params.id, action, {
      payoutRef,
      proofSlipUrl,
      note,
      reason
    });

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Withdrawal transaction not found.' });
    }

    // Update related Universal Case if exists
    const cases = CaseRepository.getAll({ type: 'withdrawal' });
    const relatedCase = cases.find(c => c.referenceId === tx.id || c.metadata?.transactionId === tx.transactionId);
    if (relatedCase) {
      CaseRepository.updateStatus(
        relatedCase.id,
        action === 'approve' ? 'approved' : 'rejected',
        'Finance Admin',
        'Super Admin',
        action === 'approve' ? `Disbursement slip reference: ${payoutRef || 'N/A'}` : reason
      );
    }

    AuditRepository.add({
      user: 'Finance Admin',
      role: 'Super Admin',
      action: action === 'approve' ? 'Withdrawal Approved & Disbursed' : 'Withdrawal Rejected & Refunded',
      target: `${tx.amount} PKR (Ref: ${tx.transactionId})`,
      status: action === 'approve' ? 'Success' : 'Warning',
      metadata: { action, payoutRef, reason }
    });

    res.json({
      success: true,
      message: action === 'approve'
        ? 'Withdrawal approved and marked disbursed.'
        : 'Withdrawal rejected and amount automatically refunded to user wallet.',
      transaction: tx
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to process withdrawal' });
  }
});

// 5. Server-Side Wallet Debit (For Campaign Spend / Job Posting / Services)
transactionRouter.post('/wallet/debit', (req, res) => {
  try {
    const { userId, amount, type, description, meta } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'userId and amount are required.' });
    }

    const result = PaymentRepository.debitWallet(
      userId,
      Number(amount),
      type || 'Service Fee',
      description || 'Direct wallet payment debit',
      meta
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Wallet debit failed.' });
  }
});

// 6. Admin Manual Credit / Wallet Adjustment
transactionRouter.post('/wallet/credit', requireAdmin, (req, res) => {
  try {
    const { userId, amount, type, description, meta } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'userId and amount are required.' });
    }

    const result = PaymentRepository.creditWallet(
      userId,
      Number(amount),
      type || 'Admin Adjustment',
      description || 'Administrative balance adjustment',
      meta
    );

    AuditRepository.add({
      user: 'Administrator',
      role: 'Super Admin',
      action: 'Wallet Balance Adjusted',
      target: `User ${userId} (+${amount} PKR)`,
      status: 'Success',
      metadata: { userId, amount, description }
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Wallet credit failed.' });
  }
});

// 7. Submit payment proof with Idempotency Protection & Authoritative Pricing Authority
transactionRouter.post('/', async (req, res) => {
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
      jobIdRef,
      jobPricingOptions,
      adPricingOptions,
      idempotencyKey
    } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required.' });
    }

    // AUTHORITATIVE PRICING CALCULATION
    let enforcedAmount = Number(amount);
    let pricingBreakdown: Array<{ name: string; amount: number }> = [];

    if (type === 'Job Posting') {
      const calc = PricingRepository.calculateJobPostingPrice(jobPricingOptions || {});
      enforcedAmount = calc.finalPrice;
      pricingBreakdown = calc.breakdown;
    } else if (type === 'Advertisement') {
      const calc = PricingRepository.calculateAdPrice(adPricingOptions || {});
      enforcedAmount = calc.finalPrice;
      pricingBreakdown = calc.breakdown;
    } else {
      // Wallet deposit: must be positive
      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid positive deposit amount is required.' });
      }
      enforcedAmount = Number(amount);
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
          message: `A transaction with reference ID ${transactionId} has already been recorded.`
        });
      }
    }

    const tid = transactionId || `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Wallet direct payment check
    let initialStatus: 'Pending' | 'Success' = 'Pending';
    if (paymentMethod === 'Wallet Balance' && userId) {
      const user = UserRepository.getById(userId);
      if (!user || (user.walletBalance || 0) < enforcedAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Required: ${enforcedAmount} PKR, Available: ${user?.walletBalance || 0} PKR.`
        });
      }

      // Deduct wallet balance directly
      UserRepository.update(userId, {
        walletBalance: (user.walletBalance || 0) - enforcedAmount
      });
      initialStatus = 'Success';
    }

    const newTx = PaymentRepository.create({
      amount: enforcedAmount,
      currency: currency || 'PKR',
      type: type || 'Wallet Deposit',
      status: initialStatus,
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
      jobIdRef,
      pricingBreakdown,
      verifiedAt: initialStatus === 'Success' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString()
    });

    // Create Universal Submission Case for deposits or fees needing review
    if (initialStatus === 'Pending') {
      CaseRepository.create({
        type: 'deposit',
        referenceId: newTx.id,
        title: `Payment Proof: ${enforcedAmount} PKR via ${paymentMethod}`,
        userId,
        userName: newTx.senderName,
        userEmail,
        status: 'pending',
        priority: 'medium',
        metadata: { transactionId: tid, amount: enforcedAmount, paymentMethod, depositBankOrWalletName }
      });
    }

    // If job posting paid from wallet successfully, approve pending job
    if (initialStatus === 'Success' && jobIdRef) {
      await JobRepository.approvePending(jobIdRef);
    }

    AuditRepository.add({
      user: userName || 'User',
      role: 'Member',
      action: initialStatus === 'Success' ? 'Payment Completed (Wallet)' : 'Payment Proof Submitted',
      target: `${enforcedAmount} ${currency || 'PKR'} via ${paymentMethod} (Ref: ${tid})`,
      status: 'Success',
      metadata: { transactionId: tid, amount: enforcedAmount, paymentMethod, type }
    });

    res.status(201).json({
      success: true,
      transaction: newTx,
      message: initialStatus === 'Success'
        ? 'Payment processed and verified immediately via wallet balance!'
        : 'Payment proof submitted successfully! Administrator verification is pending.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating transaction' });
  }
});

// 8. Admin Approve / Reject Payment Verification Proof
transactionRouter.patch('/:id/verify', requireAdmin, async (req, res) => {
  try {
    const { action, note, reason } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject".' });
    }

    const tx = PaymentRepository.verify(req.params.id, action, note, reason);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    // If approved and was for a pending job, publish it live
    if (action === 'approve' && tx.jobIdRef) {
      await JobRepository.approvePending(tx.jobIdRef);
    }

    // Update related Universal Case if exists
    const cases = CaseRepository.getAll({ type: 'deposit' });
    const relatedCase = cases.find(c => c.referenceId === tx.id || c.metadata?.transactionId === tx.transactionId);
    if (relatedCase) {
      CaseRepository.updateStatus(
        relatedCase.id,
        action === 'approve' ? 'approved' : 'rejected',
        'Finance Admin',
        'Super Admin',
        action === 'approve' ? (note || 'Verified receipt and credited wallet.') : reason
      );
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

