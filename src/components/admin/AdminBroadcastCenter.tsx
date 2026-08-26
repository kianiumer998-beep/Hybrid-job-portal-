import React, { useState } from 'react';
import {
  Megaphone,
  Mail,
  MessageCircle,
  Smartphone,
  Bell,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  Eye,
  Layers,
  Search,
  Filter
} from 'lucide-react';
import { Subscriber, UserAccount } from '../../types/job';
import { BroadcastCampaign, CommunicationProviderConfig } from '../../types/adminSuite';

interface AdminBroadcastCenterProps {
  campaigns?: BroadcastCampaign[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  commConfig?: CommunicationProviderConfig;
  onSendCampaign?: (newCampaign: BroadcastCampaign) => void;
  onUpdateCommConfig?: (updated: CommunicationProviderConfig) => void;
}

export const AdminBroadcastCenter: React.FC<AdminBroadcastCenterProps> = ({
  campaigns = [],
  users = [],
  subscribers = [],
  commConfig,
  onSendCampaign,
  onUpdateCommConfig
}) => {
  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];

  const [campaignList, setCampaignList] = useState<BroadcastCampaign[]>(safeCampaigns);
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'templates' | 'providers'>('compose');

  // Composer state
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<'Email' | 'WhatsApp' | 'SMS' | 'Push Notification' | 'Multi-Channel'>('Email');
  const [targetAudience, setTargetAudience] = useState<
    'All Users' | 'Job Seekers Only' | 'Employers / Posters' | 'Subscribed Members' | 'Unpaid / Expired Users' | 'Government Job Seekers' | 'Overseas / Gulf Candidates'
  >('Job Seekers Only');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Provider Settings state
  const [providerSettings, setProviderSettings] = useState<CommunicationProviderConfig>(
    commConfig || {
      email: { provider: 'SendGrid', apiKey: '', senderEmail: 'jobs@careerpak.pk', senderName: 'CareerPak Alerts', active: true },
      whatsapp: { provider: 'Meta Cloud API', apiKey: '', phoneNumberId: '', templateNamespace: 'job_alert_instant', active: true },
      sms: { provider: 'Twilio', accountSid: '', authToken: '', senderNumber: '', active: false },
      push: { provider: 'OneSignal', appId: '', restApiKey: '', active: true }
    }
  );
  const [providerSaveSuccess, setProviderSaveSuccess] = useState(false);

  // Calculate estimated audience count
  const calculateAudienceCount = () => {
    switch (targetAudience) {
      case 'All Users':
        return safeUsers.length;
      case 'Job Seekers Only':
        return safeUsers.filter(u => !u?.role?.toLowerCase()?.includes('employer') && !u?.companyName).length;
      case 'Employers / Posters':
        return safeUsers.filter(u => u?.role?.toLowerCase()?.includes('employer') || u?.companyName).length;
      case 'Subscribed Members':
        return safeSubscribers.length;
      case 'Unpaid / Expired Users':
        return safeUsers.filter(u => u?.plan === 'Free' || u?.membershipStatus === 'Expired').length;
      case 'Government Job Seekers':
        return Math.round(safeUsers.length * 0.65);
      case 'Overseas / Gulf Candidates':
        return Math.round(safeUsers.length * 0.35);
      default:
        return safeUsers.length;
    }
  };

  const audienceCount = calculateAudienceCount();

  const handleApplyTemplate = (tpl: { subject: string; body: string; channel: any; audience: any }) => {
    setSubject(tpl.subject);
    setMessageBody(tpl.body);
    setChannel(tpl.channel);
    setTargetAudience(tpl.audience);
    setTitle(`Broadcast: ${tpl.subject}`);
    setActiveTab('compose');
  };

  const handleDispatchCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !messageBody.trim()) {
      alert('Please provide both campaign title and message content.');
      return;
    }

    setIsSending(true);
    setTimeout(() => {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const newCamp: BroadcastCampaign = {
        id: `camp-${Date.now().toString(36)}`,
        title: title.trim(),
        channel,
        targetAudience,
        subject: subject.trim() || title.trim(),
        messageBody: messageBody.trim(),
        sentAt: nowStr,
        status: 'Sent',
        recipientsCount: audienceCount,
        openRate: channel === 'WhatsApp' ? 92.4 : 45.8,
        clickRate: channel === 'WhatsApp' ? 64.2 : 22.1
      };

      onSendCampaign(newCamp);
      setCampaignList([newCamp, ...campaignList]);
      setIsSending(false);
      alert(`🚀 Broadcast Campaign "${newCamp.title}" dispatched to ${newCamp.recipientsCount} recipients via ${newCamp.channel}!`);
      setTitle('');
      setSubject('');
      setMessageBody('');
      setActiveTab('history');
    }, 1200);
  };

  const handleSaveProviders = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCommConfig(providerSettings);
    setProviderSaveSuccess(true);
    setTimeout(() => setProviderSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 text-white">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Megaphone className="w-4 h-4" />
            <span>Multi-Channel Communication & Broadcast Center</span>
          </div>
          <h2 className="text-xl font-black text-white">Targeted Email, WhatsApp & Push Campaigns</h2>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch weekly job digests, urgent FPSC/WAPDA gazette alerts, employer discount notifications, and system advisories.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
          {[
            { id: 'compose', label: 'Compose Broadcast', icon: Send },
            { id: 'history', label: `Sent Campaigns (${campaignList.length})`, icon: Clock },
            { id: 'templates', label: 'Campaign Templates', icon: FileText },
            { id: 'providers', label: 'SMTP & WhatsApp Gateways', icon: Layers }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: COMPOSE CAMPAIGN */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Compose Form */}
          <form onSubmit={handleDispatchCampaign} className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Send className="w-4 h-4 text-amber-400" />
                <span>Draft New Broadcast Campaign</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                🎯 Target Reach: ~{audienceCount} Recipients
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Internal Campaign Name</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. FPSC Gazette 08/2026 Urgent WhatsApp Alert"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Delivery Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="Email">📧 Email Campaign (SMTP / SendGrid)</option>
                    <option value="WhatsApp">💬 Official WhatsApp Alerts (Meta Cloud API)</option>
                    <option value="SMS">📱 Direct SMS Blast (Twilio)</option>
                    <option value="Push Notification">🔔 Browser Web Push Notification</option>
                    <option value="Multi-Channel">⚡ Multi-Channel (Email + WhatsApp Blast)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Audience Segmentation</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="All Users">All Registered Users ({users.length})</option>
                    <option value="Job Seekers Only">Job Seekers Only</option>
                    <option value="Employers / Posters">Employers & Job Posters</option>
                    <option value="Subscribed Members">Active WhatsApp Pro Subscribers ({subscribers.length})</option>
                    <option value="Unpaid / Expired Users">Unpaid / Expired Members</option>
                    <option value="Government Job Seekers">Govt Sector & BPS Candidates</option>
                    <option value="Overseas / Gulf Candidates">Overseas & Gulf Candidates</option>
                  </select>
                </div>
              </div>

              {channel.includes('Email') && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Email Subject Line</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="🔥 Top New Jobs in Islamabad, Lahore & Dubai this week"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-300">Message Content (Supports Markdown & Dynamic Tags)</label>
                  <span className="text-[10px] text-slate-500 font-mono">Tags: {'{{candidate_name}}'}, {'{{job_count}}'}</span>
                </div>
                <textarea
                  rows={7}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type your message here. For WhatsApp, use *bold* and _italic_ formatting..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer text-xs"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>{previewMode ? 'Hide Preview' : 'Show Live Preview'}</span>
              </button>

              <button
                type="submit"
                disabled={isSending}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-2 cursor-pointer transition-all active:scale-95 text-xs disabled:opacity-50"
              >
                <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
                <span>{isSending ? 'Dispatching Broadcast...' : 'Launch Broadcast Now'}</span>
              </button>
            </div>
          </form>

          {/* Right Column: Dynamic Preview Device */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-300">📱 Recipient Device Preview</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold">
                  {channel}
                </span>
              </div>

              {/* Mock Screen Display */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-center space-x-2 border-b border-slate-900 pb-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    CP
                  </div>
                  <div>
                    <div className="font-bold text-white text-[11px]">CareerPak Alerts</div>
                    <div className="text-[9px] text-slate-500 font-mono">{channel === 'WhatsApp' ? '+92 300 CAREERPAK' : 'alerts@careerpak.com'}</div>
                  </div>
                </div>

                {subject && (
                  <div className="font-bold text-amber-400 text-[11px] border-b border-slate-900/80 pb-1">
                    Subject: {subject}
                  </div>
                )}

                <div className="text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                  {messageBody ? messageBody.replace('{{candidate_name}}', 'Ahmad Khan') : (
                    <span className="text-slate-600 italic">Message preview will appear here as you type...</span>
                  )}
                </div>

                <div className="text-[9px] text-slate-600 text-right font-mono">
                  Delivered • Today {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300">
                ⚡ <strong>Instant Delivery:</strong> High-priority routing via Meta WhatsApp Business & SendGrid Dedicated IP pool.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: SENT CAMPAIGNS HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Broadcast Campaign Log & Telemetry</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{campaignList.length} Total Campaigns</span>
          </div>

          <div className="divide-y divide-slate-800 text-xs">
            {campaignList.map((camp) => (
              <div key={camp.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{camp.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {camp.channel}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {camp.status}
                    </span>
                  </div>
                  <div className="text-slate-400 text-xs font-mono">
                    Sent at: {camp.sentAt} • Audience: <span className="text-amber-400">{camp.targetAudience}</span> ({camp.recipientsCount} Delivered)
                  </div>
                  <div className="text-slate-500 text-[11px] line-clamp-1">
                    "{camp.messageBody}"
                  </div>
                </div>

                <div className="flex items-center space-x-4 font-mono text-right">
                  {camp.openRate && (
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Open Rate</span>
                      <span className="font-bold text-emerald-400">{camp.openRate}%</span>
                    </div>
                  )}
                  {camp.clickRate && (
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Click CTR</span>
                      <span className="font-bold text-amber-400">{camp.clickRate}%</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PRE-BUILT TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          
          {/* Template 1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Weekly Digest
              </span>
              <h4 className="font-bold text-sm text-white">Top 50 Government & Corporate Openings</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Highlights the week's highest-paying tech vacancies and gazetted BPS-16/17/18 government openings.
              </p>
            </div>
            <button
              onClick={() => handleApplyTemplate({
                subject: '🎯 Top 50 New Jobs This Week: FPSC, WAPDA, Tech & Gulf Vacancies',
                body: 'Hello {{candidate_name}},\n\nOver 250+ new jobs were posted this week across Pakistan and Overseas. Check out the top featured openings matched to your profile:\n\n1. FPSC Assistant Director (BPS-17) - Ministry of Energy\n2. Senior Full Stack Engineer (Remote - $4,500/mo)\n3. WAPDA Junior Civil Engineers (50+ Vacancies)\n\nApply directly on CareerPak!',
                channel: 'Email',
                audience: 'Job Seekers Only'
              })}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer text-center"
            >
              Use This Template →
            </button>
          </div>

          {/* Template 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                WhatsApp Urgent Alert
              </span>
              <h4 className="font-bold text-sm text-white">FPSC & WAPDA Gazette Closing Deadline</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Sends a high-engagement WhatsApp push with bank challan fee details and submission deadlines.
              </p>
            </div>
            <button
              onClick={() => handleApplyTemplate({
                subject: 'FPSC Deadline Reminder',
                body: '🚨 *URGENT FPSC RECRUITMENT ALERT*:\nDeadline for FPSC Consolidated Gazette Advt No. 08/2026 is approaching. Challan fee Rs. 300 payable at NBP. Ensure your online application is submitted before 28th August.',
                channel: 'WhatsApp',
                audience: 'Subscribed Members'
              })}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl cursor-pointer text-center"
            >
              Use This Template →
            </button>
          </div>

          {/* Template 3 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Employer Promotion
              </span>
              <h4 className="font-bold text-sm text-white">Employer 30% Off Featured Post Promo</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Incentivizes HR talent acquisition teams and recruiters to purchase featured listings.
              </p>
            </div>
            <button
              onClick={() => handleApplyTemplate({
                subject: '💼 Boost Your Hiring: 30% Off Featured Job Slots & Verified Company Badge',
                body: 'Dear Hiring Manager,\n\nAttract top talent 5x faster. Upgrade to our Featured Listing or Unlimited Monthly Employer Plan with promo code **HIREPRO30** valid through this weekend.',
                channel: 'Email',
                audience: 'Employers / Posters'
              })}
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl cursor-pointer text-center"
            >
              Use This Template →
            </button>
          </div>

        </div>
      )}

      {/* TAB 4: PROVIDER CREDENTIALS */}
      {activeTab === 'providers' && (
        <form onSubmit={handleSaveProviders} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>SMTP, Meta WhatsApp Cloud & Twilio API Gateways</span>
              </h3>
              <p className="text-xs text-slate-400">Configure connection strings and API keys for broadcast dispatch.</p>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer"
            >
              Save Gateway Config
            </button>
          </div>

          {providerSaveSuccess && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs">
              ✅ Gateway settings updated and validated!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">SMTP Host (SendGrid / Postmark / Resend)</label>
              <input
                type="text"
                value={providerSettings.smtpHost}
                onChange={(e) => setProviderSettings({ ...providerSettings, smtpHost: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">SMTP Sender Address</label>
              <input
                type="email"
                value={providerSettings.smtpSenderEmail}
                onChange={(e) => setProviderSettings({ ...providerSettings, smtpSenderEmail: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Meta WhatsApp Cloud API Token</label>
              <input
                type="password"
                value={providerSettings.whatsappCloudApiToken || ''}
                onChange={(e) => setProviderSettings({ ...providerSettings, whatsappCloudApiToken: e.target.value })}
                placeholder="EAAQ..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">WhatsApp Phone Number ID</label>
              <input
                type="text"
                value={providerSettings.whatsappPhoneNumberId || ''}
                onChange={(e) => setProviderSettings({ ...providerSettings, whatsappPhoneNumberId: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>
          </div>
        </form>
      )}

    </div>
  );
};
