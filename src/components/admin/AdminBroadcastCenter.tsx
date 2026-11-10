import React, { useState, useEffect } from 'react';
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
  Filter,
  Info,
  AlertCircle,
  ShieldCheck,
  Lock,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Subscriber, UserAccount, AdminFeatureFlags } from '../../types/job';
import {
  BroadcastCampaign,
  CommunicationProviderConfig,
  SafeCommunicationProviderConfig,
  UpdateCommunicationProviderPayload,
  EmailProviderType,
  WhatsAppProviderType
} from '../../types/adminSuite';
import { api } from '../../services/api';

interface AdminBroadcastCenterProps {
  campaigns?: BroadcastCampaign[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  commConfig?: CommunicationProviderConfig;
  featureFlags?: AdminFeatureFlags;
  isLoading?: boolean;
  loadError?: string | null;
  migrationError?: string | null;
  onSendCampaign?: (newCampaign: Partial<BroadcastCampaign>) => Promise<{ success: boolean; campaign?: BroadcastCampaign; error?: string } | boolean | void> | void;
  onUpdateCommConfig?: (updated: CommunicationProviderConfig) => void;
  onRefreshCampaigns?: () => void;
}

export const AdminBroadcastCenter: React.FC<AdminBroadcastCenterProps> = ({
  campaigns = [],
  users = [],
  subscribers = [],
  commConfig,
  featureFlags,
  isLoading = false,
  loadError = null,
  migrationError = null,
  onSendCampaign,
  onUpdateCommConfig,
  onRefreshCampaigns
}) => {
  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];

  const [campaignList, setCampaignList] = useState<BroadcastCampaign[]>(safeCampaigns);
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'templates' | 'providers'>('compose');

  // Channel Gating Statuses
  const emailEnabled = featureFlags?.enableEmailAlerts !== false;
  const whatsappEnabled = featureFlags?.enableWhatsAppAlerts !== false;
  const multiChannelEnabled = emailEnabled && whatsappEnabled;

  const [channel, setChannel] = useState<'Email' | 'WhatsApp' | 'SMS' | 'Push Notification' | 'Multi-Channel'>('SMS');

  // Synchronize channel selection when feature flags change
  useEffect(() => {
    if (channel === 'Email' && !emailEnabled) {
      if (whatsappEnabled) setChannel('WhatsApp');
      else setChannel('SMS');
    } else if (channel === 'WhatsApp' && !whatsappEnabled) {
      if (emailEnabled) setChannel('Email');
      else setChannel('SMS');
    } else if (channel === 'Multi-Channel' && !multiChannelEnabled) {
      if (emailEnabled) setChannel('Email');
      else if (whatsappEnabled) setChannel('WhatsApp');
      else setChannel('SMS');
    }
  }, [emailEnabled, whatsappEnabled, multiChannelEnabled, channel]);

  // Synchronize campaign list whenever prop updates
  useEffect(() => {
    setCampaignList(Array.isArray(campaigns) ? campaigns : []);
  }, [campaigns]);

  // Composer state
  const [title, setTitle] = useState('');
  const [targetAudience, setTargetAudience] = useState<
    'All Users' | 'Job Seekers Only' | 'Employers / Posters' | 'Subscribed Members' | 'Unpaid / Expired Users' | 'Government Job Seekers' | 'Overseas / Gulf Candidates'
  >('Job Seekers Only');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Provider Settings state loaded from backend API
  const [safeProviderConfig, setSafeProviderConfig] = useState<SafeCommunicationProviderConfig>({
    emailProvider: 'smtp',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpSenderEmail: '',
    whatsappProvider: 'meta-cloud',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    twilioAccountSid: '',
    twilioPhoneNumber: '',
    smtpPasswordConfigured: false,
    sendgridApiKeyConfigured: false,
    resendApiKeyConfigured: false,
    whatsappCloudApiTokenConfigured: false,
    twilioAuthTokenConfigured: false
  });

  // Non-secret Form State
  const [emailProvider, setEmailProvider] = useState<EmailProviderType>('smtp');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpSenderEmail, setSmtpSenderEmail] = useState('');
  const [whatsappProvider, setWhatsappProvider] = useState<WhatsAppProviderType>('meta-cloud');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');

  // Secret Form Inputs (ALWAYS initially blank!)
  const [smtpPasswordInput, setSmtpPasswordInput] = useState('');
  const [sendgridApiKeyInput, setSendgridApiKeyInput] = useState('');
  const [resendApiKeyInput, setResendApiKeyInput] = useState('');
  const [whatsappCloudApiTokenInput, setWhatsappCloudApiTokenInput] = useState('');
  const [twilioAuthTokenInput, setTwilioAuthTokenInput] = useState('');

  // Clear secret flags
  const [clearSecrets, setClearSecrets] = useState<Array<'smtpPassword' | 'sendgridApiKey' | 'resendApiKey' | 'whatsappCloudApiToken' | 'twilioAuthToken'>>([]);
  const [isProviderSaving, setIsProviderSaving] = useState(false);
  const [providerSaveSuccess, setProviderSaveSuccess] = useState(false);
  const [providerSaveError, setProviderSaveError] = useState<string | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  // Load authoritative provider config from server
  const loadProviderConfig = async () => {
    setIsLoadingProviders(true);
    setProviderSaveError(null);
    try {
      const res = await api.communicationProviders.get();
      if (res && res.success && res.config) {
        setSafeProviderConfig(res.config);
        setEmailProvider(res.config.emailProvider || 'smtp');
        setSmtpHost(res.config.smtpHost || '');
        setSmtpPort(res.config.smtpPort || 587);
        setSmtpUser(res.config.smtpUser || '');
        setSmtpSenderEmail(res.config.smtpSenderEmail || '');
        setWhatsappProvider(res.config.whatsappProvider || 'meta-cloud');
        setWhatsappPhoneNumberId(res.config.whatsappPhoneNumberId || '');
        setWhatsappBusinessAccountId(res.config.whatsappBusinessAccountId || '');
        setTwilioAccountSid(res.config.twilioAccountSid || '');
        setTwilioPhoneNumber(res.config.twilioPhoneNumber || '');
      }
    } catch (err: any) {
      console.error('[AdminBroadcastCenter] Failed to load provider settings:', err);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  useEffect(() => {
    loadProviderConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'providers') {
      loadProviderConfig();
    }
  }, [activeTab]);

  // Calculate exact audience count from actual available records
  const calculateAudienceCount = () => {
    switch (targetAudience) {
      case 'All Users': {
        const seenEmails = new Set<string>();
        const seenIds = new Set<string>();
        let count = 0;

        for (const u of safeUsers) {
          const email = (u?.email || '').trim().toLowerCase();
          const id = u?.id ? String(u.id).trim() : '';
          if (email) seenEmails.add(email);
          if (id) seenIds.add(id);
          count++;
        }

        for (const s of safeSubscribers) {
          const email = (s?.email || '').trim().toLowerCase();
          const id = s?.id ? String(s.id).trim() : '';
          const alreadySeen = (email && seenEmails.has(email)) || (id && seenIds.has(id));
          if (!alreadySeen) {
            if (email) seenEmails.add(email);
            if (id) seenIds.add(id);
            count++;
          }
        }
        return count;
      }
      case 'Job Seekers Only':
        return safeUsers.filter(u => !u?.role?.toLowerCase()?.includes('employer') && !u?.companyName).length;
      case 'Employers / Posters':
        return safeUsers.filter(u => u?.role?.toLowerCase()?.includes('employer') || u?.companyName).length;
      case 'Subscribed Members':
        return safeSubscribers.length;
      case 'Unpaid / Expired Users':
        return safeUsers.filter(u => u?.plan === 'Free' || u?.membershipStatus === 'Expired').length;
      case 'Government Job Seekers':
        return safeUsers.filter(u => Array.isArray(u.skills) && u.skills.some(s => s.toLowerCase().includes('govt') || s.toLowerCase().includes('bps'))).length;
      case 'Overseas / Gulf Candidates':
        return safeUsers.filter(u => u?.address && /gulf|dubai|uk|saudi|uae/i.test(u.address)).length;
      default:
        return safeUsers.length;
    }
  };

  const audienceCount = calculateAudienceCount();

  const handleApplyTemplate = (tpl: { subject: string; body: string; channel: any; audience: any }) => {
    if (tpl.channel === 'Email' && !emailEnabled) {
      setFormError('Email templates cannot be selected because Email alerts are globally disabled.');
      return;
    }
    if (tpl.channel === 'WhatsApp' && !whatsappEnabled) {
      setFormError('WhatsApp templates cannot be selected because WhatsApp alerts are globally disabled.');
      return;
    }

    setSubject(tpl.subject);
    setMessageBody(tpl.body);
    setChannel(tpl.channel);
    setTargetAudience(tpl.audience);
    setTitle(`Broadcast: ${tpl.subject}`);
    setFormError(null);
    setFormSuccess(null);
    setActiveTab('compose');
  };

  const handleDispatchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (channel === 'Email' && !emailEnabled) {
      setFormError('Cannot save Email draft: Email channel is globally disabled by administrator.');
      return;
    }
    if (channel === 'WhatsApp' && !whatsappEnabled) {
      setFormError('Cannot save WhatsApp draft: WhatsApp channel is globally disabled by administrator.');
      return;
    }
    if (channel === 'Multi-Channel' && !multiChannelEnabled) {
      setFormError('Cannot save Multi-Channel draft: Requires both Email and WhatsApp channels to be enabled.');
      return;
    }

    if (!title.trim() || !messageBody.trim()) {
      setFormError('Please provide both campaign title and message content.');
      return;
    }

    setIsSending(true);

    const payload: Partial<BroadcastCampaign> = {
      title: title.trim(),
      channel,
      targetAudience,
      subject: subject.trim() || title.trim(),
      messageBody: messageBody.trim(),
      recipientsCount: audienceCount,
      categoryFilter: 'All Categories'
    };

    try {
      if (onSendCampaign) {
        const res = await onSendCampaign(payload);
        if (res && typeof res === 'object' && 'success' in res) {
          if (res.success && res.campaign) {
            setCampaignList(prev => [res.campaign!, ...prev.filter(c => c.id !== res.campaign!.id)]);
            setFormSuccess(`Broadcast Campaign "${res.campaign.title}" has been saved as Draft.`);
            setTitle('');
            setSubject('');
            setMessageBody('');
            setActiveTab('history');
          } else {
            setFormError(res.error || 'Failed to persist broadcast draft to backend.');
          }
        } else {
          setTitle('');
          setSubject('');
          setMessageBody('');
          setActiveTab('history');
        }
      } else {
        const res = await api.broadcasts.create(payload as any);
        if (res && res.success && res.campaign) {
          setCampaignList(prev => [res.campaign!, ...prev.filter(c => c.id !== res.campaign!.id)]);
          setFormSuccess(`Broadcast Campaign "${res.campaign.title}" has been saved as Draft.`);
          setTitle('');
          setSubject('');
          setMessageBody('');
          setActiveTab('history');
        } else {
          setFormError(res?.message || 'Failed to save broadcast draft to database.');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected network error while saving broadcast draft.');
    } finally {
      setIsSending(false);
    }
  };

  type SecretKeyName = 'smtpPassword' | 'sendgridApiKey' | 'resendApiKey' | 'whatsappCloudApiToken' | 'twilioAuthToken';

  const handleToggleClearSecret = (secretName: SecretKeyName) => {
    setClearSecrets(prev =>
      prev.includes(secretName) ? prev.filter(s => s !== secretName) : [...prev, secretName]
    );
  };

  const handleSaveProviders = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProviderSaving(true);
    setProviderSaveError(null);
    setProviderSaveSuccess(false);

    const payload: UpdateCommunicationProviderPayload = {
      emailProvider,
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort) || 587,
      smtpUser: smtpUser.trim(),
      smtpSenderEmail: smtpSenderEmail.trim(),
      whatsappProvider,
      whatsappPhoneNumberId: whatsappPhoneNumberId.trim(),
      whatsappBusinessAccountId: whatsappBusinessAccountId.trim(),
      twilioAccountSid: twilioAccountSid.trim(),
      twilioPhoneNumber: twilioPhoneNumber.trim(),

      // Secrets (only include non-empty values)
      smtpPassword: smtpPasswordInput.trim() || undefined,
      sendgridApiKey: sendgridApiKeyInput.trim() || undefined,
      resendApiKey: resendApiKeyInput.trim() || undefined,
      whatsappCloudApiToken: whatsappCloudApiTokenInput.trim() || undefined,
      twilioAuthToken: twilioAuthTokenInput.trim() || undefined,

      clearSecrets: clearSecrets.length > 0 ? clearSecrets : undefined
    };

    try {
      const res = await api.communicationProviders.update(payload);
      if (res && res.success && res.config) {
        setSafeProviderConfig(res.config);
        // Clear secret input states
        setSmtpPasswordInput('');
        setSendgridApiKeyInput('');
        setResendApiKeyInput('');
        setWhatsappCloudApiTokenInput('');
        setTwilioAuthTokenInput('');
        setClearSecrets([]);

        setProviderSaveSuccess(true);
        setTimeout(() => setProviderSaveSuccess(false), 5000);

        if (onUpdateCommConfig) {
          onUpdateCommConfig({
            smtpHost: res.config.smtpHost,
            smtpPort: res.config.smtpPort,
            smtpUser: res.config.smtpUser,
            smtpSenderEmail: res.config.smtpSenderEmail,
            whatsappPhoneNumberId: res.config.whatsappPhoneNumberId,
            twilioAccountSid: res.config.twilioAccountSid,
            twilioPhoneNumber: res.config.twilioPhoneNumber
          });
        }
      } else {
        setProviderSaveError(res?.message || 'Failed to persist provider configuration to database.');
      }
    } catch (err: any) {
      console.error('[AdminBroadcastCenter] Provider save error:', err);
      setProviderSaveError(err?.message || 'Network error updating provider configuration.');
    } finally {
      setIsProviderSaving(false);
    }
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
            Draft and manage templates for weekly job digests, urgent FPSC/WAPDA gazette alerts, employer discount notifications, and system announcements.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
          {[
            { id: 'compose', label: 'Compose Broadcast', icon: Send },
            { id: 'history', label: `Campaign History (${campaignList.length})`, icon: Clock },
            { id: 'templates', label: 'Campaign Templates', icon: FileText },
            { id: 'providers', label: 'Provider Gateways', icon: Layers }
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

      {/* Global Channel Master-Switch Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className={`p-3 rounded-xl border flex items-center justify-between ${
          emailEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 shrink-0" />
            <span>Email Alerts Master Switch: <strong>{emailEnabled ? 'ON (Enabled)' : 'OFF (Disabled)'}</strong></span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${emailEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {emailEnabled ? 'ACTIVE' : 'DISABLED'}
          </span>
        </div>

        <div className={`p-3 rounded-xl border flex items-center justify-between ${
          whatsappEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>WhatsApp Alerts Master Switch: <strong>{whatsappEnabled ? 'ON (Enabled)' : 'OFF (Disabled)'}</strong></span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${whatsappEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {whatsappEnabled ? 'ACTIVE' : 'DISABLED'}
          </span>
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
              <span className="text-[11px] font-mono text-emerald-400 font-bold" title="Estimated Audience Reach">
                🎯 Target Reach: ~{audienceCount} (Estimated Audience Reach)
              </span>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

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
                  <label className="block font-bold text-slate-300 mb-1">Communication Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="Email" disabled={!emailEnabled}>📧 Email Campaign {!emailEnabled ? '(Disabled)' : ''}</option>
                    <option value="WhatsApp" disabled={!whatsappEnabled}>💬 Official WhatsApp Alerts {!whatsappEnabled ? '(Disabled)' : ''}</option>
                    <option value="SMS">📱 Direct SMS Blast</option>
                    <option value="Push Notification">🔔 Browser Web Push Notification</option>
                    <option value="Multi-Channel" disabled={!multiChannelEnabled}>⚡ Multi-Channel {!multiChannelEnabled ? '(Disabled - Requires Email & WhatsApp)' : ''}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Audience Segmentation</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="All Users">All Users (~{audienceCount} estimated reach)</option>
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
                disabled={isSending || (channel === 'Email' && !emailEnabled) || (channel === 'WhatsApp' && !whatsappEnabled) || (channel === 'Multi-Channel' && !multiChannelEnabled)}
                className={`px-6 py-3 font-black rounded-xl shadow-lg flex items-center space-x-2 cursor-pointer transition-all active:scale-95 text-xs ${
                  isSending || (channel === 'Email' && !emailEnabled) || (channel === 'WhatsApp' && !whatsappEnabled) || (channel === 'Multi-Channel' && !multiChannelEnabled)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
                <span>
                  {isSending ? 'Processing...' : 'Save Broadcast Draft'}
                </span>
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

                <div className="text-[9px] text-slate-500 text-right font-mono">
                  Preview Only
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400">
                ℹ️ <strong>Campaign Preview:</strong> Visual representation of message formatting for selected communication channels.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: CAMPAIGN HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Campaign History & Saved Drafts</span>
            </h3>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono text-slate-400">{campaignList.length} Total Campaigns</span>
              {onRefreshCampaigns && (
                <button
                  type="button"
                  onClick={onRefreshCampaigns}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                  title="Refresh campaigns from database"
                >
                  Refresh
                </button>
              )}
            </div>
          </div>

          {loadError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{loadError}</span>
              </div>
              {onRefreshCampaigns && (
                <button
                  type="button"
                  onClick={onRefreshCampaigns}
                  className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded font-bold cursor-pointer ml-3"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {migrationError && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>⚠️ Legacy Campaign Import: {migrationError}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Clock className="w-6 h-6 animate-spin mx-auto text-amber-400" />
              <p className="text-xs">Loading broadcast campaigns from database...</p>
            </div>
          ) : campaignList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Megaphone className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
              <p className="font-bold text-slate-400 text-sm">No broadcast campaigns saved yet</p>
              <p className="text-xs text-slate-500">Draft your first multi-channel broadcast campaign in the Compose tab above.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {campaignList.map((camp) => (
              <div key={camp.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{camp.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {camp.channel}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      camp.status === 'Draft'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : camp.status === 'Sent'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-700/30 text-slate-300 border-slate-600/30'
                    }`}>
                      {camp.status}
                    </span>
                  </div>
                  <div className="text-slate-400 text-xs font-mono">
                    {camp.status === 'Draft' ? (
                      <>Status: <span className="text-amber-400">Draft</span> • Audience: <span className="text-amber-400">{camp.targetAudience}</span> (~{camp.recipientsCount} Estimated Reach)</>
                    ) : (
                      <>{camp.sentAt ? `Sent at: ${camp.sentAt} • ` : ''}Audience: <span className="text-amber-400">{camp.targetAudience}</span> (~{camp.recipientsCount} Estimated Reach)</>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px] line-clamp-1">
                    "{camp.messageBody}"
                  </div>
                </div>

                <div className="flex items-center space-x-4 font-mono text-right">
                  {camp.status !== 'Draft' && camp.openRate !== undefined && camp.openRate > 0 && (
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Open Rate</span>
                      <span className="font-bold text-emerald-400">{camp.openRate}%</span>
                    </div>
                  )}
                  {camp.status !== 'Draft' && camp.clickRate !== undefined && camp.clickRate > 0 && (
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Click CTR</span>
                      <span className="font-bold text-amber-400">{camp.clickRate}%</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
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
              disabled={!emailEnabled}
              className={`w-full py-2.5 font-bold rounded-xl cursor-pointer text-center ${
                emailEnabled ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {emailEnabled ? 'Use This Template →' : 'Template Disabled (Email OFF)'}
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
                Template preview only. Selecting this fills the draft composer with bank challan fee details and submission deadlines.
              </p>
            </div>
            <button
              onClick={() => handleApplyTemplate({
                subject: 'FPSC Deadline Reminder',
                body: '🚨 *URGENT FPSC RECRUITMENT ALERT*:\nDeadline for FPSC Consolidated Gazette Advt No. 08/2026 is approaching. Challan fee Rs. 300 payable at NBP. Ensure your online application is submitted before 28th August.',
                channel: 'WhatsApp',
                audience: 'Subscribed Members'
              })}
              disabled={!whatsappEnabled}
              className={`w-full py-2.5 font-bold rounded-xl cursor-pointer text-center ${
                whatsappEnabled ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {whatsappEnabled ? 'Use This Template →' : 'Template Disabled (WhatsApp OFF)'}
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
              disabled={!emailEnabled}
              className={`w-full py-2.5 font-bold rounded-xl cursor-pointer text-center ${
                emailEnabled ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {emailEnabled ? 'Use This Template →' : 'Template Disabled (Email OFF)'}
            </button>
          </div>

        </div>
      )}

      {/* TAB 4: SECURE PROVIDER GATEWAYS & AES-256 CREDENTIALS */}
      {activeTab === 'providers' && (
        <form onSubmit={handleSaveProviders} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
            <div>
              <h3 className="text-base font-black flex items-center space-x-2 text-white">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>MongoDB Encrypted Provider Configuration (AES-256-GCM)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage authoritative Email & WhatsApp gateways. All API keys and secrets are encrypted server-side with AES-256-GCM.
              </p>
            </div>
            <button
              type="submit"
              disabled={isProviderSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer flex items-center space-x-2 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isProviderSaving ? 'Encrypting & Saving...' : 'Save Provider Settings'}</span>
            </button>
          </div>

          {isLoadingProviders ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400" />
              <p className="text-xs">Loading provider configuration from MongoDB...</p>
            </div>
          ) : (
            <>
              {providerSaveError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{providerSaveError}</span>
                </div>
              )}

              {providerSaveSuccess && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 font-bold text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Provider settings stored securely in MongoDB (Encrypted with AES-256-GCM).</span>
                </div>
              )}

              {/* EMAIL PROVIDER SECTION */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="font-bold text-slate-200 uppercase text-[11px] tracking-wider flex items-center space-x-1.5">
                    <Mail className="w-4 h-4 text-amber-400" />
                    <span>Email Gateway Configuration</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Provider: {emailProvider.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Email Provider Adapter</label>
                    <select
                      value={emailProvider}
                      onChange={(e) => setEmailProvider(e.target.value as EmailProviderType)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                    >
                      <option value="smtp">Custom SMTP Server</option>
                      <option value="sendgrid">SendGrid Web API</option>
                      <option value="resend">Resend API</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">SMTP Sender Email Address</label>
                    <input
                      type="email"
                      value={smtpSenderEmail}
                      onChange={(e) => setSmtpSenderEmail(e.target.value)}
                      placeholder="alerts@hybridjobs.pk"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.sendgrid.net"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">SMTP Port (1–65535)</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="587"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">SMTP Username</label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="apikey"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  {/* Secret Field: SMTP Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-300">SMTP Password</label>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        safeProviderConfig.smtpPasswordConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {safeProviderConfig.smtpPasswordConfigured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={smtpPasswordInput}
                      onChange={(e) => setSmtpPasswordInput(e.target.value)}
                      placeholder={safeProviderConfig.smtpPasswordConfigured ? '(Encrypted - Leave blank to keep existing)' : 'Enter new SMTP password'}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                    {safeProviderConfig.smtpPasswordConfigured && (
                      <label className="mt-1 flex items-center space-x-1.5 text-[11px] text-rose-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearSecrets.includes('smtpPassword')}
                          onChange={() => handleToggleClearSecret('smtpPassword')}
                          className="rounded border-slate-800"
                        />
                        <span>Clear saved password on save</span>
                      </label>
                    )}
                  </div>

                  {/* Secret Field: SendGrid API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-300">SendGrid API Key</label>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        safeProviderConfig.sendgridApiKeyConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {safeProviderConfig.sendgridApiKeyConfigured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={sendgridApiKeyInput}
                      onChange={(e) => setSendgridApiKeyInput(e.target.value)}
                      placeholder={safeProviderConfig.sendgridApiKeyConfigured ? '(Encrypted - Leave blank to keep existing)' : 'SG....'}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                    {safeProviderConfig.sendgridApiKeyConfigured && (
                      <label className="mt-1 flex items-center space-x-1.5 text-[11px] text-rose-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearSecrets.includes('sendgridApiKey')}
                          onChange={() => handleToggleClearSecret('sendgridApiKey')}
                          className="rounded border-slate-800"
                        />
                        <span>Clear saved API key on save</span>
                      </label>
                    )}
                  </div>

                  {/* Secret Field: Resend API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-300">Resend API Key</label>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        safeProviderConfig.resendApiKeyConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {safeProviderConfig.resendApiKeyConfigured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={resendApiKeyInput}
                      onChange={(e) => setResendApiKeyInput(e.target.value)}
                      placeholder={safeProviderConfig.resendApiKeyConfigured ? '(Encrypted - Leave blank to keep existing)' : 're_...'}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                    {safeProviderConfig.resendApiKeyConfigured && (
                      <label className="mt-1 flex items-center space-x-1.5 text-[11px] text-rose-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearSecrets.includes('resendApiKey')}
                          onChange={() => handleToggleClearSecret('resendApiKey')}
                          className="rounded border-slate-800"
                        />
                        <span>Clear saved API key on save</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* WHATSAPP PROVIDER SECTION */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="font-bold text-slate-200 uppercase text-[11px] tracking-wider flex items-center space-x-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp Gateway Configuration</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Provider: {whatsappProvider.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">WhatsApp Provider Adapter</label>
                    <select
                      value={whatsappProvider}
                      onChange={(e) => setWhatsappProvider(e.target.value as WhatsAppProviderType)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                    >
                      <option value="meta-cloud">Meta WhatsApp Cloud API (Graph API)</option>
                      <option value="twilio">Twilio Programmable Messaging</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">WhatsApp Phone Number ID</label>
                    <input
                      type="text"
                      value={whatsappPhoneNumberId}
                      onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                      placeholder="e.g. 10928374619"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">WhatsApp Business Account ID (WABA)</label>
                    <input
                      type="text"
                      value={whatsappBusinessAccountId}
                      onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
                      placeholder="e.g. 99283746102"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  {/* Secret Field: WhatsApp Cloud API Access Token */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-300">Meta Cloud API Access Token</label>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        safeProviderConfig.whatsappCloudApiTokenConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {safeProviderConfig.whatsappCloudApiTokenConfigured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={whatsappCloudApiTokenInput}
                      onChange={(e) => setWhatsappCloudApiTokenInput(e.target.value)}
                      placeholder={safeProviderConfig.whatsappCloudApiTokenConfigured ? '(Encrypted - Leave blank to keep existing)' : 'EAAQ...'}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                    {safeProviderConfig.whatsappCloudApiTokenConfigured && (
                      <label className="mt-1 flex items-center space-x-1.5 text-[11px] text-rose-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearSecrets.includes('whatsappCloudApiToken')}
                          onChange={() => handleToggleClearSecret('whatsappCloudApiToken')}
                          className="rounded border-slate-800"
                        />
                        <span>Clear saved Cloud API token on save</span>
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Twilio Account SID</label>
                    <input
                      type="text"
                      value={twilioAccountSid}
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                      placeholder="AC..."
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  {/* Secret Field: Twilio Auth Token */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-300">Twilio Auth Token</label>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        safeProviderConfig.twilioAuthTokenConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {safeProviderConfig.twilioAuthTokenConfigured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={twilioAuthTokenInput}
                      onChange={(e) => setTwilioAuthTokenInput(e.target.value)}
                      placeholder={safeProviderConfig.twilioAuthTokenConfigured ? '(Encrypted - Leave blank to keep existing)' : 'Twilio auth token'}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                    {safeProviderConfig.twilioAuthTokenConfigured && (
                      <label className="mt-1 flex items-center space-x-1.5 text-[11px] text-rose-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearSecrets.includes('twilioAuthToken')}
                          onChange={() => handleToggleClearSecret('twilioAuthToken')}
                          className="rounded border-slate-800"
                        />
                        <span>Clear saved Twilio token on save</span>
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Twilio Sender Phone Number</label>
                    <input
                      type="text"
                      value={twilioPhoneNumber}
                      onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                      placeholder="+18005559821"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isProviderSaving}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer flex items-center space-x-2 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isProviderSaving ? 'Encrypting & Saving...' : 'Save Provider Settings'}</span>
            </button>
          </div>
        </form>
      )}

    </div>
  );
};
