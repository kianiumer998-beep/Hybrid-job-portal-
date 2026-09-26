import { Router } from 'express';
import { PaymentRepository, AuditRepository, UserRepository, PricingRepository, JobRepository } from '../db/repositories';
import { requireAdminPermission, requireAuth } from '../auth/authManager';

export const transactionRouter = Router();

// 1. Get transactions (all for admin, or scoped to authenticated user)
transactionRouter.get('/', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const adminRoles = ['Super Admin', 'Admin', 'Payment Manager', 'Finance Manager'];
    const isAdmin = user && adminRoles.includes(user.role);

    let targetUserId: string | undefined;
    if (isAdmin) {
      const { userId } = req.query as Record<string, string>;
      targetUserId = userId;
    } else {
      targetUserId = user.userId || user.id;
    }

    const txs = PaymentRepository.getAll(targetUserId);
    res.json({ success: true, transactions: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching transactions' });
  }
});

// 2. Submit payment proof with Idempotency Protection & Authoritative Pricing Authority
transactionRouter.post('/', requireAuth, async (req, res) => {
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

    const authUser = (req as any).user;
    const authUserId = authUser?.userId || authUser?.id;
    const adminRoles = ['Super Admin', 'Admin', 'Payment Manager', 'Finance Manager'];
    const isAdmin = Boolean(authUser && adminRoles.includes(authUser.role));

    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!isAdmin && userId && String(userId) !== String(authUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot submit a transaction for another user.'
      });
    }

    const effectiveUserId = isAdmin ? (userId || authUserId) : authUserId;
    const effectiveUserName = isAdmin ? (userName || authUser?.name) : (authUser?.name || userName);
    const effectiveUserEmail = isAdmin ? (userEmail || authUser?.email) : (authUser?.email || userEmail);

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required.' });
    }

    // Verify job ownership for non-admin users when jobIdRef is supplied
    if (!isAdmin && jobIdRef) {
      const matchedJobs = await JobRepository.getJobsByIds([String(jobIdRef)]);
      const targetJob = matchedJobs[0];
      const jobOwnerId = targetJob?.submittedByUserId || targetJob?.postedByUserId || targetJob?.userId;
      if (!targetJob || !jobOwnerId || String(jobOwnerId) !== String(effectiveUserId)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Referenced job does not belong to the authenticated user.'
        });
      }
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
        if (!isAdmin && existing.userId && String(existing.userId) !== String(effectiveUserId)) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Cannot access another user transaction.'
          });
        }
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
    if (paymentMethod === 'Wallet Balance') {
      const user = await UserRepository.getByIdAsync(effectiveUserId);
      if (!user || (user.walletBalance || 0) < enforcedAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Required: ${enforcedAmount} PKR, Available: ${user?.walletBalance || 0} PKR.`
        });
      }
      // Deduct wallet balance directly
      await UserRepository.updateAsync(effectiveUserId, {
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
      senderName: senderName || effectiveUserName || 'Customer',
      senderPhoneOrAccount,
      depositBankOrWalletName,
      proofScreenshotUrl,
      proofNote,
      userId: effectiveUserId,
      userName: effectiveUserName,
      userEmail: effectiveUserEmail,
      jobTitleRef,
      jobIdRef,
      pricingBreakdown,
      verifiedAt: initialStatus === 'Success' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString()
    });

    // If job posting paid from wallet successfully, approve pending job
    if (initialStatus === 'Success' && jobIdRef) {
      await JobRepository.approvePending(jobIdRef);
    }

    AuditRepository.add({
      user: effectiveUserName || 'User',
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

// 3. Admin Approve / Reject Payment Verification Proof
transactionRouter.patch('/:id/verify', requireAdminPermission('payments.manage'), async (req, res) => {
  try {
    const { action, note, reason } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject".' });
    }

    const tx = await PaymentRepository.verify(req.params.id, action, note, reason);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    // If approved and was for a pending job, publish it live
    if (action === 'approve' && tx.jobIdRef) {
      await JobRepository.approvePending(tx.jobIdRef);
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
