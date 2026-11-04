import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';

export interface ApplyGateMetadata {
  requiresUpgrade: boolean;
  title?: string;
  message?: string;
  requiredFields?: string[];
}

export async function evaluateApplyAccess(
  user: any,
  job: any,
  applySettings: any,
  isPremiumPrecalculated?: boolean
): Promise<{ allowed: boolean; gate?: ApplyGateMetadata }> {
  // 1. Admin bypass
  if (user?.role === 'Admin' || user?.role === 'Super Admin') {
    return { allowed: true };
  }

  const globalGateEnabled = !!applySettings.applyButtonRequiresPremium;
  const hints = job._visibilityHints || {};
  const fieldVisibility = job.fieldVisibility || {};
  
  const checkFields = ['applicationUrl', 'externalApplyUrl'];
  const hasPremiumField = checkFields.some(field => {
    return fieldVisibility[field] === 'Premium' || hints[field]?.requiresUpgrade;
  });

  // 1-A. Short-circuit: If no gates are active, allow access without checking membership
  if (!globalGateEnabled && !hasPremiumField) {
    return { allowed: true };
  }

  // 2. Membership verification (Authoritative)
  const userId = user?.userId || user?.id;
  const isPremium = isPremiumPrecalculated !== undefined 
    ? isPremiumPrecalculated 
    : await JobVisibilityRepository.isUserPremiumAuthoritative(userId);

  if (isPremium) {
    return { allowed: true };
  }

  // 3. Evaluate restrictions for non-premium users
  if (globalGateEnabled) {
    return {
      allowed: false,
      gate: {
        requiresUpgrade: true,
        title: applySettings.premiumPopupTitle,
        message: applySettings.premiumPopupMessage
      }
    };
  }

  const lockedFields = checkFields.filter(field => {
    return fieldVisibility[field] === 'Premium' || hints[field]?.requiresUpgrade;
  });

  if (lockedFields.length > 0) {
    const fieldKey = lockedFields[0];
    const customMessage = applySettings.premiumFieldMessages?.[fieldKey] || applySettings.premiumPopupMessage;
    
    return {
      allowed: false,
      gate: {
        requiresUpgrade: true,
        title: applySettings.premiumPopupTitle,
        message: customMessage,
        requiredFields: lockedFields
      }
    };
  }

  return { allowed: true };
}
