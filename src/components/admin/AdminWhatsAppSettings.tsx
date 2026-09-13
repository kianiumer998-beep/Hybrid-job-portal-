import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Phone,
  Save,
  CheckCircle2,
  Sliders,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import {
  WhatsAppSupportConfig,
  DEFAULT_WHATSAPP_CONFIG
} from '../WhatsAppStickyButton';

interface AdminWhatsAppSettingsProps {
  config: WhatsAppSupportConfig;
  onSave: (updated: WhatsAppSupportConfig) => void;
}

export const AdminWhatsAppSettings: React.FC<AdminWhatsAppSettingsProps> = ({
  config,
  onSave
}) => {
  const [formData, setFormData] = useState<WhatsAppSupportConfig>(() => ({
    ...DEFAULT_WHATSAPP_CONFIG,
    ...config
  }));
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData((prev) => ({
        ...DEFAULT_WHATSAPP_CONFIG,
        ...prev,
        ...config
      }));
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const cleanPhone = (formData.phoneNumber || '923001234567').replace(/[^0-9]/g, '');
  const testChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    formData.defaultMessage || 'Hello Support'
  )}`;

  return (
    <div
      id="admin-whatsapp-widget-settings"
      className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-6 shadow-xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Floating Support Widget
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Live Visitor Chat Control
            </span>
          </div>
          <h3 className="text-lg font-black text-white flex items-center space-x-2 mt-1">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
            <span>WhatsApp Support Widget Settings</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure the public WhatsApp floating button, support agent credentials, speech bubble text, dimensions, and screen positioning.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href={testChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 cursor-pointer transition-all flex items-center space-x-1.5"
            title="Open test WhatsApp chat in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Test Chat URL</span>
          </a>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-xl p-3 flex items-center space-x-2.5 text-emerald-300 text-xs font-bold shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>WhatsApp settings successfully saved and synced to live portal!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ROW 1: Master Enable Toggle & Screen Position */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <label htmlFor="wa-enable-toggle" className="text-xs font-black text-white cursor-pointer">
                Enable / Disable Widget
              </label>
              <div className="text-[11px] text-slate-400">
                Display floating WhatsApp button to visitors
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="wa-enable-toggle"
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData({ ...formData, enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
            </label>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <label htmlFor="wa-position-select" className="text-xs font-black text-white cursor-pointer">
                Widget Position
              </label>
              <div className="text-[11px] text-slate-400">
                Corner placement on screen
              </div>
            </div>
            <select
              id="wa-position-select"
              value={formData.position}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  position: e.target.value as 'bottom-right' | 'bottom-left'
                })
              }
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="bottom-right">Bottom-Right (Standard)</option>
              <option value="bottom-left">Bottom-Left</option>
            </select>
          </div>
        </div>

        {/* ROW 2: WhatsApp Number, Agent Name, Support Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              WhatsApp Number *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                +
              </span>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                placeholder="923001234567"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Digits only with country code
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              HR / Support Representative Name *
            </label>
            <input
              type="text"
              value={formData.agentName}
              onChange={(e) =>
                setFormData({ ...formData, agentName: e.target.value })
              }
              placeholder="e.g. Ayesha (Career Advisor)"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Displayed in chat bubble header
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Support Hours Text
            </label>
            <input
              type="text"
              value={formData.supportHoursText}
              onChange={(e) =>
                setFormData({ ...formData, supportHoursText: e.target.value })
              }
              placeholder="Online • 9:00 AM - 9:00 PM PKT"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Availability badge below agent name
            </span>
          </div>
        </div>

        {/* ROW 3: Popup Message & Default WhatsApp Message */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Popup Message (Speech Bubble Prompt)
            </label>
            <textarea
              rows={2}
              value={formData.bubblePromptText || ''}
              onChange={(e) =>
                setFormData({ ...formData, bubblePromptText: e.target.value })
              }
              placeholder="Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Auto-prompt text shown in floating speech bubble
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Default WhatsApp Pre-Filled Message
            </label>
            <textarea
              rows={2}
              value={formData.defaultMessage || ''}
              onChange={(e) =>
                setFormData({ ...formData, defaultMessage: e.target.value })
              }
              placeholder="Hello! I need assistance regarding job applications and career alerts on HybridJobs.pk."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Pre-filled in user's WhatsApp chat screen
            </span>
          </div>
        </div>

        {/* ROW 4: Badge Text, CTA Text, Notification/Unread Count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Badge Text
            </label>
            <input
              type="text"
              value={formData.badgeText || ''}
              onChange={(e) =>
                setFormData({ ...formData, badgeText: e.target.value })
              }
              placeholder="e.g. HR Support"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Pill badge beside agent name
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              CTA Text
            </label>
            <input
              type="text"
              value={formData.ctaText || ''}
              onChange={(e) =>
                setFormData({ ...formData, ctaText: e.target.value })
              }
              placeholder="e.g. Start WhatsApp Chat"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Text on the green chat trigger button
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Notification / Unread Count
            </label>
            <input
              type="number"
              min="0"
              max="99"
              value={formData.unreadCount ?? 1}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unreadCount: parseInt(e.target.value, 10) || 0
                })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Number shown in pulsing badge (0 = hide)
            </span>
          </div>
        </div>

        {/* ROW 5: Size Controls (Mobile, Desktop, Bubble, Icon) */}
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 text-xs font-black text-slate-200">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dimensions & Scale Controls</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Mobile Button Size
              </label>
              <select
                value={formData.mobileSize || 'compact'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mobileSize: e.target.value as 'compact' | 'standard' | 'large'
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="compact">Compact (48px)</option>
                <option value="standard">Standard (56px)</option>
                <option value="large">Large (64px)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Desktop Button Size
              </label>
              <select
                value={formData.desktopSize || 'standard'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    desktopSize: e.target.value as 'compact' | 'standard' | 'large'
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="compact">Compact (56px)</option>
                <option value="standard">Standard (64px)</option>
                <option value="large">Large (80px)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Popup / Bubble Size
              </label>
              <select
                value={formData.bubbleSize || 'standard'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bubbleSize: e.target.value as 'compact' | 'standard' | 'large'
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="compact">Compact (240px)</option>
                <option value="standard">Standard (280px)</option>
                <option value="large">Large (320px)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Icon Size
              </label>
              <select
                value={formData.iconSize || 'standard'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    iconSize: e.target.value as 'compact' | 'standard' | 'large'
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="compact">Compact Icon</option>
                <option value="standard">Standard Icon</option>
                <option value="large">Large Icon</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-500">
            Changes apply instantly to floating button and persist via MongoDB.
          </span>

          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center space-x-2 active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save WhatsApp Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
