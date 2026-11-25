import React from 'react';
import type { CampaignCustomizationConfig } from '../../types/ad';

interface AdminCampaignCustomizerProps {
  config?: CampaignCustomizationConfig;
  onSaveConfig: (updatedConfig: CampaignCustomizationConfig) => void | Promise<unknown>;
  onResetDefaults?: () => void;
  compactMode?: boolean;
}

/**
 * Duplicate display/placement controls are intentionally removed from this UI.
 * Their shared configuration and backend behavior remain unchanged.
 */
export const AdminCampaignCustomizer: React.FC<AdminCampaignCustomizerProps> = () => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
    <h3 className="text-sm sm:text-base font-black text-white">
      Campaign display and placement settings
    </h3>
    <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
      The duplicate controls for popup lightbox, feed ad frequency, banner dimensions,
      banner style and rotation, and call-to-action placement and slots have been removed
      from this section. Manage these settings from the existing Rate Card &amp; Pricing Matrix.
    </p>
  </div>
);

export default AdminCampaignCustomizer;
