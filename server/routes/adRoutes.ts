import { Router } from 'express';
import { AdRepository, AuditRepository, PaymentRepository, PricingRepository } from '../db/repositories';
import { requireAdminPermission, requireAuth, authMiddleware, hasAdminPermission } from '../auth/authManager';

export const adRouter = Router();

const activeAdCreationLocks = new Set<string>();

// 1. Get Ads (Public active ads, plus authenticated user's own campaigns, or all for admin)
adRouter.get('/', async (req, res) => {
  try {
    const { status, placement } = req.query as Record<string, string>;
    const user = (req as any).user;
    const canManageCampaigns = Boolean(
      user &&
      (hasAdminPermission(user.role, 'advertisements.manage') || hasAdminPermission(user.role, 'finance.manage'))
    );

    if (canManageCampaigns) {
      const rawAds = await AdRepository.getAllAsync({ status, placement });
      const isFullAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';

      // Admins retain the complete campaign record. Finance-only access is deliberately
      // limited to campaign/payment identifiers and financial fields, never contact details.
      if (isFullAdmin || hasAdminPermission(user?.role, 'advertisements.manage')) {
        return res.json({ success: true, advertisements: rawAds });
      }

      const financeCampaigns = rawAds.map((ad: any) => {
        const financeView: Record<string, any> = {};
        const financeVisibleFields = [
          'id', 'title', 'type', 'placement', 'status', 'approvalStatus',
          'durationUnit', 'durationValue', 'durationDisplay',
          'targetPages', 'campaignCostPkr', 'paymentStatus', 'walletTxId',
          'paymentTransactionId', 'transactionRef', 'budget', 'startDate', 'endDate',
          'scheduledStartAt', 'scheduledEndAt', 'createdAt', 'updatedAt'
        ];
        for (const field of financeVisibleFields) {
          if (Object.prototype.hasOwnProperty.call(ad || {}, field)) {
            financeView[field] = (ad as any)[field];
          }
        }
        return financeView;
      });

      return res.json({ success: true, advertisements: financeCampaigns });
    }

    const authUserId = user?.userId || user?.id ? String(user.userId || user.id).trim() : '';
    const publicActiveAds = await AdRepository.getAllAsync({ status: 'active', placement });

    let combinedAds: any[] = [...publicActiveAds];
    if (authUserId) {
      const allPlacementAds = await AdRepository.getAllAsync({ status, placement });
      const ownAds = allPlacementAds.filter(
        (ad: any) => ad && ad.submittedByUserId && String(ad.submittedByUserId) === authUserId
      );
      const seenIds = new Set<string>();
      const merged: any[] = [];
      for (const ad of [...ownAds, ...publicActiveAds]) {
        if (ad && ad.id && !seenIds.has(String(ad.id))) {
          seenIds.add(String(ad.id));
          merged.push(ad);
        }
      }
      combinedAds = merged;
    }

    const ads = combinedAds.map((ad: any) => {
      const isOwnAd = Boolean(authUserId && ad?.submittedByUserId && String(ad.submittedByUserId) === authUserId);
      if (isOwnAd) {
        return {
          ...ad,
          submittedByUserId: String(ad.submittedByUserId)
        };
      }
      const { clientEmail, submittedByUserEmail, submittedByUserId, submittedByUserPhone, ...publicAd } = ad || {};
      return publicAd;
    });

    res.json({ success: true, advertisements: ads });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching advertisements' });
  }
});

// 2. Create Advertisement
adRouter.post('/', requireAuth, async (req: any, res) => {
  try {
    const adData = { ...(req.body || {}) };
    const authUserId = req.user?.userId || req.user?.id;
    const isAdmin =
      req.user?.role === 'Admin' ||
      req.user?.role === 'Super Admin' ||
      Boolean(req.user && hasAdminPermission(req.user.role, 'advertisements.manage'));

    const walletTxId = adData.walletTxId || adData.paymentTransactionId || adData.transactionId;
    const idempotencyKey =
      (typeof adData.idempotencyKey === 'string' && adData.idempotencyKey.trim()) ||
      (typeof req.headers['x-idempotency-key'] === 'string' && req.headers['x-idempotency-key'].trim()) ||
      undefined;

    const creationLockKey = String(walletTxId || idempotencyKey || `${authUserId || 'anon'}:${adData.id || ''}`).trim();
    if (creationLockKey && activeAdCreationLocks.has(creationLockKey)) {
      return res.status(409).json({
        success: false,
        message: 'This advertisement campaign submission is currently being processed. Please wait.'
      });
    }

    if (creationLockKey) {
      activeAdCreationLocks.add(creationLockKey);
    }

    try {
      // 1. Idempotency protection: check if campaign was already created for this transaction or idempotency key
      if (walletTxId) {
        const existingByTx = AdRepository.findByWalletTxId(String(walletTxId));
        if (existingByTx) {
          if (!isAdmin && existingByTx.submittedByUserId && String(existingByTx.submittedByUserId) !== String(authUserId)) {
            return res.status(403).json({
              success: false,
              message: 'Forbidden: Payment transaction is already linked to another user campaign.'
            });
          }
          try {
            PaymentRepository.linkAdvertisement(String(existingByTx.walletTxId || walletTxId), existingByTx.id, existingByTx.title);
          } catch {}
          return res.status(200).json({
            success: true,
            advertisement: existingByTx,
            message: 'Advertisement campaign already created for this transaction (idempotent result).'
          });
        }
      }

      if (idempotencyKey) {
        const existingByKey = AdRepository.findByIdempotencyKey(idempotencyKey);
        if (existingByKey) {
          if (!isAdmin && existingByKey.submittedByUserId && String(existingByKey.submittedByUserId) !== String(authUserId)) {
            return res.status(403).json({
              success: false,
              message: 'Forbidden: Cannot access another user campaign.'
            });
          }
          return res.status(200).json({
            success: true,
            advertisement: existingByKey,
            message: 'Advertisement campaign already created (idempotent result).'
          });
        }
      }

      const adPricingInput =
        adData.adPricingOptions && typeof adData.adPricingOptions === 'object' && Object.keys(adData.adPricingOptions).length > 0
          ? adData.adPricingOptions
          : {
              placement: adData.placement,
              type: adData.type,
              durationUnit: adData.durationUnit,
              durationValue: adData.durationValue,
              durationPresetId: adData.durationPresetId || adData.selectedDurationId,
              selectedDurationId: adData.selectedDurationId || adData.durationPresetId,
              targetPages: adData.targetPages,
              smsRecipientsCount:
                adData.type === 'sms' || adData.placement === 'sms-broadcast'
                  ? adData.smsRecipientsCount
                  : 0
            };

      // 2. Strictly enforce verified Advertisement wallet transaction for non-admin campaigns (and any campaign supplying walletTxId)
      if (!isAdmin || walletTxId) {
        // Never trust client-supplied paymentStatus or campaignCostPkr
        delete adData.paymentStatus;
        delete adData.campaignCostPkr;

        let verifiedTx: any = null;
        if (walletTxId) {
          verifiedTx =
            PaymentRepository.getById(String(walletTxId)) ||
            PaymentRepository.findByTransactionId(String(walletTxId));
        }
        if (!verifiedTx && idempotencyKey) {
          verifiedTx = PaymentRepository.findByIdempotencyKey(idempotencyKey);
        }

        if (!verifiedTx) {
          return res.status(400).json({
            success: false,
            message: 'A verified Advertisement wallet payment transaction is required before creating a campaign.'
          });
        }

        if (verifiedTx.type !== 'Advertisement') {
          return res.status(400).json({
            success: false,
            message: 'Invalid payment transaction type for advertisement campaign.'
          });
        }

        if (!isAdmin && String(verifiedTx.userId || '') !== String(authUserId)) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Payment transaction does not belong to the authenticated user.'
          });
        }

        const alreadyLinkedAd = AdRepository.findByWalletTxId(String(verifiedTx.id));
        if (alreadyLinkedAd) {
          if (!isAdmin && alreadyLinkedAd.submittedByUserId && String(alreadyLinkedAd.submittedByUserId) !== String(authUserId)) {
            return res.status(403).json({
              success: false,
              message: 'Forbidden: Payment transaction is already linked to another campaign.'
            });
          }
          try {
            PaymentRepository.linkAdvertisement(verifiedTx.id, alreadyLinkedAd.id, alreadyLinkedAd.title);
          } catch {}
          return res.status(200).json({
            success: true,
            advertisement: alreadyLinkedAd,
            message: 'Advertisement campaign already created for this transaction (idempotent result).'
          });
        }

        // If the payment transaction was already compensated/refunded after a previous campaign creation failure,
        // return the safe idempotent state without refunding again and without reusing the transaction as a valid payment.
        if (PaymentRepository.isTransactionCompensated(verifiedTx)) {
          return res.status(409).json({
            success: false,
            compensated: true,
            alreadyCompensated: true,
            restoredAmount: 0,
            originalRestoredAmount: Number(verifiedTx.refundedAmount ?? verifiedTx.amount ?? 0),
            refundReferenceId: verifiedTx.refundReferenceId,
            transaction: verifiedTx,
            message:
              'Advertisement payment transaction was already refunded/compensated after a previous campaign creation failure and cannot be reused or refunded again.'
          });
        }

        if (verifiedTx.paymentMethod !== 'Wallet Balance' || verifiedTx.status !== 'Success') {
          return res.status(400).json({
            success: false,
            message: 'Advertisement wallet payment transaction has not been completed.'
          });
        }

        // 3. Payment is verified as a completed, uncompensated Advertisement Wallet Balance transaction owned by user.
        // If campaign creation fails at any point below, safely compensate the user's wallet exactly once.
        let newAd: any = null;
        let calc: any = null;
        try {
          calc = await PricingRepository.calculateAdPrice(adPricingInput);

          if (Number(verifiedTx.amount) !== Number(calc.finalPrice)) {
            const mismatchErr: any = new Error(
              `Payment transaction amount (${verifiedTx.amount} PKR) does not match authoritative campaign price (${calc.finalPrice} PKR).`
            );
            mismatchErr.statusCode = 400;
            throw mismatchErr;
          }

          if (adData.simulateFailure === true || adData.simulateCreationFailure === true) {
            throw new Error('Simulated campaign creation failure.');
          }

          if (!adData.title || typeof adData.title !== 'string' || !adData.title.trim()) {
            const titleErr: any = new Error('A valid campaign title is required to create an advertisement.');
            titleErr.statusCode = 400;
            throw titleErr;
          }

          if (!isAdmin) {
            delete adData.id;
            adData.submittedByUserId = authUserId;
            adData.submittedByUserName = req.user.name || adData.submittedByUserName;
            adData.submittedByUserEmail = req.user.email || adData.submittedByUserEmail;
            adData.status = 'pending';
            adData.approvalStatus = 'Pending';
          }

          adData.placement = calc.placement;
          adData.durationUnit = calc.durationUnit;
          adData.durationValue = calc.durationValue;
          adData.durationDisplay = calc.durationDisplay;
          adData.targetPages = calc.targetPages;
          if (adData.type === 'sms' || calc.placement === 'sms-broadcast') {
            adData.smsRecipientsCount = calc.smsRecipientsCount;
          }
          adData.campaignCostPkr = calc.finalPrice;
          adData.budget = calc.finalPrice;
          if (calc.finalPrice > 0) {
            adData.paymentStatus = 'Escrow';
            adData.escrowStatus = 'HELD';
            adData.escrowAmountPkr = calc.finalPrice;
          } else {
            adData.paymentStatus = 'Exempt';
            delete adData.escrowStatus;
            delete adData.escrowAmountPkr;
          }
          adData.walletTxId = verifiedTx.id;
          adData.paymentTransactionId = verifiedTx.id;
          adData.transactionRef = verifiedTx.transactionId || verifiedTx.id;
          if (idempotencyKey || verifiedTx.idempotencyKey) {
            adData.idempotencyKey = idempotencyKey || verifiedTx.idempotencyKey;
          }

          newAd = await AdRepository.createAsync(adData);
          if (!newAd || !newAd.id) {
            throw new Error('Failed to persist advertisement campaign record.');
          }
        } catch (creationErr: any) {
          const compensation = await PaymentRepository.compensateAdvertisementPayment(String(verifiedTx.id), {
            authenticatedUserId: String(authUserId),
            isAdmin,
            failureReason: creationErr?.message || 'Error creating advertisement campaign after wallet deduction.',
            adIdRef: adData.id,
            adTitleRef: adData.title,
            idempotencyKey: idempotencyKey || verifiedTx.idempotencyKey,
            actorName: req.user?.name || adData.submittedByUserName || adData.clientName
          });

          const statusCode =
            typeof creationErr?.statusCode === 'number' && creationErr.statusCode >= 400
              ? creationErr.statusCode
              : 500;

          return res.status(statusCode).json({
            success: false,
            compensated: compensation.compensated,
            alreadyCompensated: compensation.alreadyCompensated,
            restoredAmount: compensation.restoredAmount,
            refundReferenceId: compensation.refundReferenceId,
            transaction: compensation.transaction,
            message: `${creationErr?.message || 'Error creating advertisement'} — Wallet payment of PKR ${verifiedTx.amount} has been safely restored.`,
            ...(compensation.auditPersisted === false
              ? { auditPersisted: false, auditWarning: compensation.auditWarning }
              : {})
          });
        }

        try {
          PaymentRepository.linkAdvertisement(verifiedTx.id, newAd.id, newAd.title);
        } catch {}

        const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
          user: req.user?.name || 'Advertiser',
          role: req.user?.role || 'Advertiser',
          action: 'Ad Campaign Created',
          target: newAd.title,
          status: 'Success',
          metadata: {
            adId: newAd.id,
            walletTxId: verifiedTx.id,
            transactionId: verifiedTx.transactionId,
            amount: calc.finalPrice
          }
        }, 'POST /api/ads (wallet)');

        return res.status(201).json({
          success: true,
          advertisement: newAd,
          ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
        });
      }

      const newAd = await AdRepository.createAsync(adData);

      const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
        user: req.user?.name || 'Advertiser',
        role: req.user?.role || 'Advertiser',
        action: 'Ad Campaign Created',
        target: newAd.title,
        status: 'Success'
      }, 'POST /api/ads');

      return res.status(201).json({
        success: true,
        advertisement: newAd,
        ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
      });
    } finally {
      if (creationLockKey) {
        activeAdCreationLocks.delete(creationLockKey);
      }
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating advertisement' });
  }
});

// 3. Administrator campaign review: capture escrow on approval or release/refund it on rejection.
adRouter.patch('/:id/review', requireAuth, async (req: any, res) => {
  try {
    const role = String(req.user?.role || '');
    const action = String(req.body?.action || '');
    const canManageAds = hasAdminPermission(role, 'advertisements.manage');
    const canManageFinance = hasAdminPermission(role, 'finance.manage');
    if (!['approve', 'refund'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Review action must be approve or refund.' });
    }
    if (action === 'approve' && !canManageAds) {
      return res.status(403).json({ success: false, message: 'Advertisement management permission is required to approve campaigns.' });
    }
    if (action === 'refund' && !canManageAds && !canManageFinance) {
      return res.status(403).json({ success: false, message: 'Advertisement or Finance permission is required to reject and refund campaigns.' });
    }

    const existingAd = AdRepository.getById(String(req.params.id));
    if (!existingAd) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    const amount = Number(existingAd.campaignCostPkr || 0);
    const hasWalletPayment = Boolean(existingAd.walletTxId || existingAd.paymentTransactionId);
    let settlement: any = null;
    if (hasWalletPayment && existingAd.paymentStatus !== 'Exempt' && amount > 0) {
      const txId = String(existingAd.walletTxId || existingAd.paymentTransactionId);
      settlement = await PaymentRepository.resolveAdvertisementEscrow(
        txId,
        action as 'approve' | 'refund',
        req.user?.name || role || 'Administrator',
        typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : undefined
      );
    } else if (action === 'refund' && existingAd.paymentStatus === 'Paid' && amount > 0) {
      return res.status(409).json({
        success: false,
        message: 'This paid campaign has no linked wallet transaction. Refund was not attempted; finance reconciliation is required.'
      });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 16);
    let updates: Record<string, any>;
    if (action === 'approve') {
      const endDate = new Date(now);
      const duration = Math.max(1, Number(existingAd.durationValue || 1));
      if (existingAd.durationUnit === 'hours') endDate.setHours(endDate.getHours() + duration);
      else if (existingAd.durationUnit === 'weeks') endDate.setDate(endDate.getDate() + duration * 7);
      else if (existingAd.durationUnit === 'months') endDate.setMonth(endDate.getMonth() + duration);
      else endDate.setDate(endDate.getDate() + duration);
      updates = {
        status: 'active',
        approvalStatus: 'Approved',
        paymentStatus: amount > 0 && hasWalletPayment && existingAd.paymentStatus !== 'Exempt' ? 'Paid' : amount <= 0 && existingAd.paymentStatus === 'Escrow' ? 'Exempt' : existingAd.paymentStatus,
        escrowStatus: hasWalletPayment && amount > 0 ? 'CAPTURED' : existingAd.escrowStatus,
        approvedAt: timestamp,
        approvedBy: req.user?.name || 'Admin',
        scheduledStartAt: existingAd.scheduledStartAt || now.toISOString().slice(0, 10),
        scheduledEndAt: existingAd.scheduledEndAt || endDate.toISOString().slice(0, 10),
        rejectionReason: undefined
      };
    } else {
      updates = {
        status: 'rejected',
        approvalStatus: 'Rejected',
        paymentStatus: settlement?.refundReferenceId ? 'Refunded' : amount <= 0 && existingAd.paymentStatus === 'Escrow' ? 'Exempt' : existingAd.paymentStatus,
        escrowStatus: hasWalletPayment && amount > 0 ? 'RELEASED' : existingAd.escrowStatus,
        rejectionReason: typeof req.body?.reason === 'string' && req.body.reason.trim()
          ? req.body.reason.trim().slice(0, 1000)
          : 'Rejected by administrator',
        rejectedAt: timestamp
      };
    }

    const updated = await AdRepository.updateAsync(String(req.params.id), updates);
    if (!updated) return res.status(404).json({ success: false, message: 'Campaign could not be updated.' });
    return res.json({
      success: true,
      advertisement: updated,
      transaction: settlement?.transaction,
      refundReferenceId: settlement?.refundReferenceId,
      alreadySettled: settlement?.alreadySettled === true,
      message: action === 'approve'
        ? 'Campaign approved and escrow captured.'
        : settlement?.refundReferenceId
          ? 'Campaign rejected and wallet funds refunded.'
          : 'Campaign rejected.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Campaign review failed.' });
  }
});

// 4. Update Advertisement
adRouter.put('/:id', requireAuth, async (req: any, res) => {
  try {
    const role = String(req.user?.role || '');
    const canManageAds = hasAdminPermission(role, 'advertisements.manage');
    const canManageFinance = hasAdminPermission(role, 'finance.manage');
    if (!canManageAds && !canManageFinance) {
      return res.status(403).json({ success: false, message: 'Access denied: Advertisement or Finance permission required.' });
    }

    const existingAd = AdRepository.getById(req.params.id);
    if (!existingAd) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }

    const updates = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (
      existingAd.paymentStatus === 'Escrow' &&
      (Object.prototype.hasOwnProperty.call(updates, 'status') ||
        Object.prototype.hasOwnProperty.call(updates, 'approvalStatus') ||
        Object.prototype.hasOwnProperty.call(updates, 'paymentStatus'))
    ) {
      return res.status(409).json({
        success: false,
        message: 'Campaign funds are held in escrow. Use the dedicated Approve or Reject & Refund action to settle the wallet safely.'
      });
    }
    if (
      (existingAd.walletTxId || existingAd.paymentTransactionId) &&
      (updates.status === 'rejected' ||
        updates.approvalStatus === 'Rejected' ||
        updates.paymentStatus === 'Refunded' ||
        (existingAd.approvalStatus === 'Pending' && (updates.status === 'active' || updates.approvalStatus === 'Approved')) ||
        (Object.prototype.hasOwnProperty.call(updates, 'escrowStatus') && updates.escrowStatus !== existingAd.escrowStatus))
    ) {
      return res.status(409).json({
        success: false,
        message: 'Wallet-backed campaign approval, rejection, and refunds must use the dedicated review action so escrow cannot be bypassed.'
      });
    }
    // updatedAt is server-managed by the repository and must never be trusted from the client.
    const changedFields = Object.keys(updates).filter(
      (key) => key !== 'updatedAt' && JSON.stringify((existingAd as any)[key]) !== JSON.stringify(updates[key])
    );
    const isFullAdmin = role === 'Admin' || role === 'Super Admin';

    // Only fields used by the existing campaign-operation and creative UI are editable
    // by Advertisement Managers. Identity, ownership, payment references and unknown
    // properties remain immutable for delegated roles.
    const advertisementEditableFields = new Set([
      'title', 'type', 'placement', 'status', 'approvalStatus', 'targetPages',
      'durationUnit', 'durationValue', 'durationDisplay', 'scheduledStartAt',
      'scheduledEndAt', 'approvedAt', 'rejectionReason', 'rejectedAt',
      'headline', 'bodyText', 'imageUrl', 'ctaText', 'ctaUrl', 'badgeText',
      'theme', 'dismissable', 'autoCloseDelay', 'smsSenderId', 'smsAudience'
    ]);
    const financeWaiverFields = new Set(['paymentStatus', 'campaignCostPkr']);

    let safeUpdates: Record<string, any> = updates;
    if (!isFullAdmin) {
      const unsupportedFields = changedFields.filter((key) =>
        canManageAds
          ? !advertisementEditableFields.has(key) && !(canManageFinance && financeWaiverFields.has(key))
          : !financeWaiverFields.has(key)
      );

      if (unsupportedFields.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: One or more campaign fields are not editable with this role.'
        });
      }

      const changedFinanceFields = changedFields.filter((key) => financeWaiverFields.has(key));
      if (changedFinanceFields.length > 0) {
        if (!canManageFinance) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: Finance permission is required to waive campaign fees.'
          });
        }
        if (updates.paymentStatus !== 'Exempt' || Number(updates.campaignCostPkr) !== 0) {
          return res.status(403).json({
            success: false,
            message: 'Finance Managers may only apply the approved fee-waiver action (Exempt / PKR 0).'
          });
        }
      }

      if (changedFields.length > 0 && !canManageAds && changedFinanceFields.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Advertisement management permission is required for campaign operations.'
        });
      }

      // Never pass unchanged client-supplied fields to the repository. This prevents
      // full-object UI payloads from writing protected ownership/payment metadata.
      safeUpdates = Object.fromEntries(changedFields.map((key) => [key, updates[key]]));
    }

    const updated = await AdRepository.updateAsync(req.params.id, safeUpdates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }

    res.json({ success: true, advertisement: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating advertisement' });
  }
});

// 4. Delete Advertisement
adRouter.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    const authUserId = user?.userId || user?.id ? String(user.userId || user.id).trim() : '';
    if (!user || !authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const canManageAds =
      user.role === 'Admin' ||
      user.role === 'Super Admin' ||
      Boolean(hasAdminPermission(user.role, 'advertisements.manage'));

    const existingAd = AdRepository.getById(req.params.id);
    if (!existingAd) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }

    if (
      existingAd.paymentStatus === 'Escrow' ||
      (Boolean(existingAd.walletTxId || existingAd.paymentTransactionId) && existingAd.approvalStatus === 'Pending')
    ) {
      return res.status(409).json({
        success: false,
        message: 'This campaign has wallet funds held in escrow. It must be approved or rejected with refund before it can be deleted.'
      });
    }

    if (!canManageAds) {
      if (!existingAd.submittedByUserId || String(existingAd.submittedByUserId) !== authUserId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only delete your own advertisement campaigns.'
        });
      }
    }

    const deleted = await AdRepository.deleteAsync(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }
    res.json({ success: true, message: 'Advertisement deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error deleting advertisement' });
  }
});

// 5. Track Click (Server-authoritative CPC billing against advertiser wallet)
adRouter.post('/:id/click', authMiddleware, async (req: any, res) => {
  try {
    const idempotencyKey = req.body?.idempotencyKey || (req.headers['x-idempotency-key'] as string);
    const updated = await AdRepository.trackClickAsync(req.params.id, {
      idempotencyKey,
      authUser: req.user
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ad campaign not found' });
    }
    res.json({ success: true, advertisement: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to record ad click' });
  }
});

// 6. Track Impression (Server-authoritative CPM billing against advertiser wallet)
adRouter.post('/:id/impression', authMiddleware, async (req: any, res) => {
  try {
    const idempotencyKey = req.body?.idempotencyKey || (req.headers['x-idempotency-key'] as string);
    const updated = await AdRepository.trackImpressionAsync(req.params.id, {
      idempotencyKey,
      authUser: req.user
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ad campaign not found' });
    }
    res.json({ success: true, advertisement: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to record ad impression' });
  }
});
