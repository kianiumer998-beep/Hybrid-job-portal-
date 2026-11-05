import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdminPermission } from '../auth/authManager';

export const ALLOWED_MODAL_FIELDS: Record<string, string[]> = {
  premiumUpgrade: ['customTitle', 'customMessage', 'benefit1Title', 'benefit1Desc', 'benefit2Title', 'benefit2Desc', 'benefit3Title', 'benefit3Desc', 'ctaText', 'footerNote'],
  candidateApplication: ['title', 'instructions', 'contactHeading', 'resumeHeading', 'submitCta', 'successMsg'],
  subscription: ['badgeText', 'title', 'subtitle', 'packageSectionTitle', 'submitCta'],
  cvPaywall: ['title', 'subtitle', 'packageTitle', 'priceDisplay', 'bullet1', 'bullet2', 'bullet3', 'ctaText', 'footerNote'],
  authModal: ['loginTab', 'registerTab', 'loginTitle', 'registerTitle', 'loginCta', 'registerCta'],
  adminLogin: ['title', 'subtitle', 'ctaText'],
  countrySelection: ['title', 'subtitle', 'ctaText'],
  legalDisclaimer: ['title', 'subtitle', 'noticeText', 'acceptCta']
};

/**
 * Validates whether a value in cvPaywall.priceDisplay represents a fixed monetary price.
 * Fixed prices are rejected because single CV exports do not have a dedicated checkout transaction.
 */
export function isCvPaywallPriceRejected(val: string): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;

  // 1. Numeric-only values (e.g., "150", "150.00", "150,00", " 150 ")
  if (/^\d+(?:[.,]\d+)?(?:\s*\/-)?$/.test(trimmed)) {
    return true;
  }

  // 2. Currency symbol or code followed by digits
  // Covers: PKR 150, Rs. 150, Rs 150, $1, USD 1, EUR 150, €150, GBP 150, £150, INR 150, ₹150
  if (/(?:pkr|rs\.?|rupees?|usd|\$|eur|euros?|€|gbp|pounds?|£|inr|₹)\s*\d+/i.test(trimmed)) {
    return true;
  }

  // 3. Digits followed by currency symbol, currency code, or currency word
  // Covers: 150 PKR, 150 rupees, 150 euros, 150 USD, 150 EUR, 150 GBP, 150 INR, 150$, 150€, 150£, 150₹
  if (/\d+\s*(?:pkr|rs\.?|rupees?|usd|\$|eur|euros?|€|gbp|pounds?|£|inr|₹)\b/i.test(trimmed)) {
    return true;
  }

  // 4. Digits directly attached to currency symbol at end (e.g. 150$, 150€, 150£, 150₹)
  if (/\d+\s*[$€£₹]/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Validates a single modal field value against allowed keys, character limit,
 * XSS/HTML tag prohibition, unsafe control character prohibition, and CV paywall pricing rules.
 */
export function validateModalField(
  modalKey: string,
  fieldKey: string,
  val: any
): { valid: boolean; error?: string; trimmed?: string } {
  const allowedKeys = ALLOWED_MODAL_FIELDS[modalKey];
  if (!allowedKeys) {
    return { valid: false, error: `Unsupported modal ID "${modalKey}".` };
  }
  if (!allowedKeys.includes(fieldKey)) {
    return { valid: false, error: `Unsupported field key "${fieldKey}" for modal "${modalKey}".` };
  }
  if (typeof val !== 'string') {
    return { valid: false, error: `Field "${fieldKey}" in modal "${modalKey}" must be a string.` };
  }

  const trimmed = val.trim();
  if (trimmed.length > 500) {
    return { valid: false, error: `Field "${fieldKey}" in modal "${modalKey}" is too long (max 500 chars).` };
  }

  // Reject HTML/XML markup and unsafe control characters
  if (/<[a-z/!]/i.test(trimmed)) {
    return { valid: false, error: `Field "${fieldKey}" in modal "${modalKey}" contains forbidden HTML/XML markup.` };
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    return { valid: false, error: `Field "${fieldKey}" in modal "${modalKey}" contains unsafe control characters.` };
  }

  // P0 Price Accuracy Protection: cvPaywall single export has no standalone billing amount
  if (modalKey === 'cvPaywall' && fieldKey === 'priceDisplay') {
    if (isCvPaywallPriceRejected(trimmed)) {
      return {
        valid: false,
        error: 'Field "priceDisplay" in modal "cvPaywall" cannot be a fixed monetary price because single CV exports do not have a dedicated checkout transaction. Please use an informational note such as "Price confirmed during payment".'
      };
    }
  }

  return { valid: true, trimmed };
}

/**
 * Pure function to sanitize and safely merge incoming modal settings with current settings.
 * Supports non-destructive field-level merges and single-modal resets.
 */
export function sanitizeAndMergeModalSettings(
  currentModalSettings: any,
  incomingModalSettings: any
): { success: boolean; merged?: Record<string, Record<string, string>>; error?: string } {
  if (typeof incomingModalSettings !== 'object' || Array.isArray(incomingModalSettings) || incomingModalSettings === null) {
    return { success: false, error: 'Invalid modalSettings object.' };
  }

  const currentModals = (currentModalSettings && typeof currentModalSettings === 'object' && !Array.isArray(currentModalSettings))
    ? currentModalSettings
    : {};

  const mergedModals: Record<string, Record<string, string>> = {};

  // 1. Copy all existing modal settings and their fields to preserve unrelated modals & fields
  for (const [mKey, mVal] of Object.entries(currentModals)) {
    if (mVal && typeof mVal === 'object' && !Array.isArray(mVal)) {
      mergedModals[mKey] = { ...(mVal as Record<string, string>) };
    }
  }

  // 2. Validate and merge incoming modal IDs and their fields
  for (const [modalKey, fieldObj] of Object.entries(incomingModalSettings as any)) {
    if (!Object.keys(ALLOWED_MODAL_FIELDS).includes(modalKey)) {
      return { success: false, error: `Unsupported modal ID "${modalKey}".` };
    }
    if (typeof fieldObj !== 'object' || Array.isArray(fieldObj) || fieldObj === null) {
      return { success: false, error: `Invalid field object for modal "${modalKey}".` };
    }

    if (Object.keys(fieldObj).length === 0) {
      // Explicit reset: empty object submitted for this modal clears only this modal's customizations
      mergedModals[modalKey] = {};
      continue;
    }

    const currentModalFields = { ...(mergedModals[modalKey] || {}) };

    for (const [fieldKey, val] of Object.entries(fieldObj as any)) {
      const validation = validateModalField(modalKey, fieldKey, val);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const trimmed = validation.trimmed!;
      if (trimmed === '') {
        delete currentModalFields[fieldKey];
      } else {
        currentModalFields[fieldKey] = trimmed;
      }
    }

    mergedModals[modalKey] = currentModalFields;
  }

  return { success: true, merged: mergedModals };
}

export const applySettingsRouter = Router();

// 1. Get Apply Flow & Button Configuration
applySettingsRouter.get('/', (req, res) => {
  try {
    const settings = Database.getApplySettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching apply settings' });
  }
});

// 2. Update Apply Flow & Button Configuration (Admin Only)
applySettingsRouter.put('/', requireAdminPermission('settings.manage'), (req, res) => {
  try {
    const current = Database.getApplySettings();
    const updated = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Validate new premium gate settings
    if (req.body.applyButtonRequiresPremium !== undefined && typeof req.body.applyButtonRequiresPremium !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid applyButtonRequiresPremium type.' });
    }
    if (req.body.premiumPopupTitle && typeof req.body.premiumPopupTitle !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid premiumPopupTitle type.' });
    }
    if (req.body.premiumPopupMessage && typeof req.body.premiumPopupMessage !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid premiumPopupMessage type.' });
    }
    if (req.body.premiumCtaText !== undefined) {
      if (typeof req.body.premiumCtaText !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid premiumCtaText type.' });
      }
      const trimmedCta = req.body.premiumCtaText.trim();
      if (trimmedCta.length > 80) {
        return res.status(400).json({ success: false, message: 'premiumCtaText is too long (max 80 chars).' });
      }
      updated.premiumCtaText = trimmedCta;
    }
    if (req.body.modalSettings !== undefined) {
      const modalResult = sanitizeAndMergeModalSettings(current.modalSettings, req.body.modalSettings);
      if (!modalResult.success) {
        return res.status(400).json({ success: false, message: modalResult.error });
      }
      updated.modalSettings = modalResult.merged;
    }
    if (req.body.premiumFieldMessages) {
      if (typeof req.body.premiumFieldMessages !== 'object' || Array.isArray(req.body.premiumFieldMessages)) {
        return res.status(400).json({ success: false, message: 'Invalid premiumFieldMessages object.' });
      }
      const allowedKeys = ['applicationUrl', 'externalApplyUrl'];
      for (const [key, msg] of Object.entries(req.body.premiumFieldMessages)) {
        if (!allowedKeys.includes(key)) {
          return res.status(400).json({ success: false, message: `Unsupported field key "${key}" in premiumFieldMessages.` });
        }
        if (typeof msg !== 'string') {
          return res.status(400).json({ success: false, message: `Invalid message type for field "${key}".` });
        }
        if (msg.length > 500) {
          return res.status(400).json({ success: false, message: `Message for field "${key}" is too long (max 500 chars).` });
        }
      }
    }

    Database.saveApplySettings(updated);

    Database.addAuditLog({
      user: (req as any).user?.name || (req as any).user?.email || 'Administrator',
      role: (req as any).user?.role || 'Content Manager',
      action: 'Apply Settings & Form Flow Updated',
      target: 'Candidate Application Experience',
      status: 'Success'
    });

    res.json({ success: true, settings: updated, message: 'Application settings and form flow updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating apply settings' });
  }
});
