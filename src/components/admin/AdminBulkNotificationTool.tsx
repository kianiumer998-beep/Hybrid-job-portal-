import React, { useState, useMemo } from 'react';
import { 
  Send, 
  Users, 
  Bell, 
  Mail, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Eye, 
  Layers, 
  FileText, 
  AlertCircle, 
  ExternalLink,
  Flame,
  Zap,
  Crown,
  Trash2,
  Copy
} from 'lucide-react';
import { UserAccount, Subscriber, Job } from '../../types/job';

export interface BulkNotificationBroadcast {
  id: string;
  timestamp: string;
  title: string;
  category: string;
  priority: 'normal' | 'high' | 'urgent';
  channel: 'In-App' | 'Email' | 'WhatsApp' | 'Multi-Channel';
  targetAudience: string;
  messageBody: string;
  ctaText?: string;
  ctaUrl?: string;
  recipientsCount: number;
  openRatePercent: number;
  clickRatePercent: number;
  status: 'Delivered' | 'Scheduled' | 'Failed';
}

const INITIAL_BROADCAST_HISTORY: BulkNotificationBroadcast[] = [
  {
    id: 'notif-001',
    timestamp: '2026-08-29 09:30',
    title: '🚀 40+ New US & European Remote Engineering Jobs Ingested',
    category: 'Career Alert',
    priority: 'high',
    channel: 'Multi-Channel',
    targetAudience: 'Pro Subscribers & Active Tech Seekers',
    messageBody: 'Fresh high-paying USD & EUR compensation roles have just been posted with verified direct HR application links.',
    ctaText: 'Explore Remote Roles',
    ctaUrl: '#jobs',
    recipientsCount: 4280,
    openRatePercent: 68.4,
    clickRatePercent: 24.1,
    status: 'Delivered'
  },
  {
    id: 'notif-002',
    timestamp: '2026-08-28 14:15',
    title: '📄 Free Executive ATS Resume Template Released',
    category: 'CV Builder',
    priority: 'normal',
    channel: 'In-App',
    targetAudience: 'All Registered Candidates',
    messageBody: 'Upgrade your resume with our single-column modern tech format designed to bypass Silicon Valley ATS filters.',
    ctaText: 'Build ATS CV Now',
    ctaUrl: '#cv',
    recipientsCount: 8940,
    openRatePercent: 52.0,
    clickRatePercent: 19.5,
    status: 'Delivered'
  },
  {
    id: 'notif-003',
    timestamp: '2026-08-27 18:00',
    title: '🔥 50% Flash Discount on Top Header & Popup Ads',
    category: 'Campaign Promo',
    priority: 'urgent',
    channel: 'Email',
    targetAudience: 'All Employers & Job Posters',
    messageBody: 'Book premier homepage sponsor banners and popup slots at flat 50% off for the next 7 days.',
    ctaText: 'Launch Campaign Slot',
    ctaUrl: '#dashboard',
    recipientsCount: 1450,
    openRatePercent: 41.2,
    clickRatePercent: 12.8,
    status: 'Delivered'
  }
];

const TEMPLATE_PRESETS = [
  {
    id: 'tpl-remote-jobs',
    name: '🚀 New High-Paying Remote Tech Jobs',
    category: 'Career Alert',
    priority: 'high' as const,
    channel: 'Multi-Channel' as const,
    target: 'pro_subscribers',
    title: '🚀 25+ High-Paying Remote Tech Roles Ingested (USD/EUR)',
    body: 'Fresh high-intent developer and product roles in US & European startups are now live on the board. Direct application links verified.',
    ctaText: 'Apply to Jobs',
    ctaUrl: '#jobs'
  },
  {
    id: 'tpl-govt-digest',
    name: '📜 Weekly FPSC / PPSC Gazette Digest',
    category: 'Government Notice',
    priority: 'normal' as const,
    channel: 'In-App' as const,
    target: 'all_users',
    title: '📜 Consolidated Government Gazettes (FPSC, WAPDA, PPSC BPS-17+)',
    body: 'New official public sector gazettes published with quota breakdown, challan fee instructions, and closing deadlines.',
    ctaText: 'View Govt Jobs',
    ctaUrl: '#jobs'
  },
  {
    id: 'tpl-renewal-reminder',
    name: '⏰ Pro Subscription Renewal Reminder',
    category: 'Billing Alert',
    priority: 'urgent' as const,
    channel: 'WhatsApp' as const,
    target: 'unpaid_expired',
    title: '⏰ Renew Your Pro Job Alert Subscription (PKR 300)',
    body: 'Your 30-day Pro alert access is expiring soon. Renew now to continue receiving instant WhatsApp digests and ATS CV features.',
    ctaText: 'Renew Pro Membership',
    ctaUrl: '#dashboard'
  },
  {
    id: 'tpl-flash-promo',
    name: '⚡ 50% Flash Discount on Ad Campaigns',
    category: 'Employer Promo',
    priority: 'high' as const,
    channel: 'Email' as const,
    target: 'employers_only',
    title: '⚡ 50% Discount on Top Header & Lightbox Ad Campaigns',
    body: 'Boost candidate applications for your open positions with prime homepage placements at 50% off standard rates.',
    ctaText: 'Claim 50% Slot',
    ctaUrl: '#dashboard'
  }
];

interface AdminBulkNotificationToolProps {
  users?: UserAccount[];
  subscribers?: Subscriber[];
  onBroadcastSent?: (broadcast: BulkNotificationBroadcast) => void;
}

export const AdminBulkNotificationTool: React.FC<AdminBulkNotificationToolProps> = ({
  users = [],
  subscribers = [],
  onBroadcastSent
}) => {
  const [history, setHistory] = useState<BulkNotificationBroadcast[]>(() => {
    try {
      const saved = localStorage.getItem('hybrid_admin_broadcast_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_BROADCAST_HISTORY;
  });

  // Form State
  const [targetAudience, setTargetAudience] = useState<string>('all_users');
  const [channel, setChannel] = useState<'In-App' | 'Email' | 'WhatsApp' | 'Multi-Channel'>('Multi-Channel');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('high');
  const [category, setCategory] = useState<string>('Career Alert');
  const [title, setTitle] = useState<string>('🚀 Verified Remote Tech Jobs Added (USD / PKR)');
  const [messageBody, setMessageBody] = useState<string>('New high-paying remote roles in software engineering, UI/UX, and data analytics have just been listed. Apply before deadline.');
  const [ctaText, setCtaText] = useState<string>('View Verified Openings');
  const [ctaUrl, setCtaUrl] = useState<string>('#jobs');

  // Preview Mode
  const [previewChannel, setPreviewChannel] = useState<'In-App' | 'Email' | 'WhatsApp'>('In-App');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);

  // Persist broadcast history
  React.useEffect(() => {
    try {
      localStorage.setItem('hybrid_admin_broadcast_history', JSON.stringify(history));
    } catch (e) {}
  }, [history]);

  // Calculate Audience Count dynamically
  const audienceEstimate = useMemo(() => {
    const totalUsers = Math.max(users.length, 1240);
    const totalSubs = Math.max(subscribers.length, 380);

    switch (targetAudience) {
      case 'all_users':
        return totalUsers + totalSubs;
      case 'pro_subscribers':
        return Math.round(totalSubs * 1.8);
      case 'free_users':
        return Math.round(totalUsers * 0.7);
      case 'employers_only':
        return Math.round(totalUsers * 0.22);
      case 'unpaid_expired':
        return Math.round(totalUsers * 0.15);
      case 'active_jobseekers':
        return Math.round(totalUsers * 0.85);
      default:
        return totalUsers;
    }
  }, [targetAudience, users.length, subscribers.length]);

  const handleApplyTemplate = (tpl: typeof TEMPLATE_PRESETS[0]) => {
    setTitle(tpl.title);
    setMessageBody(tpl.body);
    setCategory(tpl.category);
    setPriority(tpl.priority);
    setChannel(tpl.channel);
    setTargetAudience(tpl.target);
    setCtaText(tpl.ctaText);
    setCtaUrl(tpl.ctaUrl);
  };

  const handleDispatchBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !messageBody.trim()) {
      alert('Please provide a subject title and message body.');
      return;
    }

    setIsSending(true);

    setTimeout(() => {
      const now = new Date();
      const nowStr = now.toISOString().replace('T', ' ').substring(0, 16);

      const newBroadcast: BulkNotificationBroadcast = {
        id: `notif-${Date.now()}`,
        timestamp: nowStr,
        title: title.trim(),
        category: category.trim(),
        priority,
        channel,
        targetAudience: getAudienceLabel(targetAudience),
        messageBody: messageBody.trim(),
        ctaText: ctaText.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        recipientsCount: audienceEstimate,
        openRatePercent: Math.round(55 + Math.random() * 20),
        clickRatePercent: Math.round(15 + Math.random() * 12),
        status: 'Delivered'
      };

      setHistory((prev) => [newBroadcast, ...prev]);
      if (onBroadcastSent) {
        onBroadcastSent(newBroadcast);
      }

      setIsSending(false);
      setSendSuccessMsg(`Broadcast dispatched successfully to ${audienceEstimate.toLocaleString()} recipients across ${channel}!`);
      setTimeout(() => setSendSuccessMsg(null), 5000);
    }, 1200);
  };

  const getAudienceLabel = (key: string) => {
    switch (key) {
      case 'all_users': return 'All Registered Users & Subscribers';
      case 'pro_subscribers': return 'Pro Paid Subscribers';
      case 'free_users': return 'Free Tier Candidates';
      case 'employers_only': return 'Employers & Recruiters';
      case 'unpaid_expired': return 'Unpaid / Expired Accounts';
      case 'active_jobseekers': return 'Active Job Applicants';
      default: return 'Custom Audience Segment';
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-black text-white">Bulk Notification & Multi-Channel Broadcast Center</h3>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                Tier & Plan Filtered
              </span>
            </div>
            <p className="text-xs text-slate-400">Dispatch customized push notifications, email blasts, and WhatsApp alerts to filtered user groups</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 font-semibold">Active Audience Reach:</span>
          <span className="font-mono font-black text-emerald-400">{audienceEstimate.toLocaleString()} Recipients</span>
        </div>
      </div>

      {/* Success Notification Alert */}
      {sendSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-200 flex items-center space-x-3 shadow-xl animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{sendSuccessMsg}</span>
        </div>
      )}

      {/* Quick Template Presets Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span className="flex items-center space-x-1.5 text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>High-Converting Broadcast Presets</span>
          </span>
          <span className="text-[11px] text-slate-500">1-Click Auto-Fill</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {TEMPLATE_PRESETS.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleApplyTemplate(tpl)}
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 text-left transition-all cursor-pointer group"
            >
              <div className="font-bold text-xs text-white group-hover:text-indigo-300 truncate">
                {tpl.name}
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-slate-400 pt-1">
                <span>{tpl.channel}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{tpl.category}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Composer & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Composer Form (7 Cols) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-black text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Broadcast Composer</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400">Target: ~{audienceEstimate.toLocaleString()} Users</span>
          </div>

          <form onSubmit={handleDispatchBroadcast} className="space-y-3.5 text-xs">
            
            {/* Target Audience & Channel Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Target Audience Plan *</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="all_users">All Registered Users (Global)</option>
                  <option value="pro_subscribers">⭐ Pro Paid Subscribers (WhatsApp Alerts)</option>
                  <option value="free_users">🆓 Free Tier Candidates Only</option>
                  <option value="employers_only">🏢 Employers & Job Posters Only</option>
                  <option value="unpaid_expired">⏰ Unpaid / Expired Membership Users</option>
                  <option value="active_jobseekers">💼 Candidates with Applied History</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Delivery Channel *</label>
                <select
                  value={channel}
                  onChange={(e) => {
                    const ch = e.target.value as any;
                    setChannel(ch);
                    if (ch !== 'Multi-Channel') {
                      setPreviewChannel(ch);
                    }
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                >
                  <option value="Multi-Channel">⚡ Multi-Channel (Push + Email + WhatsApp)</option>
                  <option value="In-App">🔔 In-App Push Notification Bell</option>
                  <option value="Email">📧 Direct Email Broadcast</option>
                  <option value="WhatsApp">💬 Direct WhatsApp Alert Digest</option>
                </select>
              </div>
            </div>

            {/* Priority & Category Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Priority Level</label>
                <div className="flex items-center space-x-2">
                  {[
                    { id: 'normal', label: 'Normal', color: 'bg-indigo-500' },
                    { id: 'high', label: 'High', color: 'bg-amber-500' },
                    { id: 'urgent', label: 'Urgent', color: 'bg-rose-500' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id as any)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        priority === p.id 
                          ? `${p.color} text-slate-950 font-black shadow-md` 
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Category Badge</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Career Alert, Govt Gazette, Promo"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Notification Title / Subject */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">Broadcast Title / Subject Line *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🚀 40+ New US & European Remote Engineering Jobs Ingested"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">Message Content *</label>
              <textarea
                required
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type your announcement, job digest description, or promotional discount message here..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
            </div>

            {/* CTA Button Text & URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Call-to-Action (CTA) Text</label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="e.g. Apply to Jobs, Build ATS CV"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Action Link URL or Tab</label>
                <input
                  type="text"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="e.g. #jobs, #cv, #alerts, https://..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Submit Dispatch Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSending}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Dispatching Broadcast Stream...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Dispatch Broadcast to {audienceEstimate.toLocaleString()} Users</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Right Col: Live Channel Preview Mockup (5 Cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-black text-white flex items-center space-x-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span>Live Recipient Preview</span>
            </h4>

            {/* Preview Channel Toggle */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
              {(['In-App', 'Email', 'WhatsApp'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setPreviewChannel(ch)}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    previewChannel === ch
                      ? 'bg-indigo-500 text-white font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            
            {/* IN-APP TOAST NOTIFICATION PREVIEW */}
            {previewChannel === 'In-App' && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 shadow-2xl space-y-3 animate-fade-in relative overflow-hidden">
                <div className="flex items-start space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {category || 'Notification'}
                      </span>
                      <span className="text-[10px] text-slate-500">Just Now</span>
                    </div>
                    <div className="text-xs font-black text-white leading-snug">
                      {title || 'Broadcast Subject'}
                    </div>
                    <p className="text-[11px] text-slate-300 pt-1 leading-relaxed">
                      {messageBody || 'Message preview content...'}
                    </p>

                    {ctaText && (
                      <div className="pt-2.5">
                        <span className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px] shadow-sm">
                          <span>{ctaText}</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* EMAIL TEMPLATE PREVIEW */}
            {previewChannel === 'Email' && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl space-y-3 animate-fade-in text-xs">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>From: <strong>HybridJobs Career Desk &lt;alerts@hybridjobs.pk&gt;</strong></span>
                  <span className="text-emerald-400 font-semibold">Inbox</span>
                </div>
                <div className="text-sm font-black text-white">
                  {title || 'Email Subject Line'}
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {messageBody || 'Email message body text will appear here with styled HTML formatting.'}
                  </p>
                  {ctaText && (
                    <div className="pt-1">
                      <span className="inline-block px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">
                        {ctaText}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                  © 2026 HybridJobs.pk • You received this because you subscribed to career alerts.
                </div>
              </div>
            )}

            {/* WHATSAPP MESSAGE PREVIEW */}
            {previewChannel === 'WhatsApp' && (
              <div className="p-4 rounded-2xl bg-[#0b141a] border border-emerald-500/30 shadow-2xl space-y-2 animate-fade-in text-xs font-sans">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">
                    HJ
                  </div>
                  <div className="text-[11px] font-bold text-white">HybridJobs Official Stream ✓</div>
                </div>

                <div className="bg-[#1f2c34] p-3.5 rounded-2xl rounded-tl-sm text-slate-100 space-y-2 shadow-md">
                  <div className="font-bold text-emerald-400 text-xs">
                    🔔 {title}
                  </div>
                  <p className="text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {messageBody}
                  </p>
                  {ctaText && (
                    <div className="text-[10px] text-teal-300 font-mono pt-1">
                      🔗 Link: {ctaUrl || 'https://hybridjobs.pk'}
                    </div>
                  )}
                  <div className="text-[9px] text-slate-400 text-right">
                    10:15 AM ✓✓
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
            <strong>Audience Targeting:</strong> Matches active plan status, email notifications preferences, and registered candidate phone numbers.
          </div>
        </div>

      </div>

      {/* Broadcast History Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Broadcast Dispatch History & Delivery Metrics</span>
          </h4>
          <span className="text-xs font-mono text-slate-400">{history.length} Broadcasts Logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Title & Category</th>
                <th className="pb-3">Channel</th>
                <th className="pb-3">Target Segment</th>
                <th className="pb-3 text-right">Recipients</th>
                <th className="pb-3 text-right">Open Rate</th>
                <th className="pb-3 text-right">Click Rate</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    {item.timestamp}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-bold text-white truncate max-w-xs">{item.title}</div>
                    <span className="text-[10px] text-emerald-400 font-semibold">{item.category}</span>
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {item.channel}
                    </span>
                  </td>
                  <td className="py-3 text-slate-300 text-xs">
                    {item.targetAudience}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-slate-200">
                    {item.recipientsCount.toLocaleString()}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-400">
                    {item.openRatePercent}%
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-indigo-400">
                    {item.clickRatePercent}%
                  </td>
                  <td className="py-3 text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
