import { Router } from 'express';
import {
  PaymentRepository,
  AuditRepository,
  UserRepository,
  PricingRepository,
  JobRepository,
  PaymentSettingsRepository
} from '../db/repositories';
import type { PublicPaymentSettings, PublicPaymentMethodConfig, CustomProofField } from '../../src/types/adminPayment';
import { Database } from '../db/database';
import { requireAdminPermission, requireAuth } from '../auth/authManager';

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
    res.status(500).json({ success: false, message: err.message || 'Error fetching transactions' });
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
      idempotencyKey
    } = req.body;

    const authUser = (req as any).user;
    const authUserId = authUser?.userId || authUser?.id;
    const adminRoles = ['Super Admin', 'Admin', 'Payment Manager', 'Finance Manager'];
    const isAdmin = Boolean(authUser && adminRoles.includes(authUser.role));

    const effectiveType = type || 'Wallet Deposit';

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
      ? (isAdmin ? (userEmail || authUser?.email) : (authUser?.email || userEmail))
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
      let resolvedAdPricingSnapshot: Record<string, any> | undefined = undefined;

      if (effectiveType === 'Job Posting') {
        const calc = PricingRepository.calculateJobPostingPrice(jobPricingOptions || {});
        enforcedAmount = calc.finalPrice;
        pricingBreakdown = calc.breakdown;
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
        const calc = PricingRepository.calculateAdPrice(adCalcInput);
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

        const pricingConfig = PricingRepository.get() || {};
        authoritativeSubDuration = Number(
          pricingConfig.subscriptionDurations?.[safeSubscriptionPlan!]
        );

        if (!Number.isFinite(authoritativeSubDuration) || authoritativeSubDuration <= 0 || !Number.isInteger(authoritativeSubDuration)) {
          return res.status(400).json({
            success: false,
            message: `Authoritative server-side duration configuration is missing or invalid for subscription plan "${safeSubscriptionPlan}".`
          });
        }

        enforcedAmount = configuredSubPrice;
        pricingBreakdown = [{ name: `${safeSubscriptionPlan} Subscription`, amount: configuredSubPrice }];
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

      if (!Number.isFinite(enforcedAmount) || (enforcedAmount <= 0 && !isAdFreeOverride)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction amount.'
        });
      }

      if (idempotencyKey) {
        const existing = await PaymentRepository.findByIdempotencyKeyAsync(idempotencyKey);
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
      const cleanScreenshot = typeof proofScreenshotUrl === 'string' && proofScreenshotUrl.trim().length > 0 ? proofScreenshotUrl.trim() : undefined;
      const cleanSenderName = typeof senderName === 'string' && senderName.trim().length > 0 ? senderName.trim() : undefined;
      const cleanSenderPhone = typeof senderPhoneOrAccount === 'string' && senderPhoneOrAccount.trim().length > 0 ? senderPhoneOrAccount.trim() : undefined;

      // Authoritative manual payment proof validation
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

        // 5. Depositor Note requirement
        if (methodConfig.proofNoteRequired) {
          let userNoteContent = '';
          if (typeof proofNote === 'string') {
            const sepIdx = proofNote.indexOf('--- Custom Proof Details ---');
            const notePart = sepIdx !== -1 ? proofNote.substring(0, sepIdx) : proofNote;
            userNoteContent = notePart.replace(/^User Note:\s*/i, '').trim();
          }
          if (!userNoteContent) {
            return res.status(400).json({
              success: false,
              message: `Please provide ${methodConfig.proofNoteLabel || 'a deposit note'}.`
            });
          }
        }

        // 6. Custom Proof Fields requirements (validated strictly against authoritative saved definitions)
        if (Array.isArray(methodConfig.customFields) && methodConfig.customFields.length > 0) {
          const submittedCustomAnswers = extractCustomFieldAnswers(
            proofNote,
            req.body?.customFieldValues,
            req.body?.customFields
          );

          for (const cf of methodConfig.customFields) {
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
            }
          }
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
        currency: currency || 'PKR',
        type: effectiveType,
        ...(safeSubscriptionPlan ? { plan: safeSubscriptionPlan } : {}),
        status: 'Pending',
        paymentMethod: resolvedPaymentMethodName,
        ...(paymentMethod === 'Wallet Balance' ? { walletMutationState: 'NONE' as WalletMutationState } : {}),
        transactionId: tid,
        idempotencyKey: idempotencyKey || undefined,
        senderName: cleanSenderName || senderName || effectiveUserName || 'Customer',
        senderPhoneOrAccount: cleanSenderPhone || senderPhoneOrAccount,
        depositBankOrWalletName,
        proofScreenshotUrl: cleanScreenshot || proofScreenshotUrl,
        proofNote,
        userId: effectiveUserId,
        userName: effectiveUserName,
        userEmail: effectiveUserEmail,
        jobTitleRef: jobTitleRef || safeAdTitleRef,
        jobIdRef: safeJobIdRef,
        ...(safeAdIdRef ? { adIdRef: safeAdIdRef } : {}),
        ...(safeAdTitleRef ? { adTitleRef: safeAdTitleRef } : {}),
        ...(resolvedAdPricingSnapshot ? { adPricingSnapshot: resolvedAdPricingSnapshot } : {}),
        pricingBreakdown,
        createdAt: new Date().toISOString()
      });

      let finalStatus: 'Pending' | 'Success' = 'Pending';

      if (paymentMethod === 'Wallet Balance') {
        let walletMutationState: WalletMutationState = 'NONE';
        let effectiveBalanceBefore = previousWalletBalance;
        let effectiveBalanceAfter = previousWalletBalance;

        try {
          if (effectiveType === 'Subscription') {
            await persistTransactionState(
              newTx.id,
              { walletMutationState: 'DEDUCTING', updatedAt: new Date().toISOString() },
              { key: 'walletMutationState', expected: 'DEDUCTING' }
            );
            walletMutationState = 'DEDUCTING';
            newTx.walletMutationState = 'DEDUCTING';

            const subDurationDays = authoritativeSubDuration;
            const subscriptionExpiresAt = new Date(Date.now() + subDurationDays * 24 * 60 * 60 * 1000).toISOString();
            let updatedUser: any = null;
            try {
              updatedUser = await UserRepository.deductWalletBalanceAsync(
                effectiveUserId,
                enforcedAmount,
                {
                  membershipTier: safeSubscriptionPlan || 'Pro Alerts',
                  membershipStatus: 'Active',
                  subscriptionExpiresAt
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
          } else {
            if (enforcedAmount > 0) {
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
          const failedAt = new Date().toISOString();
          const failureReason = walletProcessingErr?.message || 'Wallet Balance processing failed.';
          const nextStatus = canSafelyMarkTransactionFailed(walletMutationState) ? 'Failed' : 'Pending';

          await PaymentRepository.updateAsync(newTx.id, {
            status: nextStatus,
            walletMutationState,
            rejectionReason: failureReason
          });
          newTx.status = nextStatus;
          newTx.walletMutationState = walletMutationState;
          newTx.rejectionReason = failureReason;
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
