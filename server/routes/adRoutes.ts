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
    const canManageAds = Boolean(user && hasAdminPermission(user.role, 'advertisements.manage'));

    if (canManageAds) {
      const rawAds = await AdRepository.getAllAsync({ status, placement });
      return res.json({ success: true, advertisements: rawAds });
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
          calc = PricingRepository.calculateAdPrice(adPricingInput);

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
          adData.paymentStatus = 'Paid';
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
            message: `${creationErr?.message || 'Error creating advertisement'} — Wallet payment of PKR ${verifiedTx.amount} has been safely restored.`
          });
        }

        try {
          PaymentRepository.linkAdvertisement(verifiedTx.id, newAd.id, newAd.title);
        } catch {}

        try {
          AuditRepository.add({
            user: adData.submittedByUserName || adData.clientName || 'Advertiser',
            role: 'Advertiser',
            action: 'Ad Campaign Created',
            target: newAd.title,
            status: 'Success',
            metadata: {
              adId: newAd.id,
              walletTxId: verifiedTx.id,
              transactionId: verifiedTx.transactionId,
              amount: calc.finalPrice
            }
          });
        } catch {}

        return res.status(201).json({ success: true, advertisement: newAd });
      }

      const newAd = await AdRepository.createAsync(adData);

      try {
        AuditRepository.add({
          user: adData.submittedByUserName || adData.clientName || 'Advertiser',
          role: 'Advertiser',
          action: 'Ad Campaign Created',
          target: newAd.title,
          status: 'Success'
        });
      } catch {}

      return res.status(201).json({ success: true, advertisement: newAd });
    } finally {
      if (creationLockKey) {
        activeAdCreationLocks.delete(creationLockKey);
      }
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating advertisement' });
  }
});

// 3. Update Advertisement
adRouter.put('/:id', requireAdminPermission('advertisements.manage'), async (req, res) => {
  try {
    const updated = await AdRepository.updateAsync(req.params.id, req.body);
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
