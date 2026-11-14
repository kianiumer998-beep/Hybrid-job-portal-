import { Router } from 'express';
import { SystemSettingsRepository, FeatureFlagsRepository, AuditRepository } from '../db/repositories';
import {
  isSampleWhatsAppPhoneNumber,
  normalizeWhatsAppPhoneNumber,
  isValidWhatsAppPhoneNumber,
  isSampleWhatsAppGroupLink,
  isValidWhatsAppGroupLink
} from '../db/repositories/SystemSettingsRepository';
import { requireAdminPermission } from '../auth/authManager';

export const systemSettingsRouter = Router();

// GET Public WhatsApp Support Configuration (Publicly accessible for sticky button)
systemSettingsRouter.get('/communication', async (req, res) => {
  try {
    const whatsAppSupportConfig = await SystemSettingsRepository.getWhatsAppSupportConfig();
    const flags = await FeatureFlagsRepository.getFlags();

    const channelAvailability = {
      email: flags.enableEmailAlerts === true,
      whatsapp: flags.enableWhatsAppAlerts === true
    };
    
    return res.json({
      success: true,
      whatsAppSupportConfig,
      channelAvailability
    });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error fetching communication settings:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching communication settings.'
    });
  }
});

// PUT Update WhatsApp Support Configuration (Admin with 'settings.manage' permission only)
systemSettingsRouter.put('/communication', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const user = (req as any).user;
    const { whatsAppSupportConfig } = req.body;

    if (!whatsAppSupportConfig || typeof whatsAppSupportConfig !== 'object' || Array.isArray(whatsAppSupportConfig)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: whatsAppSupportConfig object is required.'
      });
    }

    // Validate explicitly supported WhatsApp support configuration fields and reject unexpected fields
    const allowedKeys = new Set([
      'enabled',
      'phoneNumber',
      'defaultMessage',
      'agentName',
      'supportHoursText',
      'position',
      'showGreetingBubble',
      'greetingText',
      'mobileSize',
      'desktopSize',
      'iconSize',
      'bubbleSize',
      'autoShowDelaySeconds',
      'showOnlineBadge',
      'greetingCtaText',
      'enablePulseAnimation',
      'groupLink'
    ]);

    const sanitizedConfig: Record<string, any> = {};
    for (const key of Object.keys(whatsAppSupportConfig)) {
      if (!allowedKeys.has(key)) {
        return res.status(400).json({
          success: false,
          message: `Validation Error: Unexpected configuration field '${key}' is not permitted.`
        });
      }
      sanitizedConfig[key] = whatsAppSupportConfig[key];
    }

    if ('enabled' in sanitizedConfig && typeof sanitizedConfig.enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: enabled must be a strict boolean.'
      });
    }

    if ('phoneNumber' in sanitizedConfig) {
      if (typeof sanitizedConfig.phoneNumber !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Validation Error: phoneNumber must be a string.'
        });
      }
      const trimmedPhone = sanitizedConfig.phoneNumber.trim();
      if (trimmedPhone === '') {
        sanitizedConfig.phoneNumber = '';
      } else {
        if (isSampleWhatsAppPhoneNumber(trimmedPhone)) {
          return res.status(400).json({
            success: false,
            message: 'Validation Error: Placeholder or sample WhatsApp phone numbers are not permitted.'
          });
        }
        const normalizedPhone = normalizeWhatsAppPhoneNumber(trimmedPhone);
        if (!normalizedPhone) {
          return res.status(400).json({
            success: false,
            message: 'Validation Error: phoneNumber must be a valid international digit number (8-15 digits with country code).'
          });
        }
        sanitizedConfig.phoneNumber = normalizedPhone;
      }
    }

    if ('groupLink' in sanitizedConfig && sanitizedConfig.groupLink !== undefined) {
      if (typeof sanitizedConfig.groupLink !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Validation Error: groupLink must be a string.'
        });
      }
      const trimmedGroupLink = sanitizedConfig.groupLink.trim();
      if (trimmedGroupLink === '') {
        sanitizedConfig.groupLink = '';
      } else if (isSampleWhatsAppGroupLink(trimmedGroupLink)) {
        return res.status(400).json({
          success: false,
          message: 'Validation Error: Placeholder or sample WhatsApp group links are not permitted.'
        });
      } else if (!isValidWhatsAppGroupLink(trimmedGroupLink)) {
        return res.status(400).json({
          success: false,
          message: 'Validation Error: groupLink must be a valid HTTPS invite link on chat.whatsapp.com.'
        });
      } else {
        sanitizedConfig.groupLink = trimmedGroupLink;
      }
    }

    const currentConfig = await SystemSettingsRepository.getWhatsAppSupportConfig();
    const effectiveEnabled =
      'enabled' in sanitizedConfig ? sanitizedConfig.enabled : currentConfig.enabled;
    const effectivePhone =
      'phoneNumber' in sanitizedConfig ? sanitizedConfig.phoneNumber : currentConfig.phoneNumber;

    if (effectiveEnabled === true && !isValidWhatsAppPhoneNumber(effectivePhone)) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Cannot enable WhatsApp support widget without a valid international phoneNumber.'
      });
    }

    const savedConfig = await SystemSettingsRepository.saveWhatsAppSupportConfig(sanitizedConfig);

    AuditRepository.add({
      user: user?.name || user?.email || 'Administrator',
      role: user?.role || 'System Manager',
      action: 'WhatsApp Support Settings Updated',
      target: 'System Settings',
      status: 'Success',
      metadata: {
        updatedFields: Object.keys(sanitizedConfig)
      }
    });

    return res.json({
      success: true,
      whatsAppSupportConfig: savedConfig,
      message: 'WhatsApp support configuration updated successfully.'
    });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error updating communication settings:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while updating communication settings.'
    });
  }
});

// Validation helper for Custom Registration Form Fields
const ALLOWED_FIELD_KEYS = new Set(['id', 'label', 'type', 'options', 'required', 'active']);
const SUPPORTED_FIELD_TYPES = new Set(['text', 'number', 'select', 'textarea']);

function validateCustomFormFields(rawFields: any): { valid: boolean; fields: any[]; message?: string } {
  if (!Array.isArray(rawFields)) {
    return { valid: false, fields: [], message: 'Validation Error: customFormFields must be an array.' };
  }

  if (rawFields.length > 100) {
    return { valid: false, fields: [], message: 'Validation Error: customFormFields array cannot exceed 100 items.' };
  }

  const seenIds = new Set<string>();
  const validatedFields: any[] = [];

  for (let i = 0; i < rawFields.length; i++) {
    const item = rawFields[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, fields: [], message: `Validation Error: Field at index ${i} must be a valid object.` };
    }

    const keys = Object.keys(item);
    for (const key of keys) {
      if (!ALLOWED_FIELD_KEYS.has(key)) {
        return { valid: false, fields: [], message: `Validation Error: Unexpected property '${key}' at field index ${i} is not permitted.` };
      }
    }

    if (typeof item.id !== 'string' || !item.id.trim()) {
      return { valid: false, fields: [], message: `Validation Error: Field at index ${i} requires a non-empty string 'id'.` };
    }
    const trimmedId = item.id.trim();
    if (trimmedId.length > 100) {
      return { valid: false, fields: [], message: `Validation Error: Field ID '${trimmedId}' exceeds maximum limit of 100 characters.` };
    }
    if (seenIds.has(trimmedId)) {
      return { valid: false, fields: [], message: `Validation Error: Duplicate field ID '${trimmedId}' detected at index ${i}.` };
    }
    seenIds.add(trimmedId);

    if (typeof item.label !== 'string' || !item.label.trim()) {
      return { valid: false, fields: [], message: `Validation Error: Field '${trimmedId}' requires a non-empty string 'label'.` };
    }
    if (item.label.trim().length > 250) {
      return { valid: false, fields: [], message: `Validation Error: Field label for '${trimmedId}' exceeds maximum limit of 250 characters.` };
    }

    if (typeof item.type !== 'string' || !SUPPORTED_FIELD_TYPES.has(item.type.trim())) {
      return { valid: false, fields: [], message: `Validation Error: Field '${trimmedId}' has unsupported type '${item.type}'.` };
    }

    if (typeof item.required !== 'boolean') {
      return { valid: false, fields: [], message: `Validation Error: Field '${trimmedId}' requires a strict boolean value for 'required'.` };
    }

    if (typeof item.active !== 'boolean') {
      return { valid: false, fields: [], message: `Validation Error: Field '${trimmedId}' requires a strict boolean value for 'active'.` };
    }

    if (item.options === null) {
      return { valid: false, fields: [], message: `Validation Error: Field '${trimmedId}' options cannot be null.` };
    }

    let cleanOptions: string[] | undefined = undefined;
    if (item.options !== undefined) {
      if (!Array.isArray(item.options)) {
        return { valid: false, fields: [], message: `Validation Error: Field '${trimmedId}' options must be an array of strings.` };
      }
      if (item.options.length > 50) {
        return { valid: false, fields: [], message: `Validation Error: Field '${trimmedId}' options cannot exceed 50 items.` };
      }
      for (let j = 0; j < item.options.length; j++) {
        const opt = item.options[j];
        if (typeof opt !== 'string') {
          return { valid: false, fields: [], message: `Validation Error: Option at index ${j} for field '${trimmedId}' must be a string.` };
        }
        if (opt.length > 250) {
          return { valid: false, fields: [], message: `Validation Error: Option at index ${j} for field '${trimmedId}' exceeds maximum limit of 250 characters.` };
        }
      }
      cleanOptions = item.options.map((o: string) => String(o));
    }

    validatedFields.push({
      id: trimmedId,
      label: item.label.trim(),
      type: item.type.trim(),
      required: item.required,
      active: item.active,
      ...(cleanOptions ? { options: cleanOptions } : {})
    });
  }

  return { valid: true, fields: validatedFields };
}

// GET Public Custom Registration Form Fields (Unauthenticated registration users)
systemSettingsRouter.get('/custom-form-fields', async (req, res) => {
  try {
    const customFormFields = await SystemSettingsRepository.getCustomFormFields();
    return res.json({
      success: true,
      customFormFields
    });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error fetching custom form fields:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while fetching custom form fields.'
    });
  }
});

// PUT Update Custom Registration Form Fields (Admin with 'settings.manage' permission)
systemSettingsRouter.put('/custom-form-fields', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const user = (req as any).user;
    const rawFields = req.body?.customFormFields ?? req.body?.fields ?? req.body;
    const validation = validateCustomFormFields(rawFields);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const savedFields = await SystemSettingsRepository.saveCustomFormFields(validation.fields);

    AuditRepository.add({
      user: user?.name || user?.email || 'Administrator',
      role: user?.role || 'System Manager',
      action: 'Custom Registration Form Fields Updated',
      target: 'System Settings',
      status: 'Success',
      metadata: {
        fieldCount: savedFields.length
      }
    });

    return res.json({
      success: true,
      customFormFields: savedFields,
      message: 'Custom registration form fields updated successfully.'
    });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error updating custom form fields:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while updating custom form fields.'
    });
  }
});

// POST Import Legacy Custom Registration Form Fields (Admin only, atomic onlyIfUnconfigured)
systemSettingsRouter.post('/custom-form-fields/import-legacy', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const user = (req as any).user;
    const rawFields = req.body?.customFormFields ?? req.body?.fields;
    const validation = validateCustomFormFields(rawFields);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const result = await SystemSettingsRepository.importCustomFormFieldsIfUnconfigured(validation.fields);

    if (result.saved) {
      AuditRepository.add({
        user: user?.name || user?.email || 'Administrator',
        role: user?.role || 'System Manager',
        action: 'Legacy Custom Registration Form Fields Imported',
        target: 'System Settings',
        status: 'Success',
        metadata: {
          fieldCount: result.fields.length
        }
      });
    }

    return res.json({
      success: true,
      saved: result.saved,
      customFormFields: result.fields,
      message: result.saved
        ? 'Legacy custom registration form fields imported successfully.'
        : 'System settings already configured. Existing configuration preserved.'
    });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error importing legacy custom form fields:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while importing custom form fields.'
    });
  }
});
