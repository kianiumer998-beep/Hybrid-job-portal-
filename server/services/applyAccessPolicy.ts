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
  applySettings: any
): Promise<{ allowed: boolean; gate?: ApplyGateMetadata }> {
  // 1. Admin bypass
  if (user?.role === 'Admin' || user?.role === 'Super Admin') {
    return { allowed: true };
  }

  const isPremium = await JobVisibilityRepository.isUserPremiumAuthoritative(user?.id);

  // 2. Global gate
  if (applySettings.applyButtonRequiresPremium && !isPremium) {
    return {
      allowed: false,
      gate: {
        requiresUpgrade: true,
        title: applySettings.premiumPopupTitle,
        message: applySettings.premiumPopupMessage
      }
    };
  }

  // 3. Field-specific gate
  const fieldVisibility = job.fieldVisibility || {};
  const lockedFields = [];

  for (const [field, visibility] of Object.entries(fieldVisibility)) {
    if (visibility === 'Premium' && !isPremium) {
      if (['applicationUrl', 'externalApplyUrl', 'sourceUrl'].includes(field)) {
        lockedFields.push(field);
      }
    }
  }

  if (lockedFields.length > 0 && !isPremium) {
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
