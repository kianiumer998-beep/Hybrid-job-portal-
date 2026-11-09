import { Router } from 'express';
import { SystemSettingsRepository, AuditRepository } from '../db/repositories';
import { requireAdminPermission } from '../auth/authManager';

export const systemSettingsRouter = Router();

// GET Public WhatsApp Support Configuration (Publicly accessible for sticky button)
systemSettingsRouter.get('/communication', async (req, res) => {
  try {
    const whatsAppSupportConfig = await SystemSettingsRepository.getWhatsAppSupportConfig();
    
    return res.json({
      success: true,
      whatsAppSupportConfig
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

    if (!whatsAppSupportConfig || typeof whatsAppSupportConfig !== 'object') {
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
