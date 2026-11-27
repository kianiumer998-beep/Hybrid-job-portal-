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
      whatsapp: flags.enableWhatsAppAlerts === true,
      sms: flags.enableSmsAlerts === true
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

    const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
      user: user?.name || user?.email || 'Administrator',
      role: user?.role || 'System Manager',
      action: 'WhatsApp Support Settings Updated',
      target: 'System Settings',
      status: 'Success',
      metadata: {
        updatedFields: Object.keys(sanitizedConfig)
      }
    }, 'PUT /api/system-settings/communication');

    return res.json({
      success: true,
      whatsAppSupportConfig: savedConfig,
      message: 'WhatsApp support configuration updated successfully.',
      ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
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

    const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
      user: user?.name || user?.email || 'Administrator',
      role: user?.role || 'System Manager',
      action: 'Custom Registration Form Fields Updated',
      target: 'System Settings',
      status: 'Success',
      metadata: {
        fieldCount: savedFields.length
      }
    }, 'PUT /api/system-settings/custom-form-fields');

    return res.json({
      success: true,
      customFormFields: savedFields,
      message: 'Custom registration form fields updated successfully.',
      ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
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

    let auditOutcome: { persisted: boolean; auditWarning?: string } | null = null;
    if (result.saved) {
      auditOutcome = await AuditRepository.addAfterPrimaryOperation({
        user: user?.name || user?.email || 'Administrator',
        role: user?.role || 'System Manager',
        action: 'Legacy Custom Registration Form Fields Imported',
        target: 'System Settings',
        status: 'Success',
        metadata: {
          fieldCount: result.fields.length
        }
      }, 'POST /api/system-settings/custom-form-fields/import-legacy');
    }

    return res.json({
      success: true,
      saved: result.saved,
      customFormFields: result.fields,
      message: result.saved
        ? 'Legacy custom registration form fields imported successfully.'
        : 'System settings already configured. Existing configuration preserved.',
      ...(auditOutcome && !auditOutcome.persisted
        ? { auditPersisted: false, auditWarning: auditOutcome.auditWarning }
        : {})
    });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error importing legacy custom form fields:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while importing custom form fields.'
    });
  }
});


const USER_DASHBOARD_MENU_MODES = new Set(['classic', 'professional', 'new', 'classic-new']);
const USER_DASHBOARD_DESTINATIONS = new Set([
  'dash-overview', 'jobs-recommended', 'jobs-explore', 'jobs-applications', 'jobs-saved',
  'jobs-alerts', 'career-cv', 'career-docs', 'emp-post', 'emp-listings', 'emp-verification',
  'ads-list', 'ads-create', 'mem-wallet', 'membership-plan', 'wallet-deposit', 'mem-history',
  'mem-whatsapp', 'notifications-center', 'acc-chat', 'acc-profile', 'acc-security'
]);

function validateUserDashboardNavigationConfig(raw: any): { valid: boolean; message?: string; config?: any } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, message: 'Navigation configuration must be an object.' };
  const enabledModes = Array.isArray(raw.enabledModes) ? [...new Set(raw.enabledModes)] : [];
  if (!enabledModes.length || enabledModes.some((mode: any) => typeof mode !== 'string' || !USER_DASHBOARD_MENU_MODES.has(mode))) {
    return { valid: false, message: 'Select at least one valid dashboard menu style.' };
  }
  const defaultMode = String(raw.defaultMode || '');
  if (!enabledModes.includes(defaultMode)) return { valid: false, message: 'Default menu must be one of the enabled menu styles.' };
  if (typeof raw.allowModeSwitching !== 'boolean') return { valid: false, message: 'Menu switching must be a boolean value.' };
  if (!Array.isArray(raw.quickActions) || raw.quickActions.length > 5) return { valid: false, message: 'Quick Actions must contain no more than five entries.' };
  const seen = new Set<string>();
  const quickActions = [];
  for (const item of raw.quickActions) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { valid: false, message: 'Invalid Quick Action entry.' };
    const id = String(item.id || '').trim();
    if (!USER_DASHBOARD_DESTINATIONS.has(id) || seen.has(id)) return { valid: false, message: 'Quick Actions must use unique existing menu destinations.' };
    seen.add(id);
    const label = String(item.label || '').trim();
    const icon = String(item.icon || '').trim();
    const destination = String(item.destination || '').trim();
    if (!label || label.length > 24 || !icon || icon.length > 40) return { valid: false, message: 'Quick Action label or icon is invalid.' };
    if (!destination.startsWith('/') || destination.startsWith('//') || destination.length > 160 || /[\\\\\\r\\n]/.test(destination)) {
      return { valid: false, message: 'Destination must be a valid internal path beginning with one slash.' };
    }
    if (typeof item.enabled !== 'boolean' || typeof item.mobile !== 'boolean' || typeof item.desktop !== 'boolean') {
      return { valid: false, message: 'Quick Action visibility and enabled values must be boolean.' };
    }
    quickActions.push({ id, label, icon, destination, enabled: item.enabled, mobile: item.mobile, desktop: item.desktop });
  }
  return { valid: true, config: { enabledModes, defaultMode, allowModeSwitching: raw.allowModeSwitching, quickActions } };
}

// Public read: contains navigation presentation only; no account or provider secrets.
systemSettingsRouter.get('/user-dashboard-navigation', async (_req, res) => {
  try {
    const config = await SystemSettingsRepository.getUserDashboardNavigationConfig();
    return res.json({ success: true, config });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error fetching user dashboard navigation:', err);
    return res.status(500).json({ success: false, message: err.message || 'Unable to load dashboard navigation settings.' });
  }
});

// Admin-only update. The repository performs a MongoDB-backed write; no JSON/localStorage fallback.
systemSettingsRouter.put('/user-dashboard-navigation', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const validation = validateUserDashboardNavigationConfig(req.body?.config ?? req.body);
    if (!validation.valid || !validation.config) return res.status(400).json({ success: false, message: validation.message });
    const saved = await SystemSettingsRepository.saveUserDashboardNavigationConfig(validation.config);
    const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
      user: (req as any).user?.name || (req as any).user?.email || 'Administrator',
      role: (req as any).user?.role || 'System Manager',
      action: 'User Dashboard Navigation Settings Updated',
      target: 'User Dashboard Navigation',
      status: 'Success',
      metadata: { enabledModes: saved.enabledModes, quickActionCount: saved.quickActions.length }
    }, 'PUT /api/settings/user-dashboard-navigation');
    return res.json({ success: true, config: saved, message: 'User dashboard navigation settings saved.', ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning }) });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error saving user dashboard navigation:', err);
    return res.status(500).json({ success: false, message: err.message || 'Unable to save dashboard navigation settings.' });
  }
});
