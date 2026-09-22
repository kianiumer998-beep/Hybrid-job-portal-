import React, { useState } from 'react';
import {
  MessageCircle,
  Phone,
  Send,
  Save,
  CheckCircle2,
  ExternalLink,
  Users,
  Clock,
  Sparkles,
  Shield,
  HelpCircle,
  Bell,
  RefreshCw,
  Copy
} from 'lucide-react';
import { WhatsAppSupportConfig } from '../WhatsAppStickyButton';

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
  const [formData, setFormData] = useState<WhatsAppSupportConfig>(config);
  const [groupLink, setGroupLink] = useState<string>(() => {
    return localStorage.getItem('hybrid_whatsapp_group_link') || 'https://chat.whatsapp.com/sampleCareerPakCommunity';
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [testUrduMessage, setTestUrduMessage] = useState(
    'السلام علیکم! کیریئر پاک پر جاب الرٹس اور اپلائی کرنے کے لیے رہنمائی درکار ہے۔'
  );

  const cleanPhone = formData.phoneNumber.replace(/[^0-9]/g, '');
  const testChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formData.defaultMessage || 'Hello Support')}`;
  const testUrduChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(testUrduMessage)}`;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(formData);
    try {
      localStorage.setItem('hybrid_whatsapp_group_link', groupLink);
      localStorage.setItem('hybrid_whatsapp_support_config', JSON.stringify(formData));
    } catch (e) {}
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
                Add, customize, and verify your official WhatsApp Support Number, Community Group Links, auto-reply greetings, and floating chat widget across the entire portal.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href={testChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center space-x-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
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
                Default Pre-Filled Message for Candidates (English)
              </label>
              <textarea
                rows={2}
                value={formData.defaultMessage}
                onChange={(e) => setFormData({ ...formData, defaultMessage: e.target.value })}
                placeholder="Hello! I need assistance regarding job applications on CareerPak..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
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
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-1.5 shrink-0"
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

          {/* Widget Display & Position Controls */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>2. Floating Sticky Button Display Options</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-white">Enable Floating Sticky Widget</div>
                  <div className="text-[11px] text-slate-400">Show button on all public pages</div>
                </div>
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

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-white">Screen Corner Position</div>
                  <div className="text-[11px] text-slate-400">Bottom-Right or Bottom-Left</div>
                </div>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="bottom-right">Bottom-Right (Standard)</option>
                  <option value="bottom-left">Bottom-Left</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center space-x-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer"
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
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                {formData.enabled ? 'Active on Public Site' : 'Disabled'}
              </span>
            </div>

            {/* Bubble Mockup */}
            <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-white">{formData.agentName || 'Career Support'}</div>
                  <div className="text-[10px] text-slate-400">{formData.supportHoursText}</div>
                </div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-snug">
                "{formData.defaultMessage || 'Need help with jobs?'}"
              </div>

              <div className="text-center">
                <span className="text-[10px] font-mono text-emerald-400">
                  +{cleanPhone || '923001234567'}
                </span>
              </div>
            </div>

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
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
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
                <span>Keep your WhatsApp Business app installed on your phone to easily manage quick replies and labels.</span>
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
