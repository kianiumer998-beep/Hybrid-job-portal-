import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Phone,
  Send,
  Save,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Copy,
  Sliders,
  Layers,
  Smartphone,
  Monitor,
  Clock,
  Bell,
  Zap
} from 'lucide-react';
import { WhatsAppSupportConfig, DEFAULT_WHATSAPP_CONFIG } from '../WhatsAppStickyButton';

interface AdminWhatsAppManagerProps {
  config: WhatsAppSupportConfig;
  onUpdateConfig: (updated: WhatsAppSupportConfig) => void;
  subscribersCount?: number;
}

export const AdminWhatsAppManager: React.FC<AdminWhatsAppManagerProps> = ({
  config,
  onUpdateConfig,
  subscribersCount = 0
}) => {
  const [formData, setFormData] = useState<WhatsAppSupportConfig>(() => ({
    ...DEFAULT_WHATSAPP_CONFIG,
    ...config
  }));

  const [groupLink, setGroupLink] = useState<string>(() => {
    return localStorage.getItem('hybrid_whatsapp_group_link') || 'https://chat.whatsapp.com/sampleCareerPakCommunity';
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [testUrduMessage, setTestUrduMessage] = useState(
    'السلام علیکم! کیریئر پاک پر جاب الرٹس اور اپلائی کرنے کے لیے رہنمائی درکار ہے۔'
  );

  // Keep local state in sync if parent config prop updates
  useEffect(() => {
    if (config) {
      setFormData({
        ...DEFAULT_WHATSAPP_CONFIG,
        ...config
      });
    }
  }, [config]);

  const cleanPhone = (formData.phoneNumber || DEFAULT_WHATSAPP_CONFIG.phoneNumber).replace(/[^0-9]/g, '');
  const testChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formData.defaultMessage || DEFAULT_WHATSAPP_CONFIG.defaultMessage)}`;
  const testUrduChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(testUrduMessage)}`;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onUpdateConfig(formData);
    try {
      localStorage.setItem('hybrid_whatsapp_group_link', groupLink);
      localStorage.setItem('hybrid_whatsapp_support_config', JSON.stringify(formData));
    } catch (err) {}
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleRestoreDefaults = () => {
    setFormData(DEFAULT_WHATSAPP_CONFIG);
    onUpdateConfig(DEFAULT_WHATSAPP_CONFIG);
    try {
      localStorage.setItem('hybrid_whatsapp_support_config', JSON.stringify(DEFAULT_WHATSAPP_CONFIG));
    } catch (err) {}
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <MessageCircle className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  WhatsApp Support & Alert Streams Manager
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  واٹس ایپ ایڈمن کنٹرول
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Add, customize, and verify your official WhatsApp Support Number, Community Group Links, auto-reply greetings, bubble prompts, and floating widget sizes across the entire portal.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href={testChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center space-x-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Test Live WhatsApp Chat</span>
            </a>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500 rounded-2xl p-4 flex items-center space-x-3 text-emerald-300 text-sm font-bold shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>WhatsApp configuration saved and deployed site-wide successfully! (سیٹنگز محفوظ ہوگئیں)</span>
        </div>
      )}

      {/* Main Settings Form Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1: Phone & Agent Contact Details */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>1. Official Support WhatsApp Number & Contact (واٹس ایپ نمبر)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Official WhatsApp Number (Country code included) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-500 font-bold text-xs">+</span>
                  <input
                    type="text"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="923001234567 or 923219876543"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Example: <code className="text-emerald-400">923001234567</code> (Do not add spaces or special characters).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Support Representative / Agent Name *
                </label>
                <input
                  type="text"
                  value={formData.agentName}
                  onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                  placeholder="e.g. Ayesha (Lead HR Advisor)"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Displayed on the floating chat tooltip bubble for visitors.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Support Hours & Availability Label
              </label>
              <input
                type="text"
                value={formData.supportHoursText}
                onChange={(e) => setFormData({ ...formData, supportHoursText: e.target.value })}
                placeholder="e.g. Online • 9:00 AM - 9:00 PM PKT"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Default Pre-Filled Message for Candidates (Sent on WhatsApp click)
              </label>
              <textarea
                rows={2}
                value={formData.defaultMessage}
                onChange={(e) => setFormData({ ...formData, defaultMessage: e.target.value })}
                placeholder="Hello! I need assistance regarding job applications on HybridJobs.pk..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                This is the pre-populated URL query message when the candidate arrives inside WhatsApp.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Official WhatsApp Community / Daily Job Alerts Group Link
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="url"
                  value={groupLink}
                  onChange={(e) => setGroupLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(groupLink)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Subscribers who purchase WhatsApp Job Alert Stream will receive this invite link upon confirmation.
              </p>
            </div>
          </div>

          {/* SECTION 2: Widget & Greeting Bubble Customization */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>2. Widget & Greeting Customization</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* WhatsApp Widget Enable/Disable */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-black text-white">WhatsApp Widget</div>
                  <div className="text-[11px] text-slate-400">Show button on public pages</div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {formData.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

              {/* Greeting Bubble Enable/Disable */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-black text-white">Greeting Bubble</div>
                  <div className="text-[11px] text-slate-400">Show prompt tooltip bubble</div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {formData.showGreetingBubble !== false ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showGreetingBubble !== false}
                      onChange={(e) => setFormData({ ...formData, showGreetingBubble: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

              {/* Screen Corner Position */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-black text-white">Screen Position</div>
                  <div className="text-[11px] text-slate-400">Corner layout position</div>
                </div>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="bottom-right">Bottom-Right (Standard)</option>
                  <option value="bottom-left">Bottom-Left</option>
                </select>
              </div>
            </div>

            {/* Visible Greeting Text & CTA Button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Greeting Bubble Message (Visible in floating prompt)
                </label>
                <textarea
                  rows={2}
                  value={formData.greetingText ?? DEFAULT_WHATSAPP_CONFIG.greetingText}
                  onChange={(e) => setFormData({ ...formData, greetingText: e.target.value })}
                  placeholder="Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Greeting CTA Button Label
                </label>
                <input
                  type="text"
                  value={formData.greetingCtaText ?? DEFAULT_WHATSAPP_CONFIG.greetingCtaText}
                  onChange={(e) => setFormData({ ...formData, greetingCtaText: e.target.value })}
                  placeholder="Start WhatsApp Chat"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors mb-2"
                />
                <p className="text-[10px] text-slate-400">
                  Button text inside the speech bubble prompt.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Behavior & Animations */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>3. Behavior, Delays & Badge Toggles</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Auto-Show Delay */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <label className="text-xs font-bold">Auto-Show Delay</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="0.5"
                    value={formData.autoShowDelaySeconds ?? 4.5}
                    onChange={(e) => setFormData({ ...formData, autoShowDelaySeconds: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs text-slate-400 font-bold">sec</span>
                </div>
                <p className="text-[10px] text-slate-500">Delay before bubble opens.</p>
              </div>

              {/* Online Notification Badge */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Bell className="w-3.5 h-3.5 text-emerald-400" />
                  <label className="text-xs font-bold">Online Badge '1'</label>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {formData.showOnlineBadge !== false ? 'SHOW BADGE' : 'HIDE BADGE'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showOnlineBadge !== false}
                      onChange={(e) => setFormData({ ...formData, showOnlineBadge: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

              {/* Pulse Aura Animation */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <label className="text-xs font-bold">Aura Pulse Animation</label>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {formData.enablePulseAnimation !== false ? 'ANIMATION ON' : 'ANIMATION OFF'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enablePulseAnimation !== false}
                      onChange={(e) => setFormData({ ...formData, enablePulseAnimation: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Size & Dimension Presets */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>4. Widget & Icon Size Customization</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Mobile Size */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <label className="text-xs font-bold">Mobile Size</label>
                </div>
                <select
                  value={formData.mobileSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, mobileSize: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (48px)</option>
                  <option value="standard">Standard (56px)</option>
                  <option value="large">Large (64px)</option>
                </select>
              </div>

              {/* Desktop Size */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                  <label className="text-xs font-bold">Desktop Size</label>
                </div>
                <select
                  value={formData.desktopSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, desktopSize: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (56px)</option>
                  <option value="standard">Standard (64px)</option>
                  <option value="large">Large (80px)</option>
                </select>
              </div>

              {/* Icon Size */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <label className="text-xs font-bold">Icon Size</label>
                </div>
                <select
                  value={formData.iconSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, iconSize: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                </select>
              </div>

              {/* Bubble Size */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <label className="text-xs font-bold">Bubble Size</label>
                </div>
                <select
                  value={formData.bubbleSize || 'standard'}
                  onChange={(e) => setFormData({ ...formData, bubbleSize: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="compact">Compact (280px)</option>
                  <option value="standard">Standard (320px)</option>
                  <option value="large">Large (380px)</option>
                </select>
              </div>
            </div>

            {/* ACTION BUTTONS ROW */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Restore Defaults</span>
              </button>

              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Save & Apply WhatsApp Configuration</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Preview & Quick Test */}
        <div className="space-y-6">
          {/* Live Mobile Widget Mockup */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Widget Preview</span>
              </h4>
              <div className="flex items-center space-x-1">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  formData.enabled 
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}>
                  {formData.enabled ? 'Widget Active' : 'Widget Off'}
                </span>
              </div>
            </div>

            {/* Bubble Mockup */}
            {formData.showGreetingBubble !== false ? (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm relative">
                    💬
                    {formData.showOnlineBadge !== false && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border border-slate-900" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">{formData.agentName || 'Career Support'}</div>
                    <div className="text-[10px] text-slate-400">{formData.supportHoursText}</div>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-snug">
                  "{formData.greetingText || DEFAULT_WHATSAPP_CONFIG.greetingText}"
                </div>

                <div className="pt-1">
                  <button type="button" className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center space-x-1">
                    <Send className="w-3 h-3" />
                    <span>{formData.greetingCtaText || 'Start WhatsApp Chat'}</span>
                  </button>
                </div>

                <div className="text-center">
                  <span className="text-[10px] font-mono text-emerald-400">
                    +{cleanPhone || '923001234567'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center text-xs text-slate-400 space-y-1">
                <p className="font-bold text-amber-400">Greeting Bubble Disabled</p>
                <p className="text-[11px]">The sticky button will open WhatsApp directly without showing the speech bubble.</p>
              </div>
            )}

            {/* Urdu Quick Test Message */}
            <div className="pt-2 space-y-2 border-t border-slate-800">
              <label className="block text-[11px] font-bold text-slate-300">
                Urdu Test Message (اردو ٹیسٹ میسج)
              </label>
              <textarea
                rows={2}
                value={testUrduMessage}
                onChange={(e) => setTestUrduMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 resize-none font-urdu text-right"
                dir="rtl"
              />
              <a
                href={testUrduChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Test Send Urdu Greeting on WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Quick Stats & Help Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3 text-xs">
            <div className="flex items-center space-x-2 text-amber-400 font-black">
              <HelpCircle className="w-4 h-4" />
              <span>Admin Guidance (ایڈمن رہنمائی)</span>
            </div>
            <ul className="text-slate-400 space-y-2 text-[11px] leading-relaxed">
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-black">•</span>
                <span>The configured number receives direct candidate queries, CV reviews, and proof of payment submissions.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-black">•</span>
                <span>Greeting Bubble can be toggled on/off independently from the main floating sticky icon.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-black">•</span>
                <span>Active subscribers count: <strong className="text-white">{subscribersCount}</strong> registered users.</span>
              </li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
};

export const AdminWhatsAppSettings = AdminWhatsAppManager;
export default AdminWhatsAppManager;
