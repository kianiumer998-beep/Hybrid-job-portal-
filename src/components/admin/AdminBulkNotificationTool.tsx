import React, { useState, useMemo } from 'react';
import {
  Send,
  Bell,
  Sparkles,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  AlertCircle,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { UserAccount, Subscriber, AdminFeatureFlags } from '../../types/job';

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
  status: 'Delivered' | 'Scheduled' | 'Failed' | 'Draft';
}

export function parseStoredNotificationDrafts(raw: string | null): BulkNotificationBroadcast[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
    title: '⏰ Renew Your Pro Job Alert Subscription',
    body: 'Your 30-day Pro alert access is expiring soon. Renew now to continue receiving job alert digests and ATS CV features.',
    ctaText: 'Renew Pro Membership',
    ctaUrl: '#dashboard'
  },
  {
    id: 'tpl-flash-promo',
    name: '⚡ Promotional Ad Slot Offer',
    category: 'Employer Promo',
    priority: 'high' as const,
    channel: 'Email' as const,
    target: 'employers_only',
    title: '⚡ Promote Your Openings with Top Header & Popup Ad Slots',
    body: 'Boost candidate visibility for your active job openings with homepage placements.',
    ctaText: 'Open Ad Hub',
    ctaUrl: '#dashboard'
  }
];

interface AdminBulkNotificationToolProps {
  users?: UserAccount[];
  subscribers?: Subscriber[];
  featureFlags?: AdminFeatureFlags;
  onBroadcastSent?: (broadcast: BulkNotificationBroadcast) => void;
}

export const AdminBulkNotificationTool: React.FC<AdminBulkNotificationToolProps> = ({
  users = [],
  subscribers = [],
  featureFlags,
  onBroadcastSent
}) => {
  const isEmailEnabled = featureFlags?.enableEmailAlerts === true;
  const isWhatsAppEnabled = featureFlags?.enableWhatsAppAlerts === true;
  const isMultiChannelEnabled = isEmailEnabled && isWhatsAppEnabled;

  const [history, setHistory] = useState<BulkNotificationBroadcast[]>(() => {
    try {
      return parseStoredNotificationDrafts(localStorage.getItem('hybrid_admin_broadcast_history'));
    } catch {
      return [];
    }
  });

  // Form State
  const [targetAudience, setTargetAudience] = useState<string>('all_users');
  const [channel, setChannel] = useState<'In-App' | 'Email' | 'WhatsApp' | 'Multi-Channel'>('In-App');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('high');
  const [category, setCategory] = useState<string>('Career Alert');
  const [title, setTitle] = useState<string>('Verified Remote Tech Jobs Added');
  const [messageBody, setMessageBody] = useState<string>(
    'New roles in software engineering, UI/UX, and data analytics have been listed. Review open positions before the closing deadline.'
  );
  const [ctaText, setCtaText] = useState<string>('View Openings');
  const [ctaUrl, setCtaUrl] = useState<string>('#jobs');

  // Preview & Draft Status
  const [previewChannel, setPreviewChannel] = useState<'In-App' | 'Email' | 'WhatsApp'>('In-App');
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    if (channel === 'Multi-Channel' && !isMultiChannelEnabled) {
      setChannel('In-App');
      setPreviewChannel('In-App');
    } else if (channel === 'Email' && !isEmailEnabled) {
      setChannel('In-App');
      setPreviewChannel('In-App');
    } else if (channel === 'WhatsApp' && !isWhatsAppEnabled) {
      setChannel('In-App');
      setPreviewChannel('In-App');
    }
  }, [channel, isEmailEnabled, isWhatsAppEnabled, isMultiChannelEnabled]);

  React.useEffect(() => {
    try {
      localStorage.setItem('hybrid_admin_broadcast_history', JSON.stringify(history));
    } catch {}
  }, [history]);

  const audienceEstimate = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];
    const totalUsers = safeUsers.length;
    const totalSubs = safeSubscribers.length;

    switch (targetAudience) {
      case 'all_users':
        return totalUsers + totalSubs;
      case 'pro_subscribers':
        return totalSubs;
      case 'free_users':
        return safeUsers.filter((u) => u.plan === 'Free').length;
      case 'employers_only':
        return safeUsers.filter((u) => u.role?.toLowerCase()?.includes('employer') || u.companyName).length;
      case 'unpaid_expired':
        return safeUsers.filter((u) => u.paymentStatus === 'Unpaid' || u.membershipStatus === 'Expired').length;
      case 'active_jobseekers':
        return safeUsers.filter((u) => Array.isArray(u.appliedJobs) && u.appliedJobs.length > 0).length;
      default:
        return totalUsers;
    }
  }, [targetAudience, users, subscribers]);

  const getAudienceLabel = (key: string) => {
    switch (key) {
      case 'all_users':
        return 'All Registered Users & Subscribers';
      case 'pro_subscribers':
        return 'Pro Paid Subscribers';
      case 'free_users':
        return 'Free Tier Candidates';
      case 'employers_only':
        return 'Employers & Recruiters';
      case 'unpaid_expired':
        return 'Unpaid / Expired Accounts';
      case 'active_jobseekers':
        return 'Active Job Applicants';
      default:
        return 'Custom Audience Segment';
    }
  };

  const handleApplyTemplate = (tpl: typeof TEMPLATE_PRESETS[0]) => {
    setTitle(tpl.title);
    setMessageBody(tpl.body);
    setCategory(tpl.category);
    setPriority(tpl.priority);
    if (
      (tpl.channel === 'Email' && isEmailEnabled) ||
      (tpl.channel === 'WhatsApp' && isWhatsAppEnabled) ||
      (tpl.channel === 'Multi-Channel' && isMultiChannelEnabled) ||
      tpl.channel === 'In-App'
    ) {
      setChannel(tpl.channel);
    } else {
      setChannel('In-App');
    }
    setTargetAudience(tpl.target);
    setCtaText(tpl.ctaText);
    setCtaUrl(tpl.ctaUrl);
    setSaveNotice(null);
  };

  const handleSaveLocalDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !messageBody.trim()) {
      setSaveNotice({
        type: 'error',
        message: 'Please provide both a subject title and message body before saving a draft.'
      });
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newDraft: BulkNotificationBroadcast = {
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
      openRatePercent: 0,
      clickRatePercent: 0,
      status: 'Draft'
    };

    setHistory((prev) => [newDraft, ...prev]);
    if (onBroadcastSent) {
      onBroadcastSent(newDraft);
    }

    setSaveNotice({
      type: 'success',
      message:
        'Notification draft saved locally in this browser. Live multi-channel delivery is not connected in this tool (use Broadcast Center for server-saved campaigns).'
    });
  };

  const handleDeleteDraft = (draftId: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== draftId));
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-white">Bulk Notification Draft Builder</h3>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                Local Drafts Only — Delivery Not Connected Here
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Compose notification templates, estimate target audience size from loaded records, preview formatting, and store browser-local drafts. External Email/WhatsApp dispatch is not sent from this tool.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs shrink-0">
          <span className="text-slate-400 font-semibold">Estimated Reach:</span>
          <span className="font-mono font-black text-emerald-400">{audienceEstimate.toLocaleString()} Records</span>
        </div>
      </div>

      {/* Save / Validation Status */}
      {saveNotice && (
        <div
          role={saveNotice.type === 'error' ? 'alert' : 'status'}
          className={`p-4 rounded-2xl border-2 flex items-center space-x-3 shadow-xl animate-fade-in ${
            saveNotice.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}
        >
          {saveNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-bold">{saveNotice.message}</span>
        </div>
      )}

      {/* Quick Template Presets Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span className="flex items-center space-x-1.5 text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Notification Draft Templates</span>
          </span>
          <span className="text-[11px] text-slate-500">1-Click Auto-Fill</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {TEMPLATE_PRESETS.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
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
              <span>Notification Draft Composer</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400">
              Segment: ~{audienceEstimate.toLocaleString()} Users
            </span>
          </div>

          <form onSubmit={handleSaveLocalDraft} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Target Audience Segment *</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="all_users">All Registered Users &amp; Subscribers</option>
                  <option value="pro_subscribers">Pro Paid Subscribers</option>
                  <option value="free_users">Free Tier Candidates Only</option>
                  <option value="employers_only">Employers &amp; Job Posters Only</option>
                  <option value="unpaid_expired">Unpaid / Expired Membership Users</option>
                  <option value="active_jobseekers">Candidates with Applied History</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Intended Channel Tag *</label>
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
                  <option value="In-App">In-App Notification Preview</option>
                  <option value="Multi-Channel" disabled={!isMultiChannelEnabled}>
                    Multi-Channel {!isMultiChannelEnabled ? '(Disabled by Feature Flags)' : '(Draft Only)'}
                  </option>
                  <option value="Email" disabled={!isEmailEnabled}>
                    Email {!isEmailEnabled ? '(Disabled by Feature Flags)' : '(Draft Only)'}
                  </option>
                  <option value="WhatsApp" disabled={!isWhatsAppEnabled}>
                    WhatsApp {!isWhatsAppEnabled ? '(Disabled by Feature Flags)' : '(Draft Only)'}
                  </option>
                </select>
              </div>
            </div>

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

            <div>
              <label className="block font-bold text-slate-300 mb-1">Draft Title / Subject Line *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter draft notification subject..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Message Content *</label>
              <textarea
                required
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type your draft announcement or job digest description..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
            </div>

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

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-black text-sm shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950"
              >
                <Send className="w-4 h-4" />
                <span>Save Local Draft ({audienceEstimate.toLocaleString()} Estimated Audience)</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Col: Format Preview (5 Cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-black text-white flex items-center space-x-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span>Template Format Preview</span>
            </h4>

            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
              {(['In-App', 'Email', 'WhatsApp'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setPreviewChannel(ch)}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    previewChannel === ch ? 'bg-indigo-500 text-white font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
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
                      <span className="text-[10px] text-slate-500">Draft Preview</span>
                    </div>
                    <div className="text-xs font-black text-white leading-snug">{title || 'Draft Subject'}</div>
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

            {previewChannel === 'Email' && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl space-y-3 animate-fade-in text-xs">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Email Template Mockup</span>
                  <span className="text-amber-400 font-semibold">Draft</span>
                </div>
                <div className="text-sm font-black text-white">{title || 'Email Subject Line'}</div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {messageBody || 'Email message body text preview.'}
                  </p>
                  {ctaText && (
                    <div className="pt-1">
                      <span className="inline-block px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">
                        {ctaText}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {previewChannel === 'WhatsApp' && (
              <div className="p-4 rounded-2xl bg-[#0b141a] border border-emerald-500/30 shadow-2xl space-y-2 animate-fade-in text-xs font-sans">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">
                    HJ
                  </div>
                  <div className="text-[11px] font-bold text-white">WhatsApp Format Preview</div>
                </div>

                <div className="bg-[#1f2c34] p-3.5 rounded-2xl rounded-tl-sm text-slate-100 space-y-2 shadow-md">
                  <div className="font-bold text-emerald-400 text-xs">{title}</div>
                  <p className="text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">{messageBody}</p>
                  {ctaText && (
                    <div className="text-[10px] text-teal-300 font-mono pt-1">
                      Link: {ctaUrl || '#jobs'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
            <strong>Storage Scope:</strong> Saved drafts remain only in this browser&apos;s localStorage. Live delivery requires connecting a configured provider in Broadcast Center.
          </div>
        </div>
      </div>

      {/* Saved Local Drafts Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Saved Local Drafts</span>
          </h4>
          <span className="text-xs font-mono text-slate-400">{history.length} Local Drafts</span>
        </div>

        {history.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
            No local notification drafts saved yet. Use the composer above to save a browser-local draft.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3">Saved At</th>
                  <th className="pb-3">Title &amp; Category</th>
                  <th className="pb-3">Channel</th>
                  <th className="pb-3">Target Segment</th>
                  <th className="pb-3 text-right">Est. Audience</th>
                  <th className="pb-3 text-right">Status</th>
                  <th className="pb-3 text-right">Action</th>
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
                    <td className="py-3 text-slate-300 text-xs">{item.targetAudience}</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-200">
                      {item.recipientsCount.toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Local Draft (Not Sent)
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(item.id)}
                        aria-label={`Delete draft ${item.title}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
