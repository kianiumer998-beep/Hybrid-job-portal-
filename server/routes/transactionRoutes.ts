import { Router } from 'express';
import { PaymentRepository, AuditRepository, UserRepository, PricingRepository, JobRepository } from '../db/repositories';
import { Database } from '../db/database';
import { requireAdminPermission, requireAuth } from '../auth/authManager';

export const transactionRouter = Router();

// Lightweight in-memory concurrency locks to prevent per-user wallet double-spend and concurrent transaction verification races
const activeUserTransactionLocks = new Set<string>();
const activeTransactionVerificationLocks = new Set<string>();

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
      plan,
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

    const userLockKey = String(effectiveUserId);
    if (activeUserTransactionLocks.has(userLockKey)) {
      return res.status(409).json({
        success: false,
        message: 'Another transaction for this user is currently being processed. Please try again.'
      });
    }

    activeUserTransactionLocks.add(userLockKey);
    try {
      if (!paymentMethod) {
        return res.status(400).json({ success: false, message: 'Payment method is required.' });
      }

      const effectiveType = type || 'Wallet Deposit';
      const ALLOWED_TRANSACTION_TYPES = [
        'Wallet Deposit',
        'Job Posting',
        'Advertisement',
        'Subscription'
      ];

      if (!ALLOWED_TRANSACTION_TYPES.includes(effectiveType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction type.'
        });
      }

      const safeJobIdRef =
        effectiveType === 'Job Posting' && jobIdRef !== undefined && jobIdRef !== null && String(jobIdRef).trim() !== ''
          ? String(jobIdRef).trim()
          : undefined;

      if (effectiveType === 'Wallet Deposit' && paymentMethod === 'Wallet Balance') {
        return res.status(400).json({
          success: false,
          message: 'Wallet Deposit cannot be funded using Wallet Balance.'
        });
      }

      // Require valid pending job reference and verify job ownership for non-admin users on Job Posting transactions
      let targetJob: any = null;
      if (effectiveType === 'Job Posting') {
        if (!safeJobIdRef) {
          return res.status(400).json({
            success: false,
            message: 'A valid jobIdRef is required for Job Posting transactions.'
          });
        }
        const matchedJobs = await JobRepository.getJobsByIds([String(safeJobIdRef)]);
        targetJob = matchedJobs[0] || null;
        if (!targetJob) {
          return res.status(400).json({
            success: false,
            message: 'Referenced job posting was not found.'
          });
        }
        if (!isAdmin) {
          const jobOwnerId = targetJob?.submittedByUserId || targetJob?.postedByUserId || targetJob?.userId;
          if (!jobOwnerId || String(jobOwnerId) !== String(effectiveUserId)) {
            return res.status(403).json({
              success: false,
              message: 'Forbidden: Referenced job does not belong to the authenticated user.'
            });
          }
        }
        if (targetJob.status !== 'Pending') {
          return res.status(409).json({
            success: false,
            message: 'This job has already been paid for or is already active.'
          });
        }
      }

      // AUTHORITATIVE PRICING CALCULATION
      let enforcedAmount = Number(amount);
      let pricingBreakdown: Array<{ name: string; amount: number }> = [];
      let safeSubscriptionPlan: string | undefined = undefined;

      if (effectiveType === 'Job Posting') {
        const calc = PricingRepository.calculateJobPostingPrice(jobPricingOptions || {});
        enforcedAmount = calc.finalPrice;
        pricingBreakdown = calc.breakdown;
      } else if (effectiveType === 'Advertisement') {
        const calc = PricingRepository.calculateAdPrice(adPricingOptions || {});
        enforcedAmount = calc.finalPrice;
        pricingBreakdown = calc.breakdown;
      } else if (effectiveType === 'Subscription') {
        const rawPlan = typeof plan === 'string' ? plan.trim() : '';
        const subPricing = PricingRepository.get()?.subscriptions || {};
        let configuredSubPrice = NaN;

        if (rawPlan === 'Pro Alerts' || rawPlan === 'proMonthlyPkr') {
          safeSubscriptionPlan = 'Pro Alerts';
          configuredSubPrice = Number(subPricing.proMonthlyPkr);
        } else if (rawPlan === 'VIP Jobseeker' || rawPlan === 'vipMonthlyPkr') {
          safeSubscriptionPlan = 'VIP Jobseeker';
          configuredSubPrice = Number(subPricing.vipMonthlyPkr);
        } else if (rawPlan === 'Govt Alerts Weekly' || rawPlan === 'govtAlertsWeeklyPkr') {
          safeSubscriptionPlan = 'Govt Alerts Weekly';
          configuredSubPrice = Number(subPricing.govtAlertsWeeklyPkr);
        } else {
          return res.status(400).json({
            success: false,
            message: 'Valid subscription plan is required.'
          });
        }

        if (!Number.isFinite(configuredSubPrice) || configuredSubPrice <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid subscription plan pricing.'
          });
        }

        enforcedAmount = configuredSubPrice;
        pricingBreakdown = [{ name: `${safeSubscriptionPlan} Subscription`, amount: configuredSubPrice }];
      } else {
        // Wallet deposit: must be a finite positive number with at most 2 decimal places
        const numericAmount = Number(amount);
        if (amount === undefined || amount === null || amount === '' || !Number.isFinite(numericAmount) || numericAmount <= 0) {
          return res.status(400).json({ success: false, message: 'Valid positive deposit amount is required.' });
        }
        if (Math.abs(Math.round(numericAmount * 100) - numericAmount * 100) > 1e-6) {
          return res.status(400).json({
            success: false,
            message: 'Deposit amount must have at most 2 decimal places.'
          });
        }
        enforcedAmount = numericAmount;
      }

      if (!Number.isFinite(enforcedAmount) || enforcedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction amount.'
        });
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

      // Prevent duplicate pending or completed transactions for the same Job Posting (Failed transactions do not block retry)
      if (effectiveType === 'Job Posting' && safeJobIdRef) {
        const existingJobTx = PaymentRepository.getAll().find(
          (t: any) =>
            t &&
            t.type === 'Job Posting' &&
            String(t.jobIdRef) === String(safeJobIdRef) &&
            (t.status === 'Pending' || t.status === 'Success')
        );
        if (existingJobTx) {
          return res.status(409).json({
            success: false,
            message: 'This job already has a pending or completed payment transaction.'
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

      // Pre-validate Wallet Balance requirements before creating the Pending transaction
      let previousWalletBalance = 0;
      if (paymentMethod === 'Wallet Balance') {
        if (!Number.isFinite(enforcedAmount) || enforcedAmount <= 0) {
          return res.status(400).json({
            success: false,
            message: 'A positive payment amount is required for Wallet Balance transactions.'
          });
        }
        if (effectiveType === 'Job Posting' && safeJobIdRef) {
          if (!targetJob || targetJob.status === 'Approved' || targetJob.status !== 'Pending') {
            return res.status(409).json({
              success: false,
              message: 'This job has already been paid for or is already active.'
            });
          }
        }
        const user = await UserRepository.getByIdAsync(effectiveUserId);
        const rawBal = Number(user?.walletBalance || 0);
        previousWalletBalance = Number.isFinite(rawBal) && rawBal >= 0 ? rawBal : 0;
        if (!user || previousWalletBalance < enforcedAmount) {
          return res.status(400).json({
            success: false,
            message: `Insufficient wallet balance. Required: ${enforcedAmount} PKR, Available: ${user?.walletBalance || 0} PKR.`
          });
        }
      }

      // Create transaction initially as Pending
      const newTx = PaymentRepository.create({
        amount: enforcedAmount,
        currency: currency || 'PKR',
        type: effectiveType,
        ...(safeSubscriptionPlan ? { plan: safeSubscriptionPlan } : {}),
        status: 'Pending',
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
        jobIdRef: safeJobIdRef,
        pricingBreakdown,
        createdAt: new Date().toISOString()
      });

      let finalStatus: 'Pending' | 'Success' = 'Pending';

      if (paymentMethod === 'Wallet Balance') {
        try {
          if (effectiveType === 'Subscription') {
            // Single atomic user update for wallet deduction + subscription activation
            const updatedUser = await UserRepository.updateAsync(effectiveUserId, {
              walletBalance: previousWalletBalance - enforcedAmount,
              membershipTier: safeSubscriptionPlan || 'Pro Alerts',
              membershipStatus: 'Active',
              subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            });
            if (!updatedUser) {
              throw new Error('Failed to deduct wallet balance and activate subscription.');
            }
          } else {
            // Job Posting or Advertisement wallet deduction
            const updatedUser = await UserRepository.updateAsync(effectiveUserId, {
              walletBalance: previousWalletBalance - enforcedAmount
            });
            if (!updatedUser) {
              throw new Error('Failed to deduct wallet balance.');
            }

            if (effectiveType === 'Job Posting' && safeJobIdRef) {
              let approvedJob: any = null;
              try {
                approvedJob = await JobRepository.approvePending(safeJobIdRef);
              } catch (jobApproveErr) {
                try {
                  await UserRepository.updateAsync(effectiveUserId, {
                    walletBalance: previousWalletBalance
                  });
                } catch {}
                throw jobApproveErr;
              }
              if (!approvedJob) {
                try {
                  await UserRepository.updateAsync(effectiveUserId, {
                    walletBalance: previousWalletBalance
                  });
                } catch {}
                throw new Error('Failed to activate job posting after wallet deduction.');
              }
            }
          }

          // Only mark transaction Success after wallet operation and service activation succeed
          const verifiedAt = new Date().toISOString();
          const allTxs = Database.getTransactions();
          const txIdx = allTxs.findIndex((t: any) => t && t.id === newTx.id);
          if (txIdx !== -1) {
            allTxs[txIdx].status = 'Success';
            allTxs[txIdx].verifiedAt = verifiedAt;
            allTxs[txIdx].updatedAt = verifiedAt;
            Database.saveTransactions(allTxs);
          }
          newTx.status = 'Success';
          newTx.verifiedAt = verifiedAt;
          newTx.updatedAt = verifiedAt;
          finalStatus = 'Success';
        } catch (walletProcessingErr: any) {
          const failedAt = new Date().toISOString();
          const failureReason = walletProcessingErr?.message || 'Wallet Balance processing failed.';
          const allTxs = Database.getTransactions();
          const txIdx = allTxs.findIndex((t: any) => t && t.id === newTx.id);
          if (txIdx !== -1) {
            allTxs[txIdx].status = 'Failed';
            allTxs[txIdx].rejectionReason = failureReason;
            allTxs[txIdx].updatedAt = failedAt;
            Database.saveTransactions(allTxs);
          }
          newTx.status = 'Failed';
          newTx.rejectionReason = failureReason;
          newTx.updatedAt = failedAt;
          throw walletProcessingErr;
        }
      }

      AuditRepository.add({
        user: effectiveUserName || 'User',
        role: 'Member',
        action: finalStatus === 'Success' ? 'Payment Completed (Wallet)' : 'Payment Proof Submitted',
        target: `${enforcedAmount} ${currency || 'PKR'} via ${paymentMethod} (Ref: ${tid})`,
        status: 'Success',
        metadata: { transactionId: tid, amount: enforcedAmount, paymentMethod, type: effectiveType }
      });

      return res.status(201).json({
        success: true,
        transaction: newTx,
        message: finalStatus === 'Success'
          ? 'Payment processed and verified immediately via wallet balance!'
          : 'Payment proof submitted successfully! Administrator verification is pending.'
      });
    } finally {
      activeUserTransactionLocks.delete(userLockKey);
    }
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

    const verifyLockKey = String(req.params.id);
    if (activeTransactionVerificationLocks.has(verifyLockKey)) {
      return res.status(409).json({
        success: false,
        message: 'This transaction is currently being processed. Please try again.'
      });
    }

    activeTransactionVerificationLocks.add(verifyLockKey);
    try {
      const tx = await PaymentRepository.verify(req.params.id, action, note, reason);
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

      return res.json({
        success: true,
        transaction: tx,
        message: `Transaction ${tx.transactionId || tx.id} has been ${action === 'approve' ? 'approved and activated' : 'rejected'}.`
      });
    } finally {
      activeTransactionVerificationLocks.delete(verifyLockKey);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error verifying transaction' });
  }
});
