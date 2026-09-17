import { Router } from 'express';
import { PaymentRepository, AuditRepository, UserRepository, PricingRepository, JobRepository, CaseRepository } from '../db/repositories';
import { requireAdmin, requireAuth } from '../auth/authManager';

export const transactionRouter = Router();

// 1. Get transactions (scoped to authenticated user, or all for admin)
transactionRouter.get('/', requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const { type, status } = req.query as Record<string, string>;

    // Non-admin users are strictly restricted to their own transactions
    const queryUserId = req.query.userId as string | undefined;
    const targetUserId = isAdmin && queryUserId ? queryUserId : (req.user?.userId || req.user?.id);

    const txs = await PaymentRepository.getAllAsync(targetUserId, { type, status });
    res.json({ success: true, transactions: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching transactions' });
  }
});

// 2. Get Authoritative User Wallet Balance & Stats
transactionRouter.get('/wallet/balance', requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const queryUserId = req.query.userId as string | undefined;

    // Normal users can NEVER inspect other users' balances
    const targetUserId = isAdmin && queryUserId ? queryUserId : (req.user?.userId || req.user?.id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID could not be identified.' });
    }

    const summary = await PaymentRepository.getUserWalletAsync(targetUserId);
    res.json({ success: true, wallet: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error retrieving wallet summary' });
  }
});

// 3. User Request Withdrawal Workflow
transactionRouter.post('/withdraw', requireAuth, async (req: any, res) => {
  try {
    const { amount, paymentMethod, senderPhoneOrAccount, senderName, proofNote, idempotencyKey } = req.body;
    
    // Strictly derive targetUserId from verified session token for non-admins
    const targetUserId = req.user?.userId || req.user?.id;
    if (!targetUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const user = await UserRepository.getByIdAsync(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    const tx = await PaymentRepository.requestWithdrawalAsync(
      targetUserId,
      {
        amount: Number(amount),
        paymentMethod,
        senderPhoneOrAccount,
        senderName: senderName || user.name,
        proofNote
      },
      idempotencyKey || (req.headers['x-idempotency-key'] as string)
    );

    // Create Universal Submission Case for tracking
    const newCase = await CaseRepository.createAsync({
      type: 'withdrawal',
      referenceId: tx.id,
      title: `Withdrawal Request: ${tx.amount} PKR via ${tx.paymentMethod}`,
      userId: targetUserId,
      userName: tx.userName || user.name,
      userEmail: tx.userEmail || user.email,
      status: 'pending',
      priority: 'high',
      metadata: { transactionId: tx.transactionId, amount: tx.amount, paymentMethod: tx.paymentMethod }
    });

    AuditRepository.add({
      user: tx.userName || user.name || 'Member',
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
transactionRouter.patch('/:id/withdrawal-process', requireAdmin, async (req, res) => {
  try {
    const { action, payoutRef, proofSlipUrl, note, reason } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject".' });
    }

    const tx = await PaymentRepository.processWithdrawalAsync(req.params.id, action, {
      payoutRef,
      proofSlipUrl,
      note,
      reason
    });

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Withdrawal transaction not found.' });
    }

    // Update related Universal Case if exists
    const cases = await CaseRepository.getAllAsync({ type: 'withdrawal' });
    const relatedCase = cases.find(c => c.referenceId === tx.id || c.metadata?.transactionId === tx.transactionId);
    if (relatedCase) {
      await CaseRepository.updateStatusAsync(
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
transactionRouter.post('/wallet/debit', requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const { userId, amount, type, description, meta, idempotencyKey } = req.body;

    // Normal users can ONLY debit their own wallet
    const targetUserId = isAdmin && userId ? userId : (req.user?.userId || req.user?.id);
    if (!targetUserId || !amount) {
      return res.status(400).json({ success: false, message: 'Valid target user and amount are required.' });
    }

    const result = await PaymentRepository.debitWalletAsync(
      targetUserId,
      Number(amount),
      type || 'Service Fee',
      description || 'Direct wallet payment debit',
      meta,
      idempotencyKey || (req.headers['x-idempotency-key'] as string)
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Wallet debit failed.' });
  }
});

// 6. Admin Manual Credit / Wallet Adjustment
transactionRouter.post('/wallet/credit', requireAdmin, async (req, res) => {
  try {
    const { userId, amount, type, description, meta, idempotencyKey } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'userId and amount are required.' });
    }

    const result = await PaymentRepository.creditWalletAsync(
      userId,
      Number(amount),
      type || 'Admin Adjustment',
      description || 'Administrative balance adjustment',
      meta,
      idempotencyKey || (req.headers['x-idempotency-key'] as string)
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
transactionRouter.post('/', requireAuth, async (req: any, res) => {
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
      jobTitleRef,
      jobIdRef,
      jobPricingOptions,
      adPricingOptions,
      idempotencyKey
    } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required.' });
    }

    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const targetUserId = isAdmin && req.body.userId ? req.body.userId : (req.user?.userId || req.user?.id);
    const user = await UserRepository.getByIdAsync(targetUserId);

    const effectiveUserName = user?.name || req.body.userName || req.user?.name || 'Customer';
    const effectiveUserEmail = user?.email || req.body.userEmail || req.user?.email || '';

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
    const resolvedIdempotencyKey = idempotencyKey || (req.headers['x-idempotency-key'] as string);
    if (resolvedIdempotencyKey) {
      const existing = await PaymentRepository.findByIdempotencyKeyAsync(resolvedIdempotencyKey);
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
      const existingTid = await PaymentRepository.findByTransactionIdAsync(transactionId);
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
    let debitBalanceBefore: number | undefined;
    let debitBalanceAfter: number | undefined;

    if (paymentMethod === 'Wallet Balance') {
      if (!targetUserId) {
        return res.status(400).json({ success: false, message: 'User ID is required for wallet payment.' });
      }

      // Use atomic debitWalletAsync to strictly prevent negative balance and record balanceBefore / balanceAfter
      const debitResult = await PaymentRepository.debitWalletAsync(
        targetUserId,
        enforcedAmount,
        type || 'Service Payment',
        proofNote || `Direct wallet balance payment for ${type || 'Service'}`,
        {
          jobIdRef,
          jobTitleRef,
          transactionId: tid
        },
        resolvedIdempotencyKey
      );

      initialStatus = 'Success';
      debitBalanceBefore = debitResult.transaction?.balanceBefore;
      debitBalanceAfter = debitResult.transaction?.balanceAfter;
    }

    const newTx = await PaymentRepository.createAsync({
      amount: enforcedAmount,
      currency: currency || 'PKR',
      type: type || 'Wallet Deposit',
      status: initialStatus,
      paymentMethod,
      transactionId: tid,
      idempotencyKey: resolvedIdempotencyKey || undefined,
      senderName: senderName || effectiveUserName,
      senderPhoneOrAccount,
      depositBankOrWalletName,
      proofScreenshotUrl,
      proofNote,
      userId: targetUserId,
      userName: effectiveUserName,
      userEmail: effectiveUserEmail,
      jobTitleRef,
      jobIdRef,
      pricingBreakdown,
      balanceBefore: debitBalanceBefore,
      balanceAfter: debitBalanceAfter,
      verifiedAt: initialStatus === 'Success' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString()
    });

    // Create Universal Submission Case for deposits or fees needing review
    if (initialStatus === 'Pending') {
      await CaseRepository.createAsync({
        type: 'deposit',
        referenceId: newTx.id,
        title: `Payment Proof: ${enforcedAmount} PKR via ${paymentMethod}`,
        userId: targetUserId,
        userName: newTx.senderName,
        userEmail: effectiveUserEmail,
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
      user: effectiveUserName,
      role: req.user?.role || 'Member',
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

    const tx = await PaymentRepository.verifyPaymentAsync(req.params.id, action, note, reason);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    // If approved and was for a pending job, publish it live
    if (action === 'approve' && tx.jobIdRef) {
      await JobRepository.approvePending(tx.jobIdRef);
    }

    // Update related Universal Case if exists
    const cases = await CaseRepository.getAllAsync({ type: 'deposit' });
    const relatedCase = cases.find(c => c.referenceId === tx.id || c.metadata?.transactionId === tx.transactionId);
    if (relatedCase) {
      await CaseRepository.updateStatusAsync(
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
