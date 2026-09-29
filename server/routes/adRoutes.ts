import { Router } from 'express';
import { AdRepository, AuditRepository, PaymentRepository, PricingRepository } from '../db/repositories';
import { requireAdminPermission, requireAuth, authMiddleware, hasAdminPermission } from '../auth/authManager';

export const adRouter = Router();

// 1. Get Ads (Public active ads or all for admin)
adRouter.get('/', async (req, res) => {
  try {
    const { status, placement } = req.query as Record<string, string>;
    const user = (req as any).user;
    const canManageAds = Boolean(user && hasAdminPermission(user.role, 'advertisements.manage'));
    const effectiveStatus = canManageAds ? status : 'active';
    const rawAds = await AdRepository.getAllAsync({ status: effectiveStatus, placement });
    const ads = canManageAds
      ? rawAds
      : rawAds.map(({ clientEmail, submittedByUserEmail, submittedByUserId, ...publicAd }: any) => publicAd);
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
        PaymentRepository.linkAdvertisement(String(existingByTx.walletTxId || walletTxId), existingByTx.id, existingByTx.title);
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

    // 2. Authoritative campaign pricing calculation using STEP 55B-1 PricingRepository.calculateAdPrice
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
    const calc = PricingRepository.calculateAdPrice(adPricingInput);

    // 3. Strictly enforce verified Advertisement wallet transaction for non-admin campaigns (and any campaign supplying walletTxId)
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

      if (verifiedTx.paymentMethod !== 'Wallet Balance' || verifiedTx.status !== 'Success') {
        return res.status(400).json({
          success: false,
          message: 'Advertisement wallet payment transaction has not been completed.'
        });
      }

      if (Number(verifiedTx.amount) !== Number(calc.finalPrice)) {
        return res.status(400).json({
          success: false,
          message: `Payment transaction amount (${verifiedTx.amount} PKR) does not match authoritative campaign price (${calc.finalPrice} PKR).`
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
        PaymentRepository.linkAdvertisement(verifiedTx.id, alreadyLinkedAd.id, alreadyLinkedAd.title);
        return res.status(200).json({
          success: true,
          advertisement: alreadyLinkedAd,
          message: 'Advertisement campaign already created for this transaction (idempotent result).'
        });
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

      const newAd = await AdRepository.createAsync(adData);
      PaymentRepository.linkAdvertisement(verifiedTx.id, newAd.id, newAd.title);

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

      return res.status(201).json({ success: true, advertisement: newAd });
    }

    const newAd = await AdRepository.createAsync(adData);

    AuditRepository.add({
      user: adData.submittedByUserName || adData.clientName || 'Advertiser',
      role: 'Advertiser',
      action: 'Ad Campaign Created',
      target: newAd.title,
      status: 'Success'
    });

    res.status(201).json({ success: true, advertisement: newAd });
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
adRouter.delete('/:id', requireAdminPermission('advertisements.manage'), async (req, res) => {
  try {
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
