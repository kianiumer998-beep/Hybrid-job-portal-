import React from 'react';
import { AdminWhatsAppManager } from './AdminWhatsAppManager';
import { WhatsAppSupportConfig } from '../WhatsAppStickyButton';

export interface AdminWhatsAppSettingsProps {
  config: WhatsAppSupportConfig;
  onSave?: (updated: WhatsAppSupportConfig) => void;
  onUpdateConfig?: (updated: WhatsAppSupportConfig) => void;
  subscribersCount?: number;
}

export const AdminWhatsAppSettings: React.FC<AdminWhatsAppSettingsProps> = ({
  config,
  onSave,
  onUpdateConfig,
  subscribersCount
}) => {
  return (
    <AdminWhatsAppManager
      config={config}
      onUpdateConfig={onSave || onUpdateConfig || (() => {})}
      subscribersCount={subscribersCount}
    />
  );
};

export { AdminWhatsAppManager };
export default AdminWhatsAppSettings;

