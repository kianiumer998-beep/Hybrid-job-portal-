import { Router } from 'express';
import { SubscriberRepository } from '../db/repositories/SubscriberRepository';
import { FeatureFlagsRepository } from '../db/repositories/FeatureFlagsRepository';
import { requireAdminPermission } from '../auth/authManager';

export const subscriberRouter = Router();

// ============================================================================
// 1. PUBLIC / NARROWLY SCOPED PENDING SUBSCRIPTION CREATION (Rules 52-60)
// ============================================================================
subscriberRouter.post('/pending', async (req: any, res) => {
  try {
    const { paymentTransactionId, name, email, phone, whatsappEnabled, status, senderPhoneOrAccount } = req.body || {};

    if (!paymentTransactionId || typeof paymentTransactionId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid paymentTransactionId is required to create a pending subscription.'
      });
    }

    // Rule 57: The public creation endpoint must never accept an arbitrary Active status.
    if (status && status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Subscription creation can only enter Pending status awaiting administrator verification.'
      });
    }

    const authUserId = req.user ? req.user.userId || req.user.id : undefined;
    const authUserEmail = req.user ? req.user.email : undefined;

    const flags = await FeatureFlagsRepository.getFlags();
    const effectiveWhatsappEnabled = flags?.enableWhatsAppAlerts === true && whatsappEnabled === true;

    const subscriber = await SubscriberRepository.createPendingSubscription({
      paymentTransactionId,
      authUserId,
      authUserEmail,
      guestName: name,
      guestEmail: email,
      guestPhone: phone,
      whatsappEnabled: effectiveWhatsappEnabled,
      senderPhoneOrAccount
    });

    return res.status(201).json({
      success: true,
      subscriber
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed to create subscription record.';
    if (msg.includes('Access denied') || msg.includes('not authorized')) {
      return res.status(403).json({ success: false, message: msg });
    }
    if (msg.includes('not found') || msg.includes('does not match') || msg.includes('validation error')) {
      return res.status(400).json({ success: false, message: msg });
    }
    return res.status(500).json({ success: false, message: msg });
  }
});

// ============================================================================
// 2. ADMINISTRATIVE SUBSCRIBER MANAGEMENT (Requires users.manage permission)
// ============================================================================

// GET /api/subscribers - Get all subscribers
subscriberRouter.get('/', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const subscribers = await SubscriberRepository.getAllSubscribers();
    return res.json({
      success: true,
      subscribers
    });
  } catch (err: any) {
    console.error('[SubscriberRouter] Error fetching subscribers:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to retrieve subscriber records.'
    });
  }
});

// GET /api/subscribers/:id - Get a single subscriber
subscriberRouter.get('/:id', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const subscriber = await SubscriberRepository.getById(req.params.id);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: `Subscriber '${req.params.id}' was not found.`
      });
    }
    return res.json({
      success: true,
      subscriber
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to retrieve subscriber record.'
    });
  }
});

// POST /api/subscribers - Create a subscriber administratively
subscriberRouter.post('/', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const subscriber = await SubscriberRepository.createAdminSubscriber(req.body);
    return res.status(201).json({
      success: true,
      subscriber
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed to create subscriber.';
    const isValidation = msg.includes('Validation') || msg.includes('already exists');
    return res.status(isValidation ? 400 : 500).json({
      success: false,
      message: msg
    });
  }
});

// PUT /api/subscribers/:id - Update an existing subscriber
subscriberRouter.put('/:id', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const updated = await SubscriberRepository.updateSubscriber(req.params.id, req.body);
    return res.json({
      success: true,
      subscriber: updated
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed to update subscriber.';
    const isNotFound = msg.includes('not found');
    const isValidation = msg.includes('Validation') || msg.includes('required');
    return res.status(isNotFound ? 404 : isValidation ? 400 : 500).json({
      success: false,
      message: msg
    });
  }
});

// DELETE /api/subscribers/:id - Delete a single subscriber
subscriberRouter.delete('/:id', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const deleted = await SubscriberRepository.deleteSubscriber(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Subscriber '${req.params.id}' was not found or could not be deleted.`
      });
    }
    return res.json({
      success: true,
      deletedId: req.params.id
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to delete subscriber.'
    });
  }
});

// POST /api/subscribers/bulk-delete - Bulk delete subscribers
subscriberRouter.post('/bulk-delete', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const ids = req.body.subscriberIds || req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'subscriberIds array is required for bulk deletion.'
      });
    }

    const deletedCount = await SubscriberRepository.bulkDeleteSubscribers(ids);
    return res.json({
      success: true,
      deletedCount
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to bulk-delete subscribers.'
    });
  }
});

// POST /api/subscribers/import-legacy - Import legacy LocalStorage subscribers
subscriberRouter.post('/import-legacy', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const records = req.body?.records;
    if (!Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: records must be an array.'
      });
    }

    const result = await SubscriberRepository.importLegacySubscribers(records);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        importedCount: result.importedCount,
        verifiedCount: result.verifiedCount,
        alreadyRepresentedCount: result.alreadyRepresentedCount,
        skippedCount: result.skippedCount,
        errors: result.errors,
        message: 'Legacy subscriber migration validation failed.'
      });
    }

    return res.json({
      success: true,
      importedCount: result.importedCount,
      verifiedCount: result.verifiedCount,
      alreadyRepresentedCount: result.alreadyRepresentedCount,
      skippedCount: result.skippedCount,
      records: result.records
    });
  } catch (err: any) {
    console.error('[SubscriberRouter] Error importing legacy subscribers:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to import legacy subscribers.'
    });
  }
});
