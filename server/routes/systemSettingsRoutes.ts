import { Router } from 'express';
import { SystemSettingsRepository, AuditRepository } from '../db/repositories';
import { requireAdminPermission } from '../auth/authManager';

export const systemSettingsRouter = Router();

// GET Communication Settings (Features + WhatsApp Support + Provider Config)
systemSettingsRouter.get('/communication', async (req, res) => {
  try {
    const whatsAppSupportConfig = await SystemSettingsRepository.getWhatsAppSupportConfig();
    const config = await SystemSettingsRepository.getCommConfig();
    
    return res.json({
      success: true,
      whatsAppSupportConfig,
      config
    });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error fetching communication settings:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching communication settings.'
    });
  }
});

// UPDATE Communication Settings
systemSettingsRouter.put('/communication', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const user = (req as any).user;
    const { whatsAppSupportConfig, ...commConfig } = req.body;

    if (whatsAppSupportConfig) {
      await SystemSettingsRepository.saveWhatsAppSupportConfig(whatsAppSupportConfig);
    }

    if (Object.keys(commConfig).length > 0) {
      await SystemSettingsRepository.saveCommConfig(commConfig);
    }

    AuditRepository.add({
      user: user?.name || user?.email || 'Administrator',
      role: user?.role || 'System Manager',
      action: 'Communication Settings Updated',
      target: 'System Settings',
      status: 'Success',
      metadata: {
        updatedWhatsAppSupport: !!whatsAppSupportConfig,
        updatedCommConfig: Object.keys(commConfig).length > 0
      }
    });

    return res.json({
      success: true,
      message: 'Communication settings updated successfully.'
    });
  } catch (err: any) {
    console.error('[SystemSettingsRoutes] Error updating communication settings:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while updating communication settings.'
    });
  }
});
