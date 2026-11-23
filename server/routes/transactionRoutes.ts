import { Router } from 'express';
import {
  PaymentRepository,
  AuditRepository,
  UserRepository,
  PricingRepository,
  JobRepository,
  PaymentSettingsRepository,
  NotificationRepository,
  MongoDuplicateTransactionError,
  TransactionIndexInitializationError,
  InvalidIdempotencyKeyError,
  normalizeIdempotencyKey
} from '../db/repositories';
import type { PublicPaymentSettings, PublicPaymentMethodConfig, CustomProofField } from '../../src/types/adminPayment';
import { Database } from '../db/database';
import { requireAdminPermission, requireAuth } from '../auth/authManager';
import { resolveSubscriptionPackage } from '../services/subscriptionEntitlements';

export const transactionRouter = Router();

// Lightweight in-memory concurrency locks to prevent per-user wallet double-spend and concurrent transaction verification races
const activeUserTransactionLocks = new Set<string>();
const activeTransactionVerificationLocks = new Set<string>();

type WalletMutationState =
  | 'NONE'
  | 'DEDUCTING'
  | 'DEDUCTED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'ROLLBACK_FAILED'
  | 'UNCERTAIN';

const UNCERTAIN_OR_ACTIVE_WALLET_STATES = new Set<WalletMutationState>([
  'DEDUCTING',
  'DEDUCTED',
  'ROLLING_BACK',
  'ROLLBACK_FAILED',
  'UNCERTAIN'
]);

function isTransactionWalletStateLocked(tx: any): boolean {
  if (!tx) return false;
  const state = String(tx.walletMutationState || '') as WalletMutationState;
  return UNCERTAIN_OR_ACTIVE_WALLET_STATES.has(state);
}

function canSafelyMarkTransactionFailed(state: WalletMutationState): boolean {
  return state === 'NONE' || state === 'ROLLED_BACK';
}

async function persistTransactionState(
  txId: string,
  updates: Record<string, any>,
  verifyField?: { key: string; expected: any }
): Promise<any> {
  const updated = await PaymentRepository.updateAsync(txId, updates);
  if (!updated) {
    throw new Error(`Transaction ${txId} not found in storage.`);
  }

  if (verifyField) {
    const reloaded = await PaymentRepository.getByIdAsync(txId);
    if (!reloaded || reloaded[verifyField.key] !== verifyField.expected) {
      throw new Error(`Failed to persist durable transaction state (${verifyField.key}=${String(verifyField.expected)}).`);
    }
    return reloaded;
  }

  return updated;
}

function isDuplicateTransactionError(err: any): boolean {
  return Boolean(
    err instanceof MongoDuplicateTransactionError ||
    err?.code === 11000 ||
    err?.code === '11000'
  );
}

function isIndexReadinessError(err: any): boolean {
  return Boolean(
    err instanceof TransactionIndexInitializationError ||
    err?.code === 'TRANSACTION_INDEX_NOT_READY'
  );
}

function isInvalidIdempotencyKeyError(err: any): boolean {
  return Boolean(
    err instanceof InvalidIdempotencyKeyError ||
    err?.code === 'INVALID_IDEMPOTENCY_KEY'
  );
}

function sendSafeTransactionError(res: any, err: any, fallbackMessage: string) {
  if (isInvalidIdempotencyKeyError(err)) {
    return res.status(400).json({
      success: false,
      message: err?.message || 'Invalid idempotencyKey.'
    });
  }
  if (isDuplicateTransactionError(err)) {
    return res.status(409).json({
      success: false,
      message: 'A transaction with this payment reference or idempotency key has already been recorded.'
    });
  }
  if (isIndexReadinessError(err)) {
    return res.status(503).json({
      success: false,
      message: 'Transaction storage is temporarily not ready. Please try again shortly; no new payment was submitted.'
    });
  }
  if (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      success: false,
      message: typeof err?.message === 'string' ? err.message : fallbackMessage
    });
  }
  const rawMessage = typeof err?.message === 'string' ? err.message : '';
  const safeMessage =
    rawMessage && !/mongodb|e11000|keyvalue|duplicate key/i.test(rawMessage)
      ? rawMessage
      : fallbackMessage;
  return res.status(500).json({ success: false, message: safeMessage });
}

// 1. Get transactions (all for admin, or scoped to authenticated user)
transactionRouter.get('/', requireAuth, async (req, res) => {
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

    const txs = await PaymentRepository.getAllAsync(targetUserId);
    res.json({ success: true, transactions: txs });
  } catch (err: any) {
    return sendSafeTransactionError(res, err, 'Error fetching transactions');
  }
});

function resolvePaymentMethod(
  rawMethod: string,
  settings: PublicPaymentSettings
): { method?: PublicPaymentMethodConfig; error?: string } {
  if (!rawMethod || typeof rawMethod !== 'string') {
    return { error: 'Payment method is required.' };
  }

  const cleanRaw = rawMethod.trim().toLowerCase();
  const allMethods: PublicPaymentMethodConfig[] = Object.values(settings?.methods || {});

  // Collect all currently enabled methods that have an account title and account number
  const enabledMethods = allMethods.filter(
    (m) => m && m.enabled && m.accountTitle && m.accountNumber
  );

  if (enabledMethods.length === 0) {
    return { error: 'No manual payment methods are currently enabled by the administrator.' };
  }

  // 1. Exact ID match (case-insensitive)
  const idMatches = enabledMethods.filter((m) => m.id.toLowerCase() === cleanRaw);
  if (idMatches.length === 1) {
    return { method: idMatches[0] };
  }

  // 2. Exact Name match (case-insensitive)
  const nameMatches = enabledMethods.filter((m) => m.name.trim().toLowerCase() === cleanRaw);
  if (nameMatches.length === 1) {
    return { method: nameMatches[0] };
  }

  // 3. Fallback normalized match for standard base methods (bank transfer / easypaisa / jazzcash)
  let aliasMatches: PublicPaymentMethodConfig[] = [];
  if (cleanRaw === 'bank' || cleanRaw === 'bank transfer' || cleanRaw.startsWith('bank transfer')) {
    aliasMatches = enabledMethods.filter((m) => m.id === 'bank');
  } else if (cleanRaw === 'easypaisa' || cleanRaw === 'easy paisa' || cleanRaw.startsWith('easypaisa')) {
    aliasMatches = enabledMethods.filter((m) => m.id === 'easypaisa');
  } else if (cleanRaw === 'jazzcash' || cleanRaw === 'jazz cash' || cleanRaw.startsWith('jazzcash')) {
    aliasMatches = enabledMethods.filter((m) => m.id === 'jazzcash');
  }

  if (aliasMatches.length === 1) {
    return { method: aliasMatches[0] };
  }

  // Check if it matched multiple (ambiguous)
  const combined = Array.from(new Set([...idMatches, ...nameMatches, ...aliasMatches]));
  if (combined.length > 1) {
    return { error: `Ambiguous payment method "${rawMethod}". Multiple enabled methods matched.` };
  }

  // Check if it's a known method that is disabled
  const disabledMatch = allMethods.find(
    (m) =>
      m &&
      (m.id.toLowerCase() === cleanRaw || m.name.trim().toLowerCase() === cleanRaw) &&
      !m.enabled
  );
  if (disabledMatch) {
    return { error: `Payment method "${disabledMatch.name}" is currently disabled.` };
  }

  return { error: `Payment method "${rawMethod}" is not recognized or not enabled.` };
}

function extractCustomFieldAnswers(
  proofNote: any,
  bodyCustomValues: any,
  bodyCustomFields: any
): Map<string, string> {
  const answers = new Map<string, string>();

  // 1. From body.customFieldValues (if object)
  if (bodyCustomValues && typeof bodyCustomValues === 'object' && !Array.isArray(bodyCustomValues)) {
    for (const [k, v] of Object.entries(bodyCustomValues)) {
      if (k && v !== undefined && v !== null) {
        answers.set(String(k).trim().toLowerCase(), String(v).trim());
      }
    }
  }

  // 2. From body.customFields (if object or array)
  if (bodyCustomFields && typeof bodyCustomFields === 'object') {
    if (Array.isArray(bodyCustomFields)) {
      for (const item of bodyCustomFields) {
        if (item && typeof item === 'object') {
          const key = item.id || item.label;
          const val = item.value !== undefined ? item.value : item.val;
          if (key && val !== undefined && val !== null) {
            answers.set(String(key).trim().toLowerCase(), String(val).trim());
          }
        }
      }
    } else {
      for (const [k, v] of Object.entries(bodyCustomFields)) {
        if (k && v !== undefined && v !== null) {
          answers.set(String(k).trim().toLowerCase(), String(v).trim());
        }
      }
    }
  }

  // 3. From proofNote string
  if (typeof proofNote === 'string' && proofNote.includes('--- Custom Proof Details ---')) {
    const sep = '--- Custom Proof Details ---';
    const sepIdx = proofNote.indexOf(sep);
    const customSection = proofNote.substring(sepIdx + sep.length);
    const lines = customSection.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const label = line.slice(0, colonIdx).trim().toLowerCase();
        const val = line.slice(colonIdx + 1).trim();
        if (label && !answers.has(label)) {
          answers.set(label, val);
        }
      }
    }
  }

  return answers;
}

interface ReceiptValidationResult {
  isValid: boolean;
  status: number;
  message: string;
  sanitizedUrl?: string;
}

function validateJobPostingReceiptScreenshot(rawInput: unknown): ReceiptValidationResult {
  if (typeof rawInput !== 'string') {
    return {
      isValid: false,
      status: 400,
      message: 'Receipt screenshot must be a valid image data URL string.'
    };
  }

  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      status: 400,
      message: 'Receipt screenshot cannot be an empty string.'
    };
  }

  // Reject external HTTP/HTTPS URLs
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      status: 400,
      message: 'External image URLs are not permitted. Please upload a receipt image directly.'
    };
  }

  // Reject dangerous schemes
  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return {
      isValid: false,
      status: 400,
      message: 'Unsupported image format or dangerous URI scheme.'
    };
  }

  // Strict data URL format: accept ONLY JPEG, PNG, and WebP Base64
  const match = trimmed.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    if (/^data:(text\/html|application\/)/i.test(trimmed) || /^data:image\/(svg\+xml|gif|bmp)/i.test(trimmed)) {
      return {
        isValid: false,
        status: 400,
        message: 'Unsupported image format. Allowed formats: JPEG, PNG, WebP.'
      };
    }
    return {
      isValid: false,
      status: 400,
      message: 'Invalid receipt screenshot format. Only JPEG, PNG, and WebP data URLs are accepted.'
    };
  }

  const declaredMime = match[1].toLowerCase();
  const base64Data = match[2];

  // Maximum decoded size: 5 MiB = 5,242,880 bytes
  const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
  // Maximum possible encoded Base64 length for 5 MiB accurately calculated (4 * Math.ceil(MAX_RECEIPT_BYTES / 3) = 6,990,508)
  const MAX_BASE64_LENGTH = 4 * Math.ceil(MAX_RECEIPT_BYTES / 3);

  if (base64Data.length > MAX_BASE64_LENGTH) {
    return {
      isValid: false,
      status: 413,
      message: 'Payment receipt exceeds the maximum allowed size of 5 MB.'
    };
  }

  // Validate Base64 canonical format and padding
  if (base64Data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
    return {
      isValid: false,
      status: 400,
      message: 'Invalid receipt image: malformed Base64 data.'
    };
  }

  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0) {
    return {
      isValid: false,
      status: 400,
      message: 'Invalid receipt image: empty file data.'
    };
  }

  if (buffer.length > MAX_RECEIPT_BYTES) {
    return {
      isValid: false,
      status: 413,
      message: 'Payment receipt exceeds the maximum allowed size of 5 MB.'
    };
  }

  // Canonical Base64 check
  if (buffer.toString('base64') !== base64Data) {
    return {
      isValid: false,
      status: 400,
      message: 'Invalid receipt image: non-canonical Base64 encoding.'
    };
  }

  // Actual file signature validation (magic bytes)
  if (declaredMime === 'jpeg') {
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (!isJpeg) {
      return {
        isValid: false,
        status: 400,
        message: 'File signature does not match declared JPEG image format.'
      };
    }
  } else if (declaredMime === 'png') {
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    if (!isPng) {
      return {
        isValid: false,
        status: 400,
        message: 'File signature does not match declared PNG image format.'
      };
    }
  } else if (declaredMime === 'webp') {
    const isWebp =
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 && // 'RIFF'
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50; // 'WEBP'
    if (!isWebp) {
      return {
        isValid: false,
        status: 400,
        message: 'File signature does not match declared WebP image format.'
      };
    }
  }

  return {
    isValid: true,
    status: 200,
    message: 'Valid receipt image',
    sanitizedUrl: trimmed
  };
}

// 2. Submit payment proof with Idempotency Protection & Authoritative Pricing Authority
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
      userNote,
      userId,
      userName,
      userEmail,
      jobTitleRef,
      jobIdRef,
      adIdRef,
      adTitleRef,
      jobPricingOptions,
      adPricingOptions,
      plan,
      cvTemplateId,
      expectedAmount,
      idempotencyKey
    } = req.body;

    let cleanIdempotencyKey: string | undefined = undefined;
    try {
      cleanIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
    } catch (keyErr: any) {
      return res.status(400).json({
        success: false,
        message: keyErr?.message || 'Invalid idempotencyKey.'
      });
    }

    const authUser = (req as any).user;
    const authUserId = authUser?.userId || authUser?.id;
    const adminRoles = ['Super Admin', 'Admin', 'Payment Manager', 'Finance Manager'];
    const isAdmin = Boolean(authUser && adminRoles.includes(authUser.role));

    const effectiveType = type || 'Wallet Deposit';
    const effectiveCurrency = effectiveType === 'CV Design Purchase' ? 'PKR' : (currency || 'PKR');

    if (!authUserId) {
      if (effectiveType === 'Subscription' && paymentMethod !== 'Wallet Balance' && (userEmail || senderPhoneOrAccount)) {
        // Guest subscription permitted for manual payment proof submission (Pending admin review)
      } else {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
    }

    if (authUserId && !isAdmin && userId && String(userId) !== String(authUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot submit a transaction for another user.'
      });
    }

    const effectiveUserId = authUserId ? (isAdmin ? (userId || authUserId) : authUserId) : undefined;
    const effectiveUserName = authUserId
      ? (isAdmin ? (userName || authUser?.name) : (authUser?.name || userName))
      : (userName || senderName || 'Subscriber');
    const effectiveUserEmail = authUserId
      ? (isAdmin ? (userEmail || authUser?.email) : (authUser?.email || ''))
      : (userEmail || '');

    const userLockKey = String(effectiveUserId || effectiveUserEmail || senderPhoneOrAccount || 'anon-tx');
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

      const ALLOWED_TRANSACTION_TYPES = [
        'Wallet Deposit',
        'Job Posting',
        'Advertisement',
        'Subscription',
        'CV Design Purchase'
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

      const safeAdIdRef =
        effectiveType === 'Advertisement' && adIdRef !== undefined && adIdRef !== null && String(adIdRef).trim() !== ''
          ? String(adIdRef).trim()
          : undefined;

      const safeAdTitleRef =
        effectiveType === 'Advertisement' && (adTitleRef || jobTitleRef)
          ? String(adTitleRef || jobTitleRef).trim()
          : undefined;

      if (effectiveType === 'Wallet Deposit' && paymentMethod === 'Wallet Balance') {
        return res.status(400).json({
          success: false,
          message: 'Wallet Deposit cannot be funded using Wallet Balance.'
        });
      }
      if (effectiveType === 'Advertisement' && paymentMethod === 'Wallet Balance' && !safeAdIdRef) {
        return res.status(400).json({
          success: false,
          message: 'A campaign reference is required before wallet funds can be placed into escrow.'
        });
      }

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

      let enforcedAmount = Number(amount);
      let pricingBreakdown: Array<{ name: string; amount: number }> = [];
      let safeSubscriptionPlan: string | undefined = undefined;
      let authoritativeSubDuration = 0;
      let isAdFreeOverride = false;
      let isJobFreeOverride = false;
      let resolvedAdPricingSnapshot: Record<string, any> | undefined = undefined;
      let resolvedJobPricingSnapshot: Record<string, any> | undefined = undefined;

      if (effectiveType === 'Job Posting') {
        const calc = await PricingRepository.calculateJobPostingPrice({
          ...(jobPricingOptions || {}),
          userEmail: effectiveUserEmail,
          userId: req.body?.userId || effectiveUserId,
          jobCategory: targetJob?.jobCategory || jobPricingOptions?.jobCategory,
          priorityTier: targetJob?.priorityTier || jobPricingOptions?.priorityTier
        });
        enforcedAmount = calc.finalPrice;
        pricingBreakdown = calc.breakdown;
        if (calc.finalPrice === 0) {
          isJobFreeOverride = true;
        }
        resolvedJobPricingSnapshot = {
          plan: jobPricingOptions?.priorityTier || targetJob?.priorityTier || 'Standard',
          basePrice: calc.basePrice,
          addonsTotal: calc.addonsTotal,
          discountAmount: calc.discountAmount,
          finalPrice: calc.finalPrice,
          currency: calc.currency,
          breakdown: calc.breakdown,
          timestamp: new Date().toISOString()
        };
      } else if (effectiveType === 'Advertisement') {
        const adCalcInput =
          adPricingOptions && typeof adPricingOptions === 'object' && Object.keys(adPricingOptions).length > 0
            ? adPricingOptions
            : {
                placement: req.body?.placement,
                durationUnit: req.body?.durationUnit,
                durationValue: req.body?.durationValue,
                durationPresetId: req.body?.durationPresetId || req.body?.selectedDurationId,
                selectedDurationId: req.body?.selectedDurationId || req.body?.durationPresetId,
                durationDays: req.body?.durationDays,
                targetPages: req.body?.targetPages,
                smsRecipientsCount: req.body?.smsRecipientsCount,
                type: req.body?.adType || req.body?.campaignType || req.body?.type
              };
        const calc = await PricingRepository.calculateAdPrice(adCalcInput);
        enforcedAmount = calc.finalPrice;
        pricingBreakdown = calc.breakdown;
        isAdFreeOverride = Boolean(calc.isFreeOverride && calc.finalPrice === 0);
        resolvedAdPricingSnapshot = {
          placement: calc.placement,
          durationUnit: calc.durationUnit,
          durationValue: calc.durationValue,
          durationHours: calc.durationHours,
          durationDays: calc.durationDays,
          durationDisplay: calc.durationDisplay,
          targetPages: calc.targetPages,
          smsRecipientsCount: calc.smsRecipientsCount,
          placementMultiplier: calc.placementMultiplier,
          pageMultiplier: calc.pageMultiplier,
          baseCost: calc.baseCost,
          smsFee: calc.smsFee,
          totalCostPkr: calc.totalCostPkr,
          isFreeOverride: calc.isFreeOverride,
          fixedPriceOverridePkr: calc.fixedPriceOverridePkr,
          durationPresetId: adCalcInput.durationPresetId || adCalcInput.selectedDurationId
        };
      } else if (effectiveType === 'CV Design Purchase') {
        if (!effectiveUserId || typeof cvTemplateId !== 'string' || !cvTemplateId.trim()) {
          return res.status(400).json({ success: false, message: 'A signed-in account and valid CV design or package are required.' });
        }
        const pricingConfig = (await PricingRepository.get()) || {};
        const cvSettings = pricingConfig.cvBuilder || {};
        const purchaseId = cvTemplateId.trim();
        const expectedCvPrice = Number(expectedAmount);
        if (purchaseId.startsWith('cvpkg:')) {
          const packageId = purchaseId.slice('cvpkg:'.length).trim();
          const packages = Array.isArray(cvSettings.packages) ? cvSettings.packages : [];
          const selectedPackage = packages.find((item: any) => item && String(item.id) === packageId && item.enabled !== false);
          if (!selectedPackage) return res.status(400).json({ success: false, message: 'This CV package is no longer available.' });
          enforcedAmount = Number(selectedPackage.pricePkr);
          const durationDays = Number(selectedPackage.durationDays);
          const quotaFields = ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit'];
          const validQuotas = quotaFields.every((field) => Number.isInteger(Number(selectedPackage[field])) && Number(selectedPackage[field]) >= 0 && Number(selectedPackage[field]) <= 10000);
          if (!Number.isFinite(enforcedAmount) || enforcedAmount <= 0 || enforcedAmount > 10000000 ||
            !Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3650 || !validQuotas) {
            return res.status(400).json({ success: false, message: 'The administrator has not configured a valid price, validity or quota for this CV package.' });
          }
          if (!Number.isFinite(expectedCvPrice) || Math.abs(expectedCvPrice - enforcedAmount) > 0.01) {
            return res.status(409).json({ success: false, message: 'The CV package price has changed. Please review the updated price and try again.' });
          }
          const cvOwner = await UserRepository.getByIdAsync(effectiveUserId);
          if (!cvOwner) return res.status(404).json({ success: false, message: 'Your account could not be found.' });
          const existingPackageTransactions = await PaymentRepository.getAllAsync(effectiveUserId);
          const pendingPackagePurchase = existingPackageTransactions.find((item: any) => item && item.type === 'CV Design Purchase' && item.cvTemplateId === purchaseId && ['Pending', 'Verifying', 'VerificationUncertain'].includes(String(item.status)));
          if (pendingPackagePurchase) {
            const alreadyGranted = (Array.isArray(cvOwner.cvPackageEntitlements) ? cvOwner.cvPackageEntitlements : [])
              .some((entry: any) => String(entry?.transactionId || '') === String(pendingPackagePurchase.id));
            if (alreadyGranted && pendingPackagePurchase.paymentMethod === 'Wallet Balance' &&
              ['Pending', 'VerificationUncertain'].includes(String(pendingPackagePurchase.status))) {
              const reconciled = await PaymentRepository.updateAsync(pendingPackagePurchase.id, {
                status: 'Success',
                walletMutationState: 'DEDUCTED',
                cvPackageEntitlementGranted: true,
                verifiedAt: pendingPackagePurchase.verifiedAt || new Date().toISOString(),
                adminNote: pendingPackagePurchase.adminNote || 'Wallet CV package purchase reconciled from the confirmed account entitlement.'
              });
              if (reconciled) return res.json({ success: true, transaction: reconciled, message: 'Your previous wallet CV package purchase has been reconciled and activated.' });
            }
            return res.status(409).json({ success: false, transaction: pendingPackagePurchase, message: 'A payment for this CV package is already awaiting verification.' });
          }
          const packageName = String(selectedPackage.name || packageId).slice(0, 80);
          (req as any).cvPurchaseSnapshot = {
            kind: 'package',
            packageId,
            packageName,
            pricePkr: enforcedAmount,
            durationDays,
            cvCreateLimit: Number(selectedPackage.cvCreateLimit),
            editLimit: Number(selectedPackage.editLimit),
            pdfExportLimit: Number(selectedPackage.pdfExportLimit),
            atsExportLimit: Number(selectedPackage.atsExportLimit),
            shareLimit: Number(selectedPackage.shareLimit),
            noWatermark: selectedPackage.noWatermark === true,
            timestamp: new Date().toISOString()
          };
          pricingBreakdown = [{ name: `${packageName} CV Package (${durationDays} days)`, amount: enforcedAmount }];
        } else {
          const templates = Array.isArray(cvSettings.templates) ? cvSettings.templates : [];
          const selectedTemplate = templates.find((item: any) => item && item.id === purchaseId);
          if (!selectedTemplate || selectedTemplate.enabled === false) {
            return res.status(400).json({ success: false, message: 'This CV design is no longer available.' });
          }
          const freeDesignLimit = Math.min(5, Math.max(0, Math.floor(Number(cvSettings.freeDesignLimit ?? 2))));
          const freeTemplateIds = new Set(templates.filter((item: any) => item && item.enabled !== false && item.free === true).slice(0, freeDesignLimit).map((item: any) => String(item.id)));
          if (freeTemplateIds.has(purchaseId)) {
            return res.status(400).json({ success: false, message: 'This CV design is free under the current Admin policy and does not require a purchase.' });
          }
          enforcedAmount = Number(selectedTemplate.pricePkr);
          if (!Number.isFinite(enforcedAmount) || enforcedAmount <= 0 || enforcedAmount > 10000000) {
            return res.status(400).json({ success: false, message: 'The administrator has not configured a valid one-time price for this CV design.' });
          }
          const purchaseName = String(selectedTemplate.name || selectedTemplate.id).slice(0, 80);
          if (!Number.isFinite(expectedCvPrice) || Math.abs(expectedCvPrice - enforcedAmount) > 0.01) {
            return res.status(409).json({ success: false, message: 'The CV design price has changed. Please review the updated price and try again.' });
          }
          const cvOwner = await UserRepository.getByIdAsync(effectiveUserId);
          if (!cvOwner) return res.status(404).json({ success: false, message: 'Your account could not be found.' });
          const ownedDesigns = Array.isArray(cvOwner.cvDesignEntitlements) ? cvOwner.cvDesignEntitlements : [];
          const existingCvTransactions = await PaymentRepository.getAllAsync(effectiveUserId);
          const activePurchase = existingCvTransactions.find((item: any) =>
            item && item.type === 'CV Design Purchase' && item.cvTemplateId === purchaseId &&
            ['Pending', 'Verifying', 'VerificationUncertain', 'Success'].includes(String(item.status))
          );
          if (activePurchase) {
            const confirmedEntitlement = ownedDesigns.find((item: any) => item?.templateId === purchaseId && String(item?.transactionId || '') === String(activePurchase.id));
            if (activePurchase.status === 'Pending' && activePurchase.paymentMethod === 'Wallet Balance' && confirmedEntitlement) {
              const reconciled = await PaymentRepository.updateAsync(activePurchase.id, {
                status: 'Success', walletMutationState: 'DEDUCTED', cvEntitlementGranted: true,
                verifiedAt: activePurchase.verifiedAt || new Date().toISOString(),
                adminNote: activePurchase.adminNote || 'Wallet purchase reconciled from the confirmed account entitlement.'
              });
              if (reconciled) return res.json({ success: true, transaction: reconciled, message: 'Your previous wallet purchase has been reconciled and the CV item is unlocked.' });
            }
            return res.status(409).json({
              success: false, transaction: activePurchase,
              message: activePurchase.status === 'Success' ? 'This CV design has already been purchased.' : 'A payment for this CV item is already awaiting verification.'
            });
          }
          if (ownedDesigns.some((item: any) => item?.templateId === purchaseId)) {
            return res.status(409).json({ success: false, message: 'You already own this CV design.' });
          }
          (req as any).cvPurchaseSnapshot = {
            templateId: purchaseId, templateName: purchaseName, pricePkr: enforcedAmount, timestamp: new Date().toISOString()
          };
          pricingBreakdown = [{ name: `${purchaseName} (one-time)`, amount: enforcedAmount }];
        }
      } else if (effectiveType === 'Subscription') {
        const rawPlan = typeof plan === 'string' ? plan.trim() : '';
        const pricingConfig = (await PricingRepository.get()) || {};
        const packages = pricingConfig.subscriptionPackages || [];
        let targetPackage: any = packages.find((p: any) => p.id === rawPlan && p.enabled === true);
        if (!targetPackage && rawPlan.startsWith('feature:')) {
          const featureId = rawPlan.slice('feature:'.length);
          const feature = (pricingConfig.subscriptionFeatureCatalog || []).find((item: any) => item?.id === featureId && item.enabled === true);
          if (feature) {
            targetPackage = {
              id: `feature-${feature.id}`,
              name: feature.label,
              enabled: true,
              pricingMode: 'catalog',
              durationDays: feature.durationDays,
              featureIds: [feature.id],
              bundleDiscountPercent: 0
            };
          }
        }

        if (!targetPackage || !targetPackage.enabled) {
          return res.status(400).json({
            success: false,
            message: `The selected subscription plan or feature "${rawPlan}" is no longer available or is disabled.`
          });
        }

        safeSubscriptionPlan = targetPackage.name;
        authoritativeSubDuration = Number(targetPackage.durationDays);
        let resolvedPackage: any;
        try { resolvedPackage = resolveSubscriptionPackage(targetPackage, pricingConfig); }
        catch (packageError: any) { return res.status(400).json({ success: false, message: packageError?.message || 'Invalid subscription feature configuration.' }); }
        enforcedAmount = resolvedPackage.pricePkr;

        if (!Number.isFinite(enforcedAmount) || enforcedAmount <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid subscription plan pricing configuration.'
          });
        }

        if (!Number.isFinite(authoritativeSubDuration) || authoritativeSubDuration <= 0 || !Number.isInteger(authoritativeSubDuration)) {
          return res.status(400).json({
            success: false,
            message: `Authoritative server-side duration configuration is missing or invalid for subscription plan "${safeSubscriptionPlan}".`
          });
        }

        pricingBreakdown = [{ name: `${safeSubscriptionPlan} Subscription`, amount: enforcedAmount }];

        (req as any).packageSnapshot = {
          id: targetPackage.id,
          name: targetPackage.name,
          pricePkr: resolvedPackage.pricePkr,
          durationDays: targetPackage.durationDays,
          featureIds: resolvedPackage.featureIds,
          featureSnapshots: resolvedPackage.featureSnapshots,
          bundleDiscountPercent: resolvedPackage.bundleDiscountPercent,
          cvBenefitsEnabled: targetPackage.cvBenefitsEnabled === true,
          ...(targetPackage.cvBenefitsEnabled === true ? { cvBenefits: targetPackage.cvBenefits || {}, cvBenefitsDescription: String(targetPackage.cvBenefitsDescription || '').slice(0, 240) } : {}),
          undiscountedPricePkr: resolvedPackage.undiscountedPricePkr,
          pricingMode: targetPackage.pricingMode === 'catalog' ? 'catalog' : 'fixed',
          timestamp: new Date().toISOString()
        };
      } else {
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

      if (!Number.isFinite(enforcedAmount) || (enforcedAmount <= 0 && !isAdFreeOverride && !isJobFreeOverride)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction amount.'
        });
      }

      if (cleanIdempotencyKey) {
        const existing = await PaymentRepository.findByIdempotencyKeyAsync(cleanIdempotencyKey);
        if (existing && (existing.status !== 'Failed' || isTransactionWalletStateLocked(existing))) {
          if (!isAdmin && existing.userId && String(existing.userId) !== String(effectiveUserId)) {
            return res.status(403).json({
              success: false,
              message: 'Forbidden: Cannot access another user transaction.'
            });
          }
          if (PaymentRepository.isTransactionCompensated(existing)) {
            return res.json({
              success: true,
              compensated: true,
              alreadyCompensated: true,
              transaction: existing,
              message: 'Advertisement payment was already refunded/compensated after a previous campaign creation failure (idempotent result).'
            });
          }
          if (existing.status === 'Pending' && existing.paymentMethod === 'Wallet Balance' && isTransactionWalletStateLocked(existing)) {
            return res.status(409).json({
              success: false,
              transaction: existing,
              message: 'Previous wallet transaction outcome is pending reconciliation and cannot be retried automatically.'
            });
          }
          return res.json({
            success: true,
            transaction: existing,
            message: 'Payment proof already submitted (idempotent result).'
          });
        }
      }

      if (effectiveType === 'Advertisement' && safeAdIdRef) {
        const allTxs = await PaymentRepository.getAllAsync();
        const existingAdTx = allTxs.find(
          (t: any) =>
            t &&
            t.type === 'Advertisement' &&
            String(t.adIdRef) === String(safeAdIdRef) &&
            (t.status === 'Pending' || t.status === 'Success' || PaymentRepository.isTransactionCompensated(t) || isTransactionWalletStateLocked(t))
        );
        if (existingAdTx) {
          if (!isAdmin && existingAdTx.userId && String(existingAdTx.userId) !== String(effectiveUserId)) {
            return res.status(403).json({
              success: false,
              message: 'Forbidden: Cannot access another user advertisement transaction.'
            });
          }
          if (PaymentRepository.isTransactionCompensated(existingAdTx)) {
            return res.json({
              success: true,
              compensated: true,
              alreadyCompensated: true,
              transaction: existingAdTx,
              message: 'Advertisement payment was already refunded/compensated after a previous campaign creation failure (idempotent result).'
            });
          }
          if (existingAdTx.status === 'Pending' && existingAdTx.paymentMethod === 'Wallet Balance' && isTransactionWalletStateLocked(existingAdTx)) {
            return res.status(409).json({
              success: false,
              transaction: existingAdTx,
              message: 'Previous advertisement wallet transaction outcome is pending reconciliation and cannot be retried automatically.'
            });
          }
          return res.json({
            success: true,
            transaction: existingAdTx,
            message: 'Advertisement payment already processed (idempotent result).'
          });
        }
      }

      if (effectiveType === 'Job Posting' && safeJobIdRef) {
        const allTxs = await PaymentRepository.getAllAsync();
        const existingJobTx = allTxs.find(
          (t: any) =>
            t &&
            t.type === 'Job Posting' &&
            String(t.jobIdRef) === String(safeJobIdRef) &&
            (t.status === 'Pending' || t.status === 'Success' || isTransactionWalletStateLocked(t))
        );
        if (existingJobTx) {
          return res.status(409).json({
            success: false,
            message: 'This job already has a pending or completed payment transaction.'
          });
        }
      }

      let resolvedPaymentMethodName = paymentMethod;
      const cleanTid = typeof transactionId === 'string' && transactionId.trim().length > 0 ? transactionId.trim() : undefined;
      let cleanScreenshot: string | undefined = typeof proofScreenshotUrl === 'string' && proofScreenshotUrl.trim().length > 0 ? proofScreenshotUrl.trim() : undefined;
      const cleanSenderName = typeof senderName === 'string' && senderName.trim().length > 0 ? senderName.trim() : undefined;
      const cleanSenderPhone = typeof senderPhoneOrAccount === 'string' && senderPhoneOrAccount.trim().length > 0 ? senderPhoneOrAccount.trim() : undefined;

      // Strict server-side receipt screenshot validation for manual Job Posting payments
      if ((effectiveType === 'Job Posting' || effectiveType === 'CV Design Purchase') && paymentMethod !== 'Wallet Balance') {
        if (proofScreenshotUrl !== undefined && proofScreenshotUrl !== null) {
          if (typeof proofScreenshotUrl !== 'string') {
            return res.status(400).json({
              success: false,
              message: 'Receipt screenshot must be a valid image data URL string.'
            });
          }
          if (proofScreenshotUrl.length > 0 && proofScreenshotUrl.trim().length === 0) {
            return res.status(400).json({
              success: false,
              message: 'Invalid receipt screenshot format. Only JPEG, PNG, and WebP data URLs are accepted.'
            });
          }
          if (cleanScreenshot) {
            const validation = validateJobPostingReceiptScreenshot(cleanScreenshot);
            if (!validation.isValid) {
              return res.status(validation.status).json({
                success: false,
                message: validation.message
              });
            }
            cleanScreenshot = validation.sanitizedUrl;
          }
        }
      }

      // Authoritative manual payment proof validation
      let authoritativeJobProofNote: string | undefined = undefined;

      if (paymentMethod !== 'Wallet Balance') {
        let savedSettings: PublicPaymentSettings | null = null;
        let isConfigured = false;

        try {
          const resSettings = await PaymentSettingsRepository.getPublicSettings();
          isConfigured = Boolean(resSettings?.isConfigured);
          savedSettings = resSettings?.settings || null;
        } catch (err: any) {
          console.error('[transactionRoutes] Failed to fetch payment settings:', err?.message || err);
          return res.status(503).json({
            success: false,
            message: 'Payment configuration service is temporarily unavailable.'
          });
        }

        if (!isConfigured || !savedSettings) {
          return res.status(400).json({
            success: false,
            message: 'Payment instructions are currently unconfigured or unavailable.'
          });
        }

        const resolved = resolvePaymentMethod(paymentMethod, savedSettings);
        if (!resolved.method) {
          return res.status(400).json({
            success: false,
            message: resolved.error || `Payment method "${paymentMethod}" is not enabled or available for payments.`
          });
        }

        const methodConfig = resolved.method;
        resolvedPaymentMethodName = methodConfig.name;

        // Wallet Deposit amount policy is enforced on the server; subscription, job and campaign payments are untouched.
        if (effectiveType === 'Wallet Deposit') {
          const fixedAmounts = Array.isArray(methodConfig.walletDepositFixedAmounts)
            ? methodConfig.walletDepositFixedAmounts.filter((item) => item && item.enabled && Number.isSafeInteger(item.amount) && item.amount > 0)
            : [];
          const customAmountAllowed = methodConfig.walletDepositAllowCustomAmount !== false;
          const isConfiguredFixedAmount = fixedAmounts.some((item) => item.amount === enforcedAmount);
          if (!customAmountAllowed && !isConfiguredFixedAmount) {
            return res.status(400).json({
              success: false,
              message: fixedAmounts.length
                ? `Please select one of the enabled fixed deposit amounts for ${methodConfig.name}.`
                : `Wallet deposits are not currently configured for ${methodConfig.name}. Please contact support.`
            });
          }
          if (customAmountAllowed && (!Number.isSafeInteger(enforcedAmount) || enforcedAmount <= 0)) {
            return res.status(400).json({ success: false, message: 'Wallet deposit amount must be a positive whole PKR amount.' });
          }
          if (customAmountAllowed && !isConfiguredFixedAmount && methodConfig.walletDepositMinimumAmount !== undefined && enforcedAmount < methodConfig.walletDepositMinimumAmount) {
            return res.status(400).json({
              success: false,
              message: `Minimum wallet deposit for ${methodConfig.name} is PKR ${Number(methodConfig.walletDepositMinimumAmount).toLocaleString()}.`
            });
          }
          if (customAmountAllowed && !isConfiguredFixedAmount && methodConfig.walletDepositMaximumAmount !== undefined && enforcedAmount > methodConfig.walletDepositMaximumAmount) {
            return res.status(400).json({
              success: false,
              message: `Maximum wallet deposit for ${methodConfig.name} is PKR ${Number(methodConfig.walletDepositMaximumAmount).toLocaleString()}.`
            });
          }
        }

        // 1. Transaction ID requirement
        if (methodConfig.transactionIdRequired && !cleanTid) {
          return res.status(400).json({
            success: false,
            message: `Please enter the ${methodConfig.transactionIdLabel || 'Transaction ID (TID)'}.`
          });
        }

        // 2. Receipt Screenshot requirement
        if (methodConfig.screenshotRequired && !cleanScreenshot) {
          return res.status(400).json({
            success: false,
            message: `Please upload a ${methodConfig.screenshotLabel || 'Payment Receipt Screenshot'}.`
          });
        }

        // At least one proof mechanism must be present for manual payments
        if (!cleanTid && !cleanScreenshot) {
          return res.status(400).json({
            success: false,
            message: 'Please provide either the Transaction ID or upload a Payment Receipt Screenshot.'
          });
        }

        // 3. Sender Name requirement
        if (methodConfig.senderNameRequired && !cleanSenderName) {
          return res.status(400).json({
            success: false,
            message: `Please enter the ${methodConfig.senderNameLabel || 'Sender Name / Account Holder'}.`
          });
        }

        // 4. Sender Phone / Mobile / Account requirement
        if (methodConfig.senderPhoneRequired && !cleanSenderPhone) {
          return res.status(400).json({
            success: false,
            message: `Please enter the ${methodConfig.senderPhoneLabel || 'Sender Mobile / Account Number'}.`
          });
        }

        // 5. Depositor Note requirement & extraction
        let userNoteContent = '';
        if (typeof userNote === 'string') {
          userNoteContent = userNote.trim();
        } else if (typeof proofNote === 'string') {
          const sepIdx = proofNote.indexOf('--- Custom Proof Details ---');
          const notePart = sepIdx !== -1 ? proofNote.substring(0, sepIdx) : proofNote;
          userNoteContent = notePart.replace(/^User Note:\s*/i, '').trim();
        }

        // Defang user note so it cannot contain the reserved separator token
        userNoteContent = userNoteContent
          .replace(/--+[\s\t]*Custom Proof Details[\s\t]*--+/gi, '[Custom Proof Details]')
          .trim();

        if (methodConfig.proofNoteRequired && !userNoteContent) {
          return res.status(400).json({
            success: false,
            message: `Please provide ${methodConfig.proofNoteLabel || 'a deposit note'}.`
          });
        }

        // 6. Custom Proof Fields requirements (validated strictly against authoritative saved definitions)
        const authoritativeCustomLines: string[] = [];

        if (Array.isArray(methodConfig.customFields) && methodConfig.customFields.length > 0) {
          const submittedCustomAnswers = extractCustomFieldAnswers(
            proofNote,
            req.body?.customFieldValues,
            req.body?.customFields
          );

          const sortedFields = [...methodConfig.customFields].sort(
            (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
          );

          for (const cf of sortedFields) {
            const cleanId = String(cf.id || '').trim().toLowerCase();
            const cleanLabel = String(cf.label || '').trim().toLowerCase();
            const strippedLabel = String(cf.label || '').replace(/[:\r\n]+/g, ' ').trim().toLowerCase();

            const submittedVal =
              submittedCustomAnswers.get(cleanId) ??
              submittedCustomAnswers.get(cleanLabel) ??
              submittedCustomAnswers.get(strippedLabel) ??
              '';

            const trimmedVal = typeof submittedVal === 'string' ? submittedVal.trim() : String(submittedVal || '').trim();
            const isMissing = !trimmedVal || trimmedVal === 'N/A';

            if (cf.required && isMissing) {
              return res.status(400).json({
                success: false,
                message: `Please enter the required field "${cf.label}".`
              });
            }

            if (!isMissing) {
              if (cf.type === 'number') {
                const numericClean = trimmedVal.replace(/[\s,]+/g, '');
                if (!/^-?\d+(\.\d+)?$/.test(numericClean)) {
                  return res.status(400).json({
                    success: false,
                    message: `Field "${cf.label}" must be a valid number.`
                  });
                }
              }
              if (trimmedVal.length > 500) {
                return res.status(400).json({
                  success: false,
                  message: `Field "${cf.label}" exceeds maximum allowed length.`
                });
              }

              // Use authoritative label from saved configuration, sanitized of line breaks and colons
              const safeLabel = String(cf.label || '').replace(/[\r\n:]+/g, ' ').trim();
              const safeVal = trimmedVal.replace(/[\r\n]+/g, ' ').trim();
              if (safeLabel && safeVal) {
                authoritativeCustomLines.push(`${safeLabel}: ${safeVal}`);
              }
            }
          }
        }

        let authoritativeProofNote = '';
        if (authoritativeCustomLines.length > 0) {
          const header = userNoteContent ? `User Note: ${userNoteContent}` : 'User Note:';
          authoritativeProofNote = `${header}\n\n--- Custom Proof Details ---\n${authoritativeCustomLines.join('\n')}`;
        } else {
          authoritativeProofNote = userNoteContent;
        }

        if (effectiveType === 'Job Posting') {
          authoritativeJobProofNote = authoritativeProofNote;
        }
      }

      if (cleanTid) {
        const existingTid = await PaymentRepository.findByTransactionIdAsync(cleanTid);
        if (existingTid) {
          return res.status(409).json({
            success: false,
            message: `A transaction with reference ID ${cleanTid} has already been recorded.`
          });
        }
      }

      const tid = cleanTid || `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      let previousWalletBalance = 0;
      if (paymentMethod === 'Wallet Balance') {
        if (!Number.isFinite(enforcedAmount) || (enforcedAmount <= 0 && !isAdFreeOverride)) {
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

      const newTx = await PaymentRepository.createAsync({
        amount: enforcedAmount,
        currency: effectiveCurrency,
        type: effectiveType,
        ...(safeSubscriptionPlan ? { plan: safeSubscriptionPlan } : {}),
        ...(effectiveType === 'Subscription' ? { packageSnapshot: (req as any).packageSnapshot } : {}),
        ...(effectiveType === 'CV Design Purchase' ? {
          cvTemplateId: (req as any).cvPurchaseSnapshot.templateId,
          cvPurchaseSnapshot: (req as any).cvPurchaseSnapshot
        } : {}),
        status: 'Pending',
        paymentMethod: resolvedPaymentMethodName,
        ...(paymentMethod === 'Wallet Balance' ? { walletMutationState: 'NONE' as WalletMutationState } : {}),
        transactionId: tid,
        ...(cleanIdempotencyKey ? { idempotencyKey: cleanIdempotencyKey } : {}),
        senderName: cleanSenderName || senderName || effectiveUserName || 'Customer',
        senderPhoneOrAccount: cleanSenderPhone || senderPhoneOrAccount,
        depositBankOrWalletName,
        proofScreenshotUrl: effectiveType === 'Job Posting' ? cleanScreenshot : (cleanScreenshot || proofScreenshotUrl),
        proofNote: effectiveType === 'Job Posting' && paymentMethod !== 'Wallet Balance'
          ? (authoritativeJobProofNote || undefined)
          : proofNote,
        userId: effectiveUserId,
        userName: effectiveUserName,
        userEmail: effectiveUserEmail,
        jobTitleRef: jobTitleRef || safeAdTitleRef,
        jobIdRef: safeJobIdRef,
        ...(safeAdIdRef ? { adIdRef: safeAdIdRef } : {}),
        ...(safeAdTitleRef ? { adTitleRef: safeAdTitleRef } : {}),
        ...(resolvedAdPricingSnapshot ? { adPricingSnapshot: resolvedAdPricingSnapshot } : {}),
        ...(resolvedJobPricingSnapshot ? { jobPricingSnapshot: resolvedJobPricingSnapshot } : {}),
        pricingBreakdown,
        createdAt: new Date().toISOString()
      });

      let finalStatus: 'Pending' | 'Success' = 'Pending';

      if (paymentMethod === 'Wallet Balance') {
        let walletMutationState: WalletMutationState = 'NONE';
        let effectiveBalanceBefore = previousWalletBalance;
        let effectiveBalanceAfter = previousWalletBalance;

        try {
          if (effectiveType === 'CV Design Purchase') {
            const purchaseSnapshot = (req as any).cvPurchaseSnapshot;
            await persistTransactionState(
              newTx.id,
              { walletMutationState: 'DEDUCTING', updatedAt: new Date().toISOString() },
              { key: 'walletMutationState', expected: 'DEDUCTING' }
            );
            walletMutationState = 'DEDUCTING';
            newTx.walletMutationState = 'DEDUCTING';
            const purchase = purchaseSnapshot?.kind === 'package'
              ? await UserRepository.purchaseCvPackageWithWalletAsync(effectiveUserId, enforcedAmount, purchaseSnapshot, newTx.id)
              : await UserRepository.purchaseCvDesignWithWalletAsync(
                  effectiveUserId,
                  enforcedAmount,
                  {
                    templateId: purchaseSnapshot.templateId,
                    templateName: purchaseSnapshot.templateName,
                    transactionId: newTx.id,
                    amount: enforcedAmount,
                    purchasedAt: new Date().toISOString()
                  }
                );
            if (!purchase.ok || !purchase.user) {
              walletMutationState = 'NONE';
              const reason = purchase.reason === 'already_owned'
                ? 'You already own this CV design.'
                : purchase.reason === 'insufficient'
                  ? 'Your wallet balance is insufficient for this CV purchase.'
                  : 'Your account could not be updated for this CV purchase.';
              throw new Error(reason);
            }
            walletMutationState = 'DEDUCTED';
            effectiveBalanceAfter = Number(purchase.user.walletBalance);
            effectiveBalanceBefore = effectiveBalanceAfter + enforcedAmount;
            await persistTransactionState(
              newTx.id,
              {
                walletMutationState: 'DEDUCTED',
                balanceBefore: effectiveBalanceBefore,
                balanceAfter: effectiveBalanceAfter,
                cvEntitlementGranted: purchaseSnapshot?.kind !== 'package',
                cvPackageEntitlementGranted: purchaseSnapshot?.kind === 'package',
                updatedAt: new Date().toISOString()
              }
            );
            newTx.walletMutationState = 'DEDUCTED';
            newTx.cvEntitlementGranted = purchaseSnapshot?.kind !== 'package';
            newTx.cvPackageEntitlementGranted = purchaseSnapshot?.kind === 'package';
          } else if (effectiveType === 'Subscription') {
            await persistTransactionState(
              newTx.id,
              { walletMutationState: 'DEDUCTING', updatedAt: new Date().toISOString() },
              { key: 'walletMutationState', expected: 'DEDUCTING' }
            );
            walletMutationState = 'DEDUCTING';
            newTx.walletMutationState = 'DEDUCTING';

            const subDurationDays = authoritativeSubDuration;
            const subscriptionActivatedAt = new Date().toISOString();
            const subscriptionExpiresAt = new Date(Date.now() + subDurationDays * 24 * 60 * 60 * 1000).toISOString();
            const walletPackageSnapshot = (req as any).packageSnapshot || {};
            const walletFeatureSnapshots = Array.isArray(walletPackageSnapshot.featureSnapshots) ? walletPackageSnapshot.featureSnapshots : [];
            const walletUserBeforePurchase = await UserRepository.getByIdAsync(effectiveUserId);
            const walletEntitlements = { ...(walletUserBeforePurchase?.subscriptionEntitlements || {}) };
            for (const feature of walletFeatureSnapshots) {
              const featureId = String(feature?.id || '');
              if (!featureId) continue;
              const featureDays = Number.isInteger(Number(feature.durationDays)) && Number(feature.durationDays) > 0 ? Math.min(subDurationDays, Number(feature.durationDays)) : subDurationDays;
              walletEntitlements[featureId] = {
                enabled: true,
                grantedAt: subscriptionActivatedAt,
                expiresAt: new Date(Date.now() + featureDays * 24 * 60 * 60 * 1000).toISOString(),
                includedSlots: Number.isInteger(Number(feature.includedSlots)) ? Math.max(0, Number(feature.includedSlots)) : 0,
                remainingSlots: Number.isInteger(Number(feature.includedSlots)) ? Math.max(0, Number(feature.includedSlots)) : 0,
                slotDurationDays: Number.isInteger(Number(feature.slotDurationDays)) ? Math.max(1, Number(feature.slotDurationDays)) : subDurationDays,
                sourcePackageId: String(walletPackageSnapshot.id || '')
              };
            }
            let updatedUser: any = null;
            try {
              updatedUser = await UserRepository.deductWalletBalanceAsync(
                effectiveUserId,
                enforcedAmount,
                {
                  membershipTier: safeSubscriptionPlan || 'Pro Alerts',
                  membershipStatus: 'Active',
                  subscriptionExpiresAt,
                  ...(walletFeatureSnapshots.length ? {
                    subscriptionEntitlements: walletEntitlements,
                    subscriptionFeatureIds: walletFeatureSnapshots.map((feature: any) => String(feature.id))
                  } : {})
                }
              );
            } catch (deductErr) {
              walletMutationState = 'UNCERTAIN';
              throw deductErr;
            }

            if (!updatedUser) {
              walletMutationState = 'NONE';
              throw new Error('Failed to deduct wallet balance and activate subscription.');
            }

            if (walletPackageSnapshot.cvBenefitsEnabled === true) {
              try {
                const benefits = walletPackageSnapshot.cvBenefits || {};
                const cvGrant = await UserRepository.grantCvPackageEntitlementAsync(effectiveUserId, {
                  packageId: `subscription:${walletPackageSnapshot.id}`,
                  packageName: `${String(walletPackageSnapshot.name || safeSubscriptionPlan || 'Subscription')} CV Benefits`,
                  pricePkr: enforcedAmount,
                  durationDays: subDurationDays,
                  cvCreateLimit: Number(benefits.cvCreateLimit ?? 0),
                  editLimit: Number(benefits.editLimit ?? 0),
                  pdfExportLimit: Number(benefits.pdfExportLimit ?? 0),
                  atsExportLimit: Number(benefits.atsExportLimit ?? 0),
                  shareLimit: Number(benefits.shareLimit ?? 0),
                  noWatermark: benefits.noWatermark === true
                }, String(newTx.id));
                if (!cvGrant) throw new Error('Subscription was charged, but its CV benefits could not be saved.');
              } catch (cvBenefitError) {
                walletMutationState = 'UNCERTAIN';
                throw cvBenefitError;
              }
            }

            walletMutationState = 'DEDUCTED';
            effectiveBalanceAfter = Number(updatedUser.walletBalance);
            effectiveBalanceBefore = effectiveBalanceAfter + enforcedAmount;
            await persistTransactionState(
              newTx.id,
              {
                walletMutationState: 'DEDUCTED',
                balanceBefore: effectiveBalanceBefore,
                balanceAfter: effectiveBalanceAfter,
                ...(walletPackageSnapshot.cvBenefitsEnabled === true ? { cvPackageEntitlementGranted: true } : {}),
                updatedAt: new Date().toISOString()
              }
            );
            newTx.walletMutationState = 'DEDUCTED';
            if (walletPackageSnapshot.cvBenefitsEnabled === true) newTx.cvPackageEntitlementGranted = true;
          } else {
            if (effectiveType === 'Advertisement' && enforcedAmount > 0) {
              await persistTransactionState(
                newTx.id,
                { walletMutationState: 'DEDUCTING', escrowStatus: 'HOLDING', escrowAmount: enforcedAmount, updatedAt: new Date().toISOString() },
                { key: 'walletMutationState', expected: 'DEDUCTING' }
              );
              walletMutationState = 'DEDUCTING';
              newTx.walletMutationState = 'DEDUCTING';
              newTx.escrowStatus = 'HOLDING';
              newTx.escrowAmount = enforcedAmount;

              let heldUser: any = null;
              try {
                heldUser = await UserRepository.holdWalletBalanceInEscrowAsync(
                  effectiveUserId,
                  enforcedAmount,
                  `hold-${newTx.id}`
                );
              } catch (holdErr) {
                walletMutationState = 'UNCERTAIN';
                throw holdErr;
              }
              if (!heldUser) {
                walletMutationState = 'NONE';
                throw new Error('Insufficient available wallet balance for campaign escrow.');
              }

              walletMutationState = 'DEDUCTED';
              newTx.escrowStatus = 'HELD';
              newTx.escrowAmount = enforcedAmount;
              effectiveBalanceAfter = Number(heldUser.walletBalance);
              effectiveBalanceBefore = effectiveBalanceAfter + enforcedAmount;
              const heldAmount = Number(heldUser.walletEscrowBalance || 0);
              await persistTransactionState(newTx.id, {
                walletMutationState: 'DEDUCTED',
                escrowStatus: 'HELD',
                escrowAmount: enforcedAmount,
                escrowBalanceAfter: heldAmount,
                balanceBefore: effectiveBalanceBefore,
                balanceAfter: effectiveBalanceAfter,
                updatedAt: new Date().toISOString()
              });
              newTx.walletMutationState = 'DEDUCTED';
              newTx.escrowStatus = 'HELD';
              newTx.escrowAmount = enforcedAmount;
              newTx.escrowBalanceAfter = heldAmount;
            } else if (enforcedAmount > 0) {
              await persistTransactionState(
                newTx.id,
                { walletMutationState: 'DEDUCTING', updatedAt: new Date().toISOString() },
                { key: 'walletMutationState', expected: 'DEDUCTING' }
              );
              walletMutationState = 'DEDUCTING';
              newTx.walletMutationState = 'DEDUCTING';

              let updatedUser: any = null;
              try {
                updatedUser = await UserRepository.deductWalletBalanceAsync(effectiveUserId, enforcedAmount);
              } catch (deductErr) {
                walletMutationState = 'UNCERTAIN';
                throw deductErr;
              }

              if (!updatedUser) {
                walletMutationState = 'NONE';
                throw new Error('Failed to deduct wallet balance.');
              }

              walletMutationState = 'DEDUCTED';
              effectiveBalanceAfter = Number(updatedUser.walletBalance);
              effectiveBalanceBefore = effectiveBalanceAfter + enforcedAmount;
              await persistTransactionState(
                newTx.id,
                {
                  walletMutationState: 'DEDUCTED',
                  balanceBefore: effectiveBalanceBefore,
                  balanceAfter: effectiveBalanceAfter,
                  updatedAt: new Date().toISOString()
                }
              );
              newTx.walletMutationState = 'DEDUCTED';
            }

            if (effectiveType === 'Job Posting' && safeJobIdRef) {
              let approvedJob: any = null;
              let jobApproveErrorToThrow: any = null;

              try {
                approvedJob = await JobRepository.approvePending(safeJobIdRef);
              } catch (jobApproveErr) {
                try {
                  const verifyJobs = await JobRepository.getJobsByIds([String(safeJobIdRef)]);
                  const verifiedJob = verifyJobs[0] || null;
                  if (verifiedJob && verifiedJob.status === 'Approved') {
                    approvedJob = verifiedJob;
                  } else {
                    jobApproveErrorToThrow = jobApproveErr;
                  }
                } catch {
                  if (walletMutationState === 'DEDUCTED') {
                    walletMutationState = 'UNCERTAIN';
                  }
                  throw jobApproveErr;
                }
              }

              if (!approvedJob) {
                if (walletMutationState === 'DEDUCTED' && enforcedAmount > 0) {
                  walletMutationState = 'ROLLING_BACK';
                  try {
                    await persistTransactionState(
                      newTx.id,
                      { walletMutationState: 'ROLLING_BACK', updatedAt: new Date().toISOString() },
                      { key: 'walletMutationState', expected: 'ROLLING_BACK' }
                    );
                    newTx.walletMutationState = 'ROLLING_BACK';

                    const restoredUser = await UserRepository.creditWalletBalanceAsync(
                      effectiveUserId,
                      enforcedAmount
                    );
                    if (restoredUser) {
                      walletMutationState = 'ROLLED_BACK';
                      await persistTransactionState(newTx.id, {
                        walletMutationState: 'ROLLED_BACK',
                        updatedAt: new Date().toISOString()
                      });
                      newTx.walletMutationState = 'ROLLED_BACK';
                    } else {
                      walletMutationState = 'ROLLBACK_FAILED';
                      await persistTransactionState(newTx.id, {
                        walletMutationState: 'ROLLBACK_FAILED',
                        updatedAt: new Date().toISOString()
                      });
                      newTx.walletMutationState = 'ROLLBACK_FAILED';
                    }
                  } catch {
                    walletMutationState = 'ROLLBACK_FAILED';
                    try {
                      await persistTransactionState(newTx.id, {
                        walletMutationState: 'ROLLBACK_FAILED',
                        updatedAt: new Date().toISOString()
                      });
                    } catch {}
                    newTx.walletMutationState = 'ROLLBACK_FAILED';
                  }
                }
                throw jobApproveErrorToThrow || new Error('Failed to activate job posting after wallet deduction.');
              }
            }
          }

          const verifiedAt = new Date().toISOString();
          await PaymentRepository.updateAsync(newTx.id, {
            status: 'Success',
            walletMutationState,
            verifiedAt,
            balanceBefore: effectiveBalanceBefore,
            balanceAfter: effectiveBalanceAfter
          });
          newTx.status = 'Success';
          newTx.walletMutationState = walletMutationState;
          newTx.verifiedAt = verifiedAt;
          newTx.balanceBefore = effectiveBalanceBefore;
          newTx.balanceAfter = effectiveBalanceAfter;
          finalStatus = 'Success';
        } catch (walletProcessingErr: any) {
          const failureReason = walletProcessingErr?.message || 'Wallet Balance processing failed.';
          let escrowReleaseConfirmed = false;

          // If the wallet hold succeeded but transaction finalization failed, release that hold
          // immediately instead of leaving money stranded without a campaign record.
          if (effectiveType === 'Advertisement' && walletMutationState === 'DEDUCTED' && newTx.escrowStatus === 'HELD') {
            try {
              const restoredUser = await UserRepository.settleWalletEscrowAsync(
                effectiveUserId,
                enforcedAmount,
                `settle-${newTx.id}`,
                true
              );
              if (restoredUser) {
                const refundReferenceId = `AD-REF-${newTx.transactionId || newTx.id}`;
                const refundedTx = await PaymentRepository.updateAsync(newTx.id, {
                  status: 'Refunded',
                  walletMutationState: 'ROLLED_BACK',
                  escrowStatus: 'RELEASED',
                  refunded: true,
                  refundedAmount: enforcedAmount,
                  refundedAt: new Date().toISOString(),
                  refundReferenceId,
                  balanceAfter: Number(restoredUser.walletBalance),
                  rejectionReason: failureReason
                });
                if (refundedTx) {
                  Object.assign(newTx, refundedTx);
                  escrowReleaseConfirmed = true;
                }
              }
            } catch (releaseErr) {
              console.error('[Transactions] Campaign escrow release after wallet processing failure is uncertain:', releaseErr);
            }
          }

          if (!escrowReleaseConfirmed) {
            const nextStatus = canSafelyMarkTransactionFailed(walletMutationState) ? 'Failed' : 'Pending';
            await PaymentRepository.updateAsync(newTx.id, {
              status: nextStatus,
              walletMutationState,
              ...(newTx.escrowStatus === 'HELD' ? { escrowStatus: 'SETTLING_RELEASE' } : {}),
              rejectionReason: failureReason
            });
            newTx.status = nextStatus;
            newTx.walletMutationState = walletMutationState;
            newTx.rejectionReason = failureReason;
          }
          throw walletProcessingErr;
        }
      }

      const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
        user: effectiveUserName || 'User',
        role: 'Member',
        action: finalStatus === 'Success' ? 'Payment Completed (Wallet)' : 'Payment Proof Submitted',
        target: `${enforcedAmount} ${effectiveCurrency} via ${resolvedPaymentMethodName} (Ref: ${tid})`,
        status: 'Success',
        metadata: {
          transactionId: tid,
          amount: enforcedAmount,
          paymentMethod,
          paymentMethodId: paymentMethod,
          paymentMethodName: resolvedPaymentMethodName,
          type: effectiveType
        }
      }, 'POST /api/transactions');

      if (effectiveUserId) {
        try {
          await NotificationRepository.createAsync({
            userId: effectiveUserId,
            title: finalStatus === 'Success' && effectiveType === 'Subscription' ? 'Subscription Purchased' : (finalStatus === 'Success' ? 'Payment Approved' : 'Payment Submitted'),
            message: finalStatus === 'Success' && effectiveType === 'Subscription' && paymentMethod === 'Wallet Balance'
              ? `Your ${safeSubscriptionPlan || 'subscription'} package has been activated. PKR ${enforcedAmount.toLocaleString()} was deducted from your wallet; remaining balance: PKR ${Number(newTx.balanceAfter || 0).toLocaleString()}.`
              : finalStatus === 'Success'
                ? `Your payment of ${enforcedAmount} ${effectiveCurrency} for ${effectiveType} via ${resolvedPaymentMethodName} has been processed.`
                : `Your payment of ${enforcedAmount} ${effectiveCurrency} for ${effectiveType} via ${resolvedPaymentMethodName} has been submitted for review.`,
            type: finalStatus === 'Success' ? 'success' : 'info',
            eventId: finalStatus === 'Success' ? `payment-approved-${newTx.id}` : `payment-submitted-${newTx.id}`,
            idempotencyKey: finalStatus === 'Success' ? `payment-approved-${newTx.id}` : `payment-submitted-${newTx.id}`,
            metadata: { transactionId: newTx.id, amount: enforcedAmount, type: effectiveType, ...(paymentMethod === 'Wallet Balance' ? { balanceAfter: Number(newTx.balanceAfter || 0) } : {}) }
          });
        } catch (notifErr) {
          console.error('[Notification Submission Trigger Error]:', notifErr);
        }
      }

      return res.status(201).json({
        success: true,
        transaction: newTx,
        message: finalStatus === 'Success'
          ? 'Payment processed and verified immediately via wallet balance!'
          : 'Payment proof submitted successfully! Administrator verification is pending.',
        ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
      });
    } finally {
      activeUserTransactionLocks.delete(userLockKey);
    }
  } catch (err: any) {
    return sendSafeTransactionError(res, err, 'Error creating transaction');
  }
});

// 3. Admin Approve / Reject Payment Verification Proof
transactionRouter.patch('/:id/verify', requireAdminPermission('payments.manage'), async (req, res) => {
  try {
    const { action, note, reason } = req.body;
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

      const expectedStatus = action === 'approve' ? 'Success' : 'Failed';
      if (tx.status !== expectedStatus) {
        return res.status(422).json({
          success: false,
          transaction: tx,
          message: `Transaction verification did not achieve the required "${expectedStatus}" status (current status: "${tx.status}").`
        });
      }

      const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
        user: 'Administrator',
        role: 'Payment Manager',
        action: action === 'approve' ? 'Payment Approved' : 'Payment Rejected',
        target: `Transaction ID ${tx.transactionId || tx.id} (${tx.amount} ${tx.currency})`,
        status: action === 'approve' ? 'Success' : 'Warning',
        metadata: { action, note, reason }
      }, 'PATCH /api/transactions/:id/verify');

      if (tx.userId) {
        try {
          const isApprove = action === 'approve';
          const rejReason = reason || note || tx.rejectionReason || 'No reason specified';
          await NotificationRepository.createAsync({
            userId: tx.userId,
            title: isApprove && tx.type === 'Wallet Deposit' ? 'Wallet Balance Credited' : (isApprove ? 'Payment Approved' : 'Payment Rejected'),
            message: isApprove && tx.type === 'Wallet Deposit'
              ? `Your wallet deposit of PKR ${Number(tx.amount).toLocaleString()} has been verified and credited. ${Number.isFinite(Number(tx.balanceAfter)) ? `Your new wallet balance is PKR ${Number(tx.balanceAfter).toLocaleString()}. ` : ''}You can now use your wallet balance to purchase available subscriptions and packages.`
              : isApprove
                ? `Your payment of ${tx.amount} ${tx.currency || 'PKR'} for ${tx.type} has been approved.`
                : `Your payment of ${tx.amount} ${tx.currency || 'PKR'} for ${tx.type} was rejected. Reason: ${rejReason}`,
            type: isApprove ? 'success' : 'warning',
            eventId: isApprove ? `payment-approved-${tx.id}` : `payment-rejected-${tx.id}`,
            idempotencyKey: isApprove ? `payment-approved-${tx.id}` : `payment-rejected-${tx.id}`,
            metadata: { transactionId: tx.id, amount: tx.amount, type: tx.type, action, reason: rejReason, ...(tx.type === 'Wallet Deposit' ? { balanceAfter: tx.balanceAfter } : {}) }
          });
        } catch (notifErr) {
          console.error('[Notification Verification Trigger Error]:', notifErr);
        }
      }

      return res.json({
        success: true,
        transaction: tx,
        message: `Transaction ${tx.transactionId || tx.id} has been ${action === 'approve' ? 'approved and activated' : 'rejected'}.`,
        ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
      });
    } finally {
      activeTransactionVerificationLocks.delete(verifyLockKey);
    }
  } catch (err: any) {
    return sendSafeTransactionError(res, err, 'Error verifying transaction');
  }
});
