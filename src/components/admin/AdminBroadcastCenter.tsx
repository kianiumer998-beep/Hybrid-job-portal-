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
import { Subscriber, UserAccount, AdminFeatureFlags, Job } from '../../types/job';
import { Advertisement } from '../../types/ad';
import {
  BroadcastCampaign,
  CommunicationProviderConfig,
  SafeCommunicationProviderConfig,
  UpdateCommunicationProviderPayload,
  EmailProviderType,
  WhatsAppProviderType
} from '../../types/adminSuite';
import { api } from '../../services/api';
import { AdminBulkNotificationTool } from './AdminBulkNotificationTool';

interface AdminBroadcastCenterProps {
  campaigns?: BroadcastCampaign[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  jobs?: Job[];
  ads?: Advertisement[];
  commConfig?: CommunicationProviderConfig;
  featureFlags?: AdminFeatureFlags;
  isLoading?: boolean;
  loadError?: string | null;
  migrationError?: string | null;
  onSendCampaign?: (newCampaign: Partial<BroadcastCampaign>) => Promise<{ success: boolean; campaign?: BroadcastCampaign; error?: string } | boolean | void> | void;
  onCampaignUpdated?: (campaign: BroadcastCampaign) => void;
  onUpdateCommConfig?: (updated: CommunicationProviderConfig) => void;
  onRefreshCampaigns?: () => void;
  initialTab?: 'compose' | 'history' | 'templates' | 'providers';
  lockedChannel?: 'Email' | 'WhatsApp' | 'SMS';
  hideProvidersTab?: boolean;
  embedded?: boolean;
}

export const AdminBroadcastCenter: React.FC<AdminBroadcastCenterProps> = ({
  campaigns = [],
  users = [],
  subscribers = [],
  jobs = [],
  ads = [],
  commConfig,
  featureFlags,
  isLoading = false,
  loadError = null,
  migrationError = null,
  onSendCampaign,
  onCampaignUpdated,
  onUpdateCommConfig,
  onRefreshCampaigns,
  initialTab,
  lockedChannel,
  hideProvidersTab = false,
  embedded = false
}) => {
  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeAds = Array.isArray(ads) ? ads : [];

  const [campaignList, setCampaignList] = useState<BroadcastCampaign[]>(safeCampaigns);
  const resolvedInitialTab = hideProvidersTab && initialTab === 'providers' ? 'compose' : (initialTab || 'compose');
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'templates' | 'providers' | 'bulk' | 'recipients' | 'subscribers' | 'schedule'>(resolvedInitialTab);
  const [recipientCampaignId, setRecipientCampaignId] = useState<string>('');
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<'ALL' | 'Sent' | 'Delivered' | 'Failed' | 'WaitingForProvider'>('ALL');
  const [recipientHistory, setRecipientHistory] = useState<any[]>([]);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recipientSummary, setRecipientSummary] = useState<any>(null);
  const [recipientHistoryLoading, setRecipientHistoryLoading] = useState(false);
  const [recipientHistoryError, setRecipientHistoryError] = useState('');
  const [recipientHistoryNotice, setRecipientHistoryNotice] = useState('');
  const [recipientRetryBusy, setRecipientRetryBusy] = useState(false);
  const [recipientPrepareBusy, setRecipientPrepareBusy] = useState(false);
  const [dispatchBusyId, setDispatchBusyId] = useState<string | null>(null);
  const [channelReadiness, setChannelReadiness] = useState<{
    email?: { ready: boolean; provider: string; reason?: string };
    whatsapp?: { ready: boolean; provider: string; reason?: string };
    sms?: { ready: boolean; provider: string; reason?: string };
  } | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleCampaignId, setScheduleCampaignId] = useState('');
  const [scheduleItems, setScheduleItems] = useState<any[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(hideProvidersTab && initialTab === 'providers' ? 'compose' : initialTab);
    }
  }, [initialTab, hideProvidersTab]);

  useEffect(() => {
    if (!recipientCampaignId && campaignList.length > 0) setRecipientCampaignId(campaignList[0].id);
  }, [campaignList, recipientCampaignId]);

  useEffect(() => {
    api.broadcasts.getChannelReadiness()
      .then((res) => {
        if (res?.success && res.channels) {
          setChannelReadiness(res.channels);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!scheduleCampaignId) {
      const firstSchedulable = campaignList.find(camp => camp.status === 'Draft' || camp.status === 'Scheduled');
      if (firstSchedulable) setScheduleCampaignId(firstSchedulable.id);
    }
  }, [campaignList, scheduleCampaignId]);

  useEffect(() => {
    if (activeTab !== 'schedule') return;
    let cancelled = false;
    setScheduleLoading(true);
    api.broadcasts.getSchedules().then((res: any) => {
      if (!cancelled && res?.success) setScheduleItems(Array.isArray(res.schedules) ? res.schedules : []);
    }).catch(() => {
      if (!cancelled) setScheduleNotice('Could not load schedule list. Please check database connection and admin access.');
    }).finally(() => { if (!cancelled) setScheduleLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'recipients' || !recipientCampaignId) return;
    let cancelled = false;
    setRecipientHistoryLoading(true);
    setRecipientHistoryError('');
    Promise.all([
      api.broadcasts.getRecipientHistory(recipientCampaignId, recipientPage, 100, recipientStatusFilter),
      api.broadcasts.getRecipientSummary(recipientCampaignId)
    ]).then(([history, summary]) => {
      if (cancelled) return;
      if (!history?.success || !summary?.success) throw new Error(history?.message || summary?.message || 'Could not load recipient history.');
      setRecipientHistory(Array.isArray(history.items) ? history.items : []);
      setRecipientTotal(Number(history.total) || 0);
      setRecipientSummary(summary.summary || null);
    }).catch((err: any) => {
      if (!cancelled) setRecipientHistoryError(err?.message || 'Recipient history request failed.');
    }).finally(() => {
      if (!cancelled) setRecipientHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, recipientCampaignId, recipientPage, recipientStatusFilter]);

  // Channel Gating Statuses (Fail-closed: explicit true required)
  const emailEnabled = featureFlags?.enableEmailAlerts === true;
  const whatsappEnabled = featureFlags?.enableWhatsAppAlerts === true;
  const smsEnabled = featureFlags?.enableSmsAlerts === true;
  const multiChannelEnabled = emailEnabled || whatsappEnabled || smsEnabled;

  const [channel, setChannel] = useState<'Email' | 'WhatsApp' | 'SMS' | 'Push Notification' | 'Multi-Channel'>(
    lockedChannel || (multiChannelEnabled ? 'Multi-Channel' : 'SMS')
  );
  const [selectedMultiChannels, setSelectedMultiChannels] = useState<Array<'Email' | 'WhatsApp' | 'SMS'>>(() => {
    const defaults: Array<'Email' | 'WhatsApp' | 'SMS'> = [];
    if (featureFlags?.enableEmailAlerts) defaults.push('Email');
    if (featureFlags?.enableWhatsAppAlerts) defaults.push('WhatsApp');
    if (featureFlags?.enableSmsAlerts) defaults.push('SMS');
    return defaults;
  });

  useEffect(() => {
    setSelectedMultiChannels((prev) => {
      const enabledPool: Array<'Email' | 'WhatsApp' | 'SMS'> = [
        ...(emailEnabled ? (['Email'] as const) : []),
        ...(whatsappEnabled ? (['WhatsApp'] as const) : []),
        ...(smsEnabled ? (['SMS'] as const) : [])
      ];
      const filtered = prev.filter((c) => enabledPool.includes(c));
      return filtered.length > 0 ? filtered : enabledPool;
    });
  }, [emailEnabled, whatsappEnabled, smsEnabled]);

  useEffect(() => {
    if (lockedChannel) {
      setChannel(lockedChannel);
      return;
    }
    if (channel === 'Email' && !emailEnabled) {
      if (whatsappEnabled) setChannel('WhatsApp');
      else if (smsEnabled) setChannel('SMS');
      else setChannel('Push Notification');
    } else if (channel === 'WhatsApp' && !whatsappEnabled) {
      if (emailEnabled) setChannel('Email');
      else if (smsEnabled) setChannel('SMS');
      else setChannel('Push Notification');
    } else if (channel === 'SMS' && !smsEnabled) {
      if (emailEnabled) setChannel('Email');
      else if (whatsappEnabled) setChannel('WhatsApp');
      else setChannel('Push Notification');
    } else if (channel === 'Multi-Channel' && !multiChannelEnabled) {
      setChannel('Push Notification');
    }
  }, [emailEnabled, whatsappEnabled, smsEnabled, multiChannelEnabled, channel, lockedChannel]);

  const visibleCampaigns = lockedChannel
    ? campaignList.filter((camp) => camp?.channel === lockedChannel || camp?.channel === 'Multi-Channel')
    : campaignList;

  // Synchronize campaign list whenever prop updates
  useEffect(() => {
    setCampaignList(Array.isArray(campaigns) ? campaigns : []);
  }, [campaigns]);

  // Composer state
  const [title, setTitle] = useState('');
  const [linkedAdId, setLinkedAdId] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [pickerTab, setPickerTab] = useState<'jobs' | 'ads'>('jobs');
  const [selectedSingleAdId, setSelectedSingleAdId] = useState('');
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
    smsProvider: 'disabled',
    smsFromNumber: '',
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
  const [smsProvider, setSmsProvider] = useState<'disabled' | 'twilio'>('disabled');
  const [smsFromNumber, setSmsFromNumber] = useState('');
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
  const [testChannel, setTestChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [testRecipient, setTestRecipient] = useState('');
  const [isProviderTesting, setIsProviderTesting] = useState(false);
  const [providerTestMessage, setProviderTestMessage] = useState<string | null>(null);
  const [providerTestError, setProviderTestError] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);

  // Load authoritative provider config from server
  const loadProviderConfig = async () => {
    setIsLoadingProviders(true);
    setProviderSaveError(null);
    try {
      const res = await api.communicationProviders.get();
      const logsResult = await api.communicationProviders.logs(50).catch(() => null);
      if (logsResult?.success && Array.isArray(logsResult.logs)) setDeliveryLogs(logsResult.logs);
      if (res && res.success && res.config) {
        setSafeProviderConfig(res.config);
        setEmailProvider(res.config.emailProvider || 'smtp');
        setSmtpHost(res.config.smtpHost || '');
        setSmtpPort(res.config.smtpPort || 587);
        setSmtpUser(res.config.smtpUser || '');
        setSmtpSenderEmail(res.config.smtpSenderEmail || '');
        setWhatsappProvider(res.config.whatsappProvider || 'meta-cloud');
        setSmsProvider(res.config.smsProvider || 'disabled');
        setSmsFromNumber(res.config.smsFromNumber || '');
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

  const buildCampaignRecipientRows = (camp: BroadcastCampaign) => {
    const selectedUsers = safeUsers.filter(u => {
      switch (camp.targetAudience) {
        case 'Job Seekers Only': return !u?.role?.toLowerCase()?.includes('employer') && !u?.companyName;
        case 'Employers / Posters': return u?.role?.toLowerCase()?.includes('employer') || !!u?.companyName;
        case 'Unpaid / Expired Users': return u?.plan === 'Free' || u?.membershipStatus === 'Expired';
        case 'Government Job Seekers': return Array.isArray(u.skills) && u.skills.some(s => /govt|bps/i.test(s));
        case 'Overseas / Gulf Candidates': return !!u.address && /gulf|dubai|uk|saudi|uae/i.test(u.address);
        case 'Subscribed Members': return false;
        default: return true;
      }
    });
    const selectedSubscribers = camp.targetAudience === 'Subscribed Members'
      ? safeSubscribers.filter(s => s.status === 'Active' || s.status === 'Expiring Soon')
      : camp.targetAudience === 'All Users'
        ? safeSubscribers
        : camp.targetAudience === 'Unpaid / Expired Users'
          ? safeSubscribers.filter(s => s.status === 'Expired' || s.status === 'Pending')
          : [];
    const channels: Array<'Email' | 'WhatsApp' | 'SMS'> = camp.channel === 'Multi-Channel'
      ? ['Email', 'WhatsApp', 'SMS']
      : camp.channel === 'Email' || camp.channel === 'WhatsApp' || camp.channel === 'SMS'
        ? [camp.channel]
        : [];
    const records = new Map<string, { subscriberId: string; channel: 'Email' | 'WhatsApp' | 'SMS'; contactMask?: string }>();
    const addPerson = (person: any) => {
      const subscriberId = String(person?.id || '').trim();
      if (!subscriberId) return;
      const email = String(person?.email || '').trim();
      const phone = String(person?.phone || '').trim();
      for (const ch of channels) {
        const contact = ch === 'Email' ? email : phone;
        if (!contact) continue;
        const mask = ch === 'Email'
          ? (email.includes('@') ? email.slice(0, 2) + '***@' + email.split('@')[1] : 'email')
          : (phone.length > 4 ? '***' + phone.slice(-4) : 'phone');
        records.set(subscriberId + ':' + ch, { subscriberId, channel: ch, contactMask: mask });
      }
    };
    selectedUsers.forEach(addPerson);
    selectedSubscribers.forEach(addPerson);
    return Array.from(records.values());
  };

  const handlePrepareRecipients = async () => {
    const camp = campaignList.find(c => c.id === recipientCampaignId);
    if (!camp) return;
    setRecipientPrepareBusy(true);
    setRecipientHistoryError('');
    try {
      const recipients = buildCampaignRecipientRows(camp);
      const prepared = await api.broadcasts.prepareRecipients(camp.id, recipients);
      if (!prepared?.success) throw new Error(prepared?.message || 'Recipient preparation failed.');
      const [history, summary] = await Promise.all([
        api.broadcasts.getRecipientHistory(camp.id, recipientPage, 100, recipientStatusFilter),
        api.broadcasts.getRecipientSummary(camp.id)
      ]);
      setRecipientHistory(Array.isArray(history?.items) ? history.items : []);
      setRecipientTotal(Number(history?.total) || 0);
      setRecipientSummary(summary?.summary || null);
      setRecipientHistoryNotice(prepared.message || `Prepared ${prepared.newlyPrepared || 0} new recipient/channel records. Ready for dispatch.`);
    } catch (err: any) {
      setRecipientHistoryNotice('');
      setRecipientHistoryError(err?.message || 'Recipient preparation failed.');
    } finally {
      setRecipientPrepareBusy(false);
    }
  };

  const handleToggleJobForDigest = (jobId: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleInsertSelectedJobs = () => {
    const picked = safeJobs.filter((j) => selectedJobIds.includes(j.id));
    if (picked.length === 0) return;

    const first = picked[0];
    setLinkedAdId(picked.map((j) => j.id).join(','));
    if (picked.length === 1) {
      const locationLabel = first.city || first.region || first.country || 'Pakistan';
      setTitle(`Job Alert: ${first.title} (${first.company})`);
      setSubject(`New Job Opening: ${first.title} at ${first.company} — ${locationLabel}`);
      setMessageBody(
        `Hi {{candidate_name}},\n\n*${first.title}* at *${first.company}*\n📍 Location: ${locationLabel}\n💼 Type: ${first.jobType || 'Full-time'} | Category: ${first.jobCategory || 'Jobs'}\n💰 Salary: ${first.salary || 'Competitive'}\n🗓️ Apply Before: ${first.deadlineDate || first.expiryDate || 'Open Now'}\n\nApply now on CareerPak Portal.`
      );
    } else {
      setTitle(`Multi-Job Digest (${picked.length} Openings)`);
      setSubject(`🔥 ${picked.length} New Job Openings Matched for You on CareerPak`);
      const lines = picked.map(
        (j, i) =>
          `${i + 1}. *${j.title}* — ${j.company} (${j.city || j.region || j.country || 'Pakistan'}${j.salary ? ` • ${j.salary}` : ''})`
      );
      setMessageBody(
        `Hi {{candidate_name}},\n\nCheck out these ${picked.length} top opportunities live right now:\n\n${lines.join('\n')}\n\nLog in to CareerPak to view full details & apply!`
      );
    }
    setFormError(null);
  };

  const handleSelectAdCampaign = (adId: string) => {
    setSelectedSingleAdId(adId);
    const ad = safeAds.find((a) => a.id === adId);
    if (!ad) return;
    setLinkedAdId(ad.id);
    setTitle(`Ad Promotion: ${ad.title || ad.headline || ad.id}`);
    setSubject(ad.headline || ad.title || 'Featured Campaign Alert');
    setMessageBody(
      `Hi {{candidate_name}},\n\n*${ad.headline || ad.title}*\n${ad.bodyText || ''}\n\n${ad.ctaText || 'Learn More'}: ${ad.ctaUrl || 'Visit CareerPak'}`
    );
    setFormError(null);
  };

  const toggleMultiChannelChoice = (ch: 'Email' | 'WhatsApp' | 'SMS') => {
    setSelectedMultiChannels((prev) =>
      prev.includes(ch) ? prev.filter((item) => item !== ch) : [...prev, ch]
    );
  };

  const handleApplyTemplate = (tpl: { subject: string; body: string; channel: any; audience: any }) => {
    if (tpl.channel === 'Email' && !emailEnabled) {
      setFormError('Email templates cannot be selected because Email alerts are globally disabled.');
      return;
    }
    if (tpl.channel === 'WhatsApp' && !whatsappEnabled) {
      setFormError('WhatsApp templates cannot be selected because WhatsApp alerts are globally disabled.');
      return;
    }
    if (tpl.channel === 'SMS' && !smsEnabled) {
      setFormError('SMS templates cannot be selected because SMS alerts are globally disabled.');
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

  const runLiveDispatch = async (
    campId: string,
    options: { selectedChannels?: Array<'Email' | 'WhatsApp' | 'SMS'>; retryFailedOnly?: boolean } = {}
  ) => {
    setDispatchBusyId(campId);
    setRecipientHistoryError('');
    setRecipientHistoryNotice('');
    try {
      const res = await api.broadcasts.dispatchCampaign(campId, options);
      if (!res?.success) {
        throw new Error(res?.message || 'Broadcast dispatch failed.');
      }
      if (res.readiness) setChannelReadiness(res.readiness);
      if (res.campaign) {
        setCampaignList((prev) => prev.map((c) => (c.id === res.campaign!.id ? res.campaign! : c)));
        onCampaignUpdated?.(res.campaign);
      }
      setRecipientCampaignId(campId);
      setRecipientPage(1);
      setRecipientHistory(Array.isArray(res.items) ? res.items : []);
      setRecipientTotal(Number(res.total) || 0);
      setRecipientSummary(res.summary || null);
      setRecipientHistoryNotice(
        res.message || `Dispatched: ${res.sentCount} Sent, ${res.failedCount} Failed.`
      );
      setActiveTab('recipients');
      onRefreshCampaigns?.();
      return res;
    } catch (err: any) {
      setRecipientHistoryError(err?.message || 'Live provider dispatch failed.');
      throw err;
    } finally {
      setDispatchBusyId(null);
    }
  };

  const submitCampaign = async (dispatchImmediately: boolean) => {
    setFormError(null);
    setFormSuccess(null);

    if (channel === 'Email' && !emailEnabled) {
      setFormError('Cannot proceed: Email channel is globally disabled by administrator.');
      return;
    }
    if (channel === 'WhatsApp' && !whatsappEnabled) {
      setFormError('Cannot proceed: WhatsApp channel is globally disabled by administrator.');
      return;
    }
    if (channel === 'SMS' && !smsEnabled) {
      setFormError('Cannot proceed: SMS channel is globally disabled by administrator.');
      return;
    }
    if (channel === 'Multi-Channel') {
      if (!multiChannelEnabled) {
        setFormError('Cannot proceed: Enable at least one channel (Email, WhatsApp, or SMS) first.');
        return;
      }
      if (selectedMultiChannels.length === 0) {
        setFormError('Select at least one active channel (Email, WhatsApp, or SMS) for Multi-Channel broadcast.');
        return;
      }
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
      categoryFilter: 'All Categories',
      linkedAdId: linkedAdId.trim() || undefined
    };

    try {
      let createdCampaign: BroadcastCampaign | undefined;
      if (onSendCampaign) {
        const res = await onSendCampaign(payload);
        if (res && typeof res === 'object' && 'success' in res) {
          if (res.success && res.campaign) {
            createdCampaign = res.campaign;
          } else {
            setFormError(res.error || 'Failed to persist broadcast draft to backend.');
            return;
          }
        }
      } else {
        const res = await api.broadcasts.create(payload as any);
        if (res && res.success && res.campaign) {
          createdCampaign = res.campaign;
        } else {
          setFormError(res?.message || 'Failed to save broadcast draft to database.');
          return;
        }
      }

      if (createdCampaign) {
        setCampaignList((prev) => [createdCampaign!, ...prev.filter((c) => c.id !== createdCampaign!.id)]);
        if (dispatchImmediately) {
          const dispatchRes = await runLiveDispatch(createdCampaign.id, {
            selectedChannels: channel === 'Multi-Channel' ? selectedMultiChannels : undefined
          });
          setFormSuccess(
            dispatchRes?.message ||
              `Broadcast "${createdCampaign.title}" processed: ${dispatchRes?.sentCount || 0} sent, ${dispatchRes?.failedCount || 0} failed.`
          );
        } else {
          setFormSuccess(`Broadcast Campaign "${createdCampaign.title}" saved as Draft.`);
          setActiveTab('history');
        }
        setTitle('');
        setSubject('');
        setMessageBody('');
        setSelectedJobIds([]);
      } else {
        setTitle('');
        setSubject('');
        setMessageBody('');
        setSelectedJobIds([]);
        setActiveTab('history');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected error while saving or dispatching broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDispatchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCampaign(false);
  };

  type SecretKeyName = 'smtpPassword' | 'sendgridApiKey' | 'resendApiKey' | 'whatsappCloudApiToken' | 'twilioAuthToken';

  const handleToggleClearSecret = (secretName: SecretKeyName) => {
    setClearSecrets(prev =>
      prev.includes(secretName) ? prev.filter(s => s !== secretName) : [...prev, secretName]
    );
  };

  const handleProviderTest = async () => {
    if (!testRecipient.trim()) {
      setProviderTestError('Enter a test recipient first.');
      return;
    }
    setIsProviderTesting(true);
    setProviderTestError(null);
    setProviderTestMessage(null);
    try {
      const result = await api.communicationProviders.test({ channel: testChannel, recipient: testRecipient.trim() });
      if (result?.success) setProviderTestMessage(result.message || 'Test accepted by provider.');
      else setProviderTestError(result?.message || 'Provider did not accept the test message.');
    } catch (err: any) {
      setProviderTestError(err?.message || 'Provider test request failed.');
    } finally {
      setIsProviderTesting(false);
    }
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
      smsProvider,
      smsFromNumber: smsFromNumber.trim(),
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
            smsProvider: res.config.smsProvider,
            smsFromNumber: res.config.smsFromNumber,
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
    <div className={`admin-settings-mobile-compact ${embedded ? 'space-y-2.5 sm:space-y-3' : 'space-y-3 sm:space-y-4'} text-white`}>
      {/* Compact Top Banner & Sub-Tabs */}
      <div className={`bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl ${embedded ? 'p-2.5 sm:p-3.5' : 'p-3 sm:p-4'} shadow-lg space-y-2.5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{lockedChannel ? `${lockedChannel} Broadcast` : 'Unified Multi-Channel Broadcast'}</span>
            </div>
            <h2 className="text-sm sm:text-base font-black text-white truncate">
              {lockedChannel ? `${lockedChannel} Campaigns & Delivery Tracking` : 'Job / Ad Multi-Channel Broadcast & Dispatch'}
            </h2>
          </div>

          {channelReadiness && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] shrink-0">
              {(['email', 'whatsapp', 'sms'] as const).map((ch) => {
                const r = channelReadiness[ch];
                const label = ch === 'email' ? 'Email' : ch === 'whatsapp' ? 'WA' : 'SMS';
                return (
                  <span
                    key={ch}
                    title={r?.reason || `${label}: ${r?.ready ? 'Gateway Ready' : 'Not Configured'}`}
                    className={`px-2 py-0.5 rounded-md font-bold border whitespace-nowrap ${
                      r?.ready
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {label}: {r?.ready ? 'Ready' : 'No Key'}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact Scrollable Sub-tabs (Single clean bar on mobile) */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px]">
          {[
            { id: 'compose', label: 'Compose', icon: Send },
            { id: 'history', label: `History (${visibleCampaigns.length})`, icon: Clock },
            { id: 'recipients', label: 'Sent / Failed', icon: Users },
            { id: 'schedule', label: 'Schedule', icon: Clock },
            { id: 'subscribers', label: `Plans (${safeSubscribers.length})`, icon: Users },
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'bulk', label: 'Bulk Notify', icon: Bell },
            ...(!hideProvidersTab ? [{ id: 'providers', label: 'Gateways', icon: Layers }] : [])
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`px-2.5 py-1.5 rounded-md font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Channel Master-Switch Compact Strip */}
      {!embedded && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
          <div className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-1 ${
            emailEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span className="truncate font-bold">Email: {emailEnabled ? 'ON' : 'OFF'}</span>
            <Mail className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-1 ${
            whatsappEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span className="truncate font-bold">WhatsApp: {whatsappEnabled ? 'ON' : 'OFF'}</span>
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-1 ${
            smsEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span className="truncate font-bold">SMS: {smsEnabled ? 'ON' : 'OFF'}</span>
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
          </div>
        </div>
      )}

      {/* TAB 1: COMPOSE CAMPAIGN */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Main Compose Form */}
          <form onSubmit={handleDispatchCampaign} className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <h3 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-amber-400" />
                <span>Compose &amp; Dispatch Broadcast</span>
              </h3>
              <span className="text-[11px] font-mono tabular-nums text-emerald-400 font-bold">
                Reach: ~{audienceCount}
              </span>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Quick Posted Job(s) / Ad Picker */}
            {(safeJobs.length > 0 || safeAds.length > 0) && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-black text-white">Attach Posted Job(s) or Ad</span>
                  </div>
                  <div className="inline-flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPickerTab('jobs')}
                      className={`px-2 py-1 rounded font-bold cursor-pointer ${pickerTab === 'jobs' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
                    >
                      Jobs ({safeJobs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerTab('ads')}
                      className={`px-2 py-1 rounded font-bold cursor-pointer ${pickerTab === 'ads' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                    >
                      Ads ({safeAds.length})
                    </button>
                  </div>
                </div>

                {pickerTab === 'jobs' ? (
                  safeJobs.length === 0 ? (
                    <p className="text-[10px] text-slate-500">No posted jobs loaded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="max-h-28 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 pr-1">
                        {safeJobs.slice(0, 20).map((job) => {
                          const checked = selectedJobIds.includes(job.id);
                          return (
                            <label
                              key={job.id}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] cursor-pointer truncate ${
                                checked
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleJobForDigest(job.id)}
                                className="accent-amber-500 shrink-0"
                              />
                              <span className="truncate font-semibold">{job.title}</span>
                              <span className="text-[9px] text-slate-500 shrink-0">({job.city || 'PK'})</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">
                          {selectedJobIds.length} job(s) selected
                        </span>
                        <button
                          type="button"
                          disabled={selectedJobIds.length === 0}
                          onClick={handleInsertSelectedJobs}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black cursor-pointer disabled:opacity-40 whitespace-nowrap"
                        >
                          Fill Broadcast from Job(s)
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col sm:flex-row gap-1.5">
                    <select
                      value={selectedSingleAdId}
                      onChange={(e) => handleSelectAdCampaign(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-[11px] font-semibold"
                    >
                      <option value="">Select an Ad Campaign to populate...</option>
                      {safeAds.map((ad) => (
                        <option key={ad.id} value={ad.id}>
                          {ad.title || ad.headline} ({ad.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-300 mb-1 text-[11px]">Campaign Name</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. FPSC Gazette Urgent Alert"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1 text-[11px]">Linked Job / Ad ID (optional)</label>
                  <input
                    type="text"
                    value={linkedAdId}
                    onChange={(e) => setLinkedAdId(e.target.value)}
                    maxLength={160}
                    placeholder="Job or Ad ID"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-300 mb-1 text-[11px]">Channel</label>
                  {lockedChannel ? (
                    <div className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold flex items-center justify-between text-xs">
                      <span>
                        {lockedChannel === 'Email'
                          ? '📧 Email Campaign'
                          : lockedChannel === 'WhatsApp'
                          ? '💬 Official WhatsApp'
                          : '📱 Direct SMS'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        (lockedChannel === 'Email' ? emailEnabled : lockedChannel === 'WhatsApp' ? whatsappEnabled : smsEnabled)
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {(lockedChannel === 'Email' ? emailEnabled : lockedChannel === 'WhatsApp' ? whatsappEnabled : smsEnabled) ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  ) : (
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-xs"
                    >
                      <option value="Multi-Channel" disabled={!multiChannelEnabled}>⚡ Multi-Channel (Combined){!multiChannelEnabled ? ' (Off)' : ''}</option>
                      <option value="Email" disabled={!emailEnabled}>📧 Email {!emailEnabled ? '(Disabled)' : ''}</option>
                      <option value="WhatsApp" disabled={!whatsappEnabled}>💬 WhatsApp {!whatsappEnabled ? '(Disabled)' : ''}</option>
                      <option value="SMS" disabled={!smsEnabled}>📱 SMS {!smsEnabled ? '(Disabled)' : ''}</option>
                      <option value="Push Notification">🔔 Browser Push</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1 text-[11px]">Target Audience</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-xs"
                  >
                    <option value="All Users">All Users (~{audienceCount})</option>
                    <option value="Job Seekers Only">Job Seekers Only</option>
                    <option value="Employers / Posters">Employers &amp; Posters</option>
                    <option value="Subscribed Members">Subscribed Members ({subscribers.length})</option>
                    <option value="Unpaid / Expired Users">Unpaid / Expired Members</option>
                    <option value="Government Job Seekers">Govt &amp; BPS Seekers</option>
                    <option value="Overseas / Gulf Candidates">Overseas &amp; Gulf</option>
                  </select>
                </div>
              </div>

              {/* Multi-Channel Checkbox Selector */}
              {channel === 'Multi-Channel' && !lockedChannel && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-300">Select Active Dispatch Channels:</span>
                    <span className="text-[10px] text-slate-400">Uses configured APIs</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: 'Email', enabled: emailEnabled, ready: channelReadiness?.email?.ready },
                      { id: 'WhatsApp', enabled: whatsappEnabled, ready: channelReadiness?.whatsapp?.ready },
                      { id: 'SMS', enabled: smsEnabled, ready: channelReadiness?.sms?.ready }
                    ] as const).map((item) => {
                      const active = selectedMultiChannels.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            !item.enabled
                              ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                              : active
                              ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                              : 'bg-slate-900 border-slate-700 text-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={!item.enabled}
                            checked={active && item.enabled}
                            onChange={() => toggleMultiChannelChoice(item.id)}
                            className="accent-indigo-400"
                          />
                          <span>{item.id}</span>
                          {item.enabled && (
                            <span className={`text-[9px] px-1 rounded ${item.ready ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                              {item.ready ? 'Ready' : 'No Key'}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {(channel === 'Email' || (channel === 'Multi-Channel' && selectedMultiChannels.includes('Email'))) && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1 text-[11px]">Email Subject Line</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="🔥 Top New Jobs in Islamabad, Lahore & Dubai"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium text-xs"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-300 text-[11px]">Message Content</label>
                  <span className="text-[10px] text-slate-500 font-mono">{'{{candidate_name}}'}</span>
                </div>
                <textarea
                  rows={5}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type your broadcast message or select Job(s) above..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs leading-relaxed"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer text-[11px]"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>{previewMode ? 'Hide Preview' : 'Preview'}</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isSending || (channel === 'Email' && !emailEnabled) || (channel === 'WhatsApp' && !whatsappEnabled) || (channel === 'SMS' && !smsEnabled) || (channel === 'Multi-Channel' && (!multiChannelEnabled || selectedMultiChannels.length === 0))}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-bold rounded-xl text-xs cursor-pointer disabled:opacity-40 whitespace-nowrap"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => submitCampaign(true)}
                  disabled={isSending || Boolean(dispatchBusyId) || (channel === 'Email' && !emailEnabled) || (channel === 'WhatsApp' && !whatsappEnabled) || (channel === 'SMS' && !smsEnabled) || (channel === 'Multi-Channel' && (!multiChannelEnabled || selectedMultiChannels.length === 0))}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer text-xs disabled:opacity-40 whitespace-nowrap"
                >
                  <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
                  <span>{isSending ? 'Dispatching...' : 'Save & Dispatch Now'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Compact Preview Device */}
          <div className={`${previewMode ? 'block' : 'hidden lg:block'} bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-lg h-fit`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300">Device Preview</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold">
                {channel === 'Multi-Channel' ? selectedMultiChannels.join('+') || 'Multi' : channel}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-1.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  CP
                </div>
                <div>
                  <div className="font-bold text-white text-[11px]">CareerPak Alerts</div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    {channel === 'WhatsApp' ? 'WhatsApp Business' : channel === 'SMS' ? 'SMS Gateway' : 'alerts@careerpak.com'}
                  </div>
                </div>
              </div>

              {subject && (
                <div className="font-bold text-amber-400 text-[11px] border-b border-slate-900/80 pb-1">
                  {subject}
                </div>
              )}

              <div className="text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed max-h-52 overflow-y-auto">
                {messageBody ? messageBody.replace('{{candidate_name}}', 'Ahmad Khan') : (
                  <span className="text-slate-600 italic">Message preview will appear here...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white">Campaign Schedule & Queue</h3>
            <p className="text-xs text-slate-400 mt-1">Save a future send time in Pakistan time. Automatic dispatch remains off until provider APIs and webhook handling are configured.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Draft Campaign</label>
              <select value={scheduleCampaignId} onChange={e => setScheduleCampaignId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
                <option value="">Select campaign</option>
                {campaignList.filter(camp => camp.status === 'Draft' || camp.status === 'Scheduled').map(camp => <option key={camp.id} value={camp.id}>{camp.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Date & Time (Pakistan)</label>
              <input type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} value={scheduleDateTime} onChange={e => setScheduleDateTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
            </div>
            <button type="button" disabled={!scheduleCampaignId || !scheduleDateTime || new Date(scheduleDateTime).getTime() <= Date.now() || scheduleBusy} onClick={async () => {
              setScheduleBusy(true); setScheduleNotice('');
              try {
                const scheduledAt = new Date(scheduleDateTime + ':00+05:00').toISOString();
                const result = await api.broadcasts.scheduleCampaign(scheduleCampaignId, scheduledAt, 'Asia/Karachi');
                if (!result?.success) throw new Error(result?.message || 'Schedule save failed.');
                setScheduleNotice(result.message || 'Schedule saved; provider setup is still required for dispatch.');
                const refreshed = await api.broadcasts.getSchedules();
                if (refreshed?.success) setScheduleItems(Array.isArray(refreshed.schedules) ? refreshed.schedules : []);
              } catch (err: any) {
                setScheduleNotice(err?.message || 'Schedule save failed.');
              } finally { setScheduleBusy(false); }
            }} className="px-4 py-2.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-black disabled:opacity-40">
              {scheduleBusy ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
          {scheduleNotice && <div className="text-xs text-slate-300 bg-slate-800 rounded-lg p-3">{scheduleNotice}</div>}
          {scheduleLoading ? <div className="text-xs text-slate-400 py-5 text-center">Loading schedules…</div> : (
            <div className="space-y-2">
              {scheduleItems.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div>
                    <div className="text-xs font-bold text-white">{campaignList.find(camp => camp.id === item.campaignId)?.title || item.campaignId}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{new Date(item.scheduledAt).toLocaleString()} • {item.timezone} • {item.state}</div>
                    <div className="text-[10px] text-amber-300 mt-1">{item.note}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={scheduleBusy || item.state === 'Paused' || item.state === 'Cancelled'} onClick={async () => {
                      setScheduleBusy(true);
                      try {
                        const result = await api.broadcasts.updateScheduleState(item.campaignId, 'Paused');
                        if (!result?.success) throw new Error(result?.message || 'Pause failed.');
                        setScheduleItems(prev => prev.map(row => row.campaignId === item.campaignId ? {...row, state: 'Paused'} : row));
                      } catch (err: any) { setScheduleNotice(err?.message || 'Pause failed.'); }
                      finally { setScheduleBusy(false); }
                    }} className="px-3 py-2 rounded-lg border border-amber-500/20 text-amber-300 text-xs disabled:opacity-40">Pause</button>
                    <button type="button" disabled={scheduleBusy || item.state === 'Cancelled'} onClick={async () => {
                      setScheduleBusy(true);
                      try {
                        const result = await api.broadcasts.updateScheduleState(item.campaignId, 'Cancelled');
                        if (!result?.success) throw new Error(result?.message || 'Cancel failed.');
                        setScheduleItems(prev => prev.map(row => row.campaignId === item.campaignId ? {...row, state: 'Cancelled'} : row));
                      } catch (err: any) { setScheduleNotice(err?.message || 'Cancel failed.'); }
                      finally { setScheduleBusy(false); }
                    }} className="px-3 py-2 rounded-lg border border-rose-500/20 text-rose-300 text-xs disabled:opacity-40">Cancel</button>
                  </div>
                </div>
              ))}
              {!scheduleItems.length && <div className="text-xs text-slate-500 text-center py-5">No campaign schedules yet.</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'subscribers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Subscriber Plans & Expiry</h3>
            <p className="text-xs text-slate-400 mt-1">Uses the existing subscriber records and reconciled subscription status. No duplicate subscription store is created.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['Active', 'Expiring Soon', 'Pending', 'Expired'] as const).map(status => (
              <div key={status} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-[10px] text-slate-500">{status}</div>
                <div className="text-lg font-black text-white">{safeSubscribers.filter(s => s.status === status).length}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-slate-500 border-b border-slate-800"><tr><th className="py-2 pr-3">Subscriber</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Expiry</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">WhatsApp</th><th className="py-2">SMS</th></tr></thead>
              <tbody>{safeSubscribers.map(sub => <tr key={sub.id} className="border-b border-slate-800/70">
                <td className="py-2 pr-3"><div className="text-slate-200">{sub.name}</div><div className="text-[10px] text-slate-500">{sub.email}</div></td>
                <td className="py-2 pr-3 text-slate-300">{sub.plan}</td>
                <td className="py-2 pr-3 text-slate-300">{sub.status}</td>
                <td className="py-2 pr-3 text-slate-400">{sub.expiryDate || 'Not set'}</td>
                <td className="py-2 pr-3 text-slate-400">{sub.email ? 'Available' : 'Missing'}</td>
                <td className="py-2 pr-3 text-slate-400">{sub.whatsappEnabled && sub.phone ? 'Eligible' : 'Off / Missing'}</td>
                <td className="py-2 text-slate-400">{sub.phone ? 'Available' : 'Missing'}</td>
              </tr>)}</tbody>
            </table>
            {!safeSubscribers.length && <div className="text-xs text-slate-500 text-center py-6">No subscriber records are available from the existing admin data source.</div>}
          </div>
        </div>
      )}

      {activeTab === 'recipients' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white">Sent vs Failed Delivery Report</h3>
              <p className="text-[11px] text-slate-400">Live gateway outcomes per recipient &amp; channel with exact failure details.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={recipientCampaignId}
                onChange={e => {
                  setRecipientCampaignId(e.target.value);
                  setRecipientPage(1);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[220px]"
              >
                <option value="">Select campaign</option>
                {campaignList.map(camp => <option key={camp.id} value={camp.id}>{camp.title} ({camp.channel})</option>)}
              </select>
              <button
                type="button"
                disabled={!recipientCampaignId || recipientPrepareBusy}
                onClick={handlePrepareRecipients}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {recipientPrepareBusy ? 'Preparing…' : 'Prepare List'}
              </button>
              <button
                type="button"
                disabled={!recipientCampaignId || dispatchBusyId === recipientCampaignId}
                onClick={() => runLiveDispatch(recipientCampaignId, { retryFailedOnly: false })}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {dispatchBusyId === recipientCampaignId ? 'Dispatching…' : 'Dispatch Pending'}
              </button>
              <button
                type="button"
                disabled={!recipientCampaignId || recipientRetryBusy || dispatchBusyId === recipientCampaignId}
                onClick={async () => {
                  setRecipientRetryBusy(true);
                  try {
                    await runLiveDispatch(recipientCampaignId, { retryFailedOnly: true });
                  } finally {
                    setRecipientRetryBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {recipientRetryBusy ? 'Retrying…' : 'Retry Failed Now'}
              </button>
            </div>
          </div>

          {recipientHistoryError && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">{recipientHistoryError}</div>}
          {recipientHistoryNotice && <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">{recipientHistoryNotice}</div>}

          {/* Summary Cards + Status Filter Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {recipientSummary?.counts && (
              <div className="flex flex-wrap gap-1.5">
                {(['Sent', 'Failed', 'WaitingForProvider', 'Delivered'] as const).map((status) => (
                  <div key={status} className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">{status === 'WaitingForProvider' ? 'Pending' : status}:</span>
                    <span className={`text-xs font-black tabular-nums ${
                      status === 'Sent' || status === 'Delivered' ? 'text-emerald-400' : status === 'Failed' ? 'text-rose-400' : 'text-amber-300'
                    }`}>
                      {String(recipientSummary.counts[status] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px]">
              {(['ALL', 'Sent', 'Failed', 'WaitingForProvider', 'Delivered'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setRecipientStatusFilter(st);
                    setRecipientPage(1);
                  }}
                  className={`px-2 py-1 rounded font-bold cursor-pointer ${
                    recipientStatusFilter === st
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'WaitingForProvider' ? 'Pending' : st}
                </button>
              ))}
            </div>
          </div>

          {recipientHistoryLoading ? <div className="text-xs text-slate-400 py-5 text-center">Loading recipient report…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[11px]">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 pr-2">Recipient</th>
                    <th className="py-1.5 pr-2">Channel</th>
                    <th className="py-1.5 pr-2">Contact</th>
                    <th className="py-1.5 pr-2">Status</th>
                    <th className="py-1.5 pr-2">Result / Failure Reason</th>
                    <th className="py-1.5 pr-2">Try</th>
                    <th className="py-1.5">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recipientHistory.map(item => (
                    <tr key={item.id} className="border-b border-slate-800/70">
                      <td className="py-1.5 pr-2 text-slate-200 font-semibold">{item.recipientName || item.subscriberId}</td>
                      <td className="py-1.5 pr-2 text-slate-300">{item.channel}</td>
                      <td className="py-1.5 pr-2 font-mono text-slate-400">{item.contactMask || '—'}</td>
                      <td className="py-1.5 pr-2">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          item.status === 'Sent' || item.status === 'Delivered'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : item.status === 'Failed'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 max-w-[240px] truncate text-[10px]" title={item.failureReason || item.providerMessageId || ''}>
                        {item.failureReason ? (
                          <span className="text-rose-300">{item.failureReason}</span>
                        ) : item.providerMessageId ? (
                          <span className="text-emerald-300 font-mono">ID: {item.providerMessageId}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 font-mono tabular-nums text-slate-300">{item.attempts ?? 0}</td>
                      <td className="py-1.5 text-slate-500 whitespace-nowrap">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!recipientHistory.length && (
                <div className="text-xs text-slate-500 text-center py-5">
                  No matching recipient records. Click &quot;Dispatch Pending&quot; to send through active gateways.
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
                <span>Showing {recipientTotal ? ((recipientPage - 1) * 100 + 1) : 0}–{Math.min(recipientPage * 100, recipientTotal)} of {recipientTotal}</span>
                <div className="flex gap-1.5">
                  <button type="button" disabled={recipientPage <= 1 || recipientHistoryLoading} onClick={() => setRecipientPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded-lg border border-slate-700 disabled:opacity-40 cursor-pointer">Prev</button>
                  <button type="button" disabled={recipientPage * 100 >= recipientTotal || recipientHistoryLoading} onClick={() => setRecipientPage(p => p + 1)} className="px-2.5 py-1 rounded-lg border border-slate-700 disabled:opacity-40 cursor-pointer">Next</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: CENTRALIZED LEGACY BULK NOTIFICATION TOOL */}
      {activeTab === 'bulk' && (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2.5 text-xs text-indigo-200">
            Bulk portal notifications &amp; draft targeting from the unified channel workspace.
          </div>
          <AdminBulkNotificationTool users={safeUsers} subscribers={safeSubscribers} featureFlags={featureFlags} />
        </div>
      )}

      {/* TAB 2: CAMPAIGN HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Campaign History ({visibleCampaigns.length})</span>
            </h3>
            {onRefreshCampaigns && (
              <button
                type="button"
                onClick={onRefreshCampaigns}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer"
              >
                Refresh
              </button>
            )}
          </div>

          {loadError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center justify-between">
              <span>{loadError}</span>
              {onRefreshCampaigns && (
                <button type="button" onClick={onRefreshCampaigns} className="px-2.5 py-1 bg-rose-500/20 rounded font-bold cursor-pointer">Retry</button>
              )}
            </div>
          )}

          {migrationError && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
              Legacy Campaign Import: {migrationError}
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <Clock className="w-5 h-5 animate-spin mx-auto text-amber-400" />
              <p className="text-xs">Loading broadcast campaigns...</p>
            </div>
          ) : visibleCampaigns.length === 0 ? (
            <div className="py-8 text-center text-slate-500 space-y-1.5">
              <Megaphone className="w-7 h-7 mx-auto text-slate-600 opacity-50" />
              <p className="font-bold text-slate-400 text-xs">No {lockedChannel || ''} campaigns saved yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {visibleCampaigns.map((camp) => (
              <div key={camp.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-white text-xs sm:text-sm truncate">{camp.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {camp.channel}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      camp.status === 'Draft'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : camp.status === 'Sent'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : camp.status === 'Failed'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-slate-700/30 text-slate-300 border-slate-600/30'
                    }`}>
                      {camp.status}
                    </span>
                    {(camp.sentCount !== undefined || camp.failedCount !== undefined) && (
                      <>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 tabular-nums">
                          Sent: {camp.sentCount ?? 0}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 tabular-nums">
                          Failed: {camp.failedCount ?? 0}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-slate-400 text-[11px] font-mono">
                    {camp.sentAt ? `Sent: ${camp.sentAt} • ` : ''}Audience: <span className="text-amber-400">{camp.targetAudience}</span> (~{camp.recipientsCount})
                    {camp.linkedAdId ? <> • Linked: <span className="text-indigo-300">{camp.linkedAdId}</span></> : null}
                  </div>
                  <div className="text-slate-500 text-[11px] line-clamp-1">
                    &quot;{camp.messageBody}&quot;
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {(['Email', 'WhatsApp', 'SMS', 'Multi-Channel'].includes(camp.channel)) && (
                    <button
                      type="button"
                      disabled={dispatchBusyId === camp.id}
                      onClick={() => runLiveDispatch(camp.id, { retryFailedOnly: false })}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] cursor-pointer disabled:opacity-40 whitespace-nowrap"
                    >
                      {dispatchBusyId === camp.id ? 'Sending…' : 'Dispatch'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientCampaignId(camp.id);
                      setRecipientPage(1);
                      setActiveTab('recipients');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-[11px] cursor-pointer whitespace-nowrap"
                  >
                    Report
                  </button>
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
          {(!lockedChannel || lockedChannel === 'Email') && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Email Weekly Digest
              </span>
              <h4 className="font-bold text-sm text-white">Top 50 Government & Corporate Openings</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Highlights the week&apos;s highest-paying tech vacancies and gazetted BPS-16/17/18 government openings.
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
          )}

          {/* Template 2 */}
          {(!lockedChannel || lockedChannel === 'WhatsApp') && (
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
          )}

          {/* Template 3 */}
          {(!lockedChannel || lockedChannel === 'Email') && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Email Employer Promotion
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
          )}

          {/* Template 4 (SMS Template) */}
          {(!lockedChannel || lockedChannel === 'SMS') && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                SMS Flash Alert (160 Chars)
              </span>
              <h4 className="font-bold text-sm text-white">Concise Govt / Walk-in SMS Alert</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Compact single-segment SMS copy crafted for instant candidate click-throughs and expiry warnings.
              </p>
            </div>
            <button
              onClick={() => handleApplyTemplate({
                subject: 'SMS Flash Job Alert',
                body: 'Hi {{candidate_name}}, 25+ new FPSC & Provincial BPS-17 jobs open now. Apply before deadline on CareerPak!',
                channel: 'SMS',
                audience: 'Subscribed Members'
              })}
              disabled={!smsEnabled}
              className={`w-full py-2.5 font-bold rounded-xl cursor-pointer text-center ${
                smsEnabled ? 'bg-indigo-400 hover:bg-indigo-300 text-slate-950' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {smsEnabled ? 'Use This Template →' : 'Template Disabled (SMS OFF)'}
            </button>
          </div>
          )}

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
                Manage authoritative Email, WhatsApp and independent SMS gateways. All API keys and secrets are encrypted server-side with AES-256-GCM.
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

          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
            <div><h4 className="text-xs font-black text-sky-200">Test Provider Connection</h4><p className="mt-1 text-[10px] text-slate-400">Send one test to an address or phone number you control. Limit: one test per admin every 30 seconds.</p></div>
            <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
              <select value={testChannel} onChange={e => setTestChannel(e.target.value as 'email' | 'whatsapp' | 'sms')} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white">
                <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option>
              </select>
              <input type={testChannel === 'email' ? 'email' : 'tel'} value={testRecipient} onChange={e => setTestRecipient(e.target.value)} placeholder={testChannel === 'email' ? 'your@email.com' : '+923001234567'} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white" />
              <button type="button" onClick={handleProviderTest} disabled={isProviderTesting || !testRecipient.trim()} className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isProviderTesting ? 'Testing...' : 'Send Test'}</button>
            </div>
            {providerTestMessage && <p role="status" className="text-[11px] text-emerald-300">{providerTestMessage}</p>}
            {providerTestError && <p role="alert" className="text-[11px] text-rose-300">{providerTestError}</p>}
            {testChannel === 'email' && emailProvider === 'smtp' && <p className="text-[10px] text-amber-300">SMTP transport is not implemented yet. Use Resend or SendGrid for an email test.</p>}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between"><h4 className="text-xs font-black text-white">Recent Paid Alert Delivery Logs</h4><span className="text-[9px] text-slate-500">MongoDB · 90-day retention</span></div>
            {deliveryLogs.length === 0 ? <p className="text-[10px] text-slate-500">No paid alert delivery attempts are recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-[10px]">
              <thead className="text-slate-500"><tr><th className="p-2">Channel</th><th className="p-2">Provider</th><th className="p-2">Result</th><th className="p-2">Attempts</th><th className="p-2">Last attempt</th></tr></thead>
              <tbody>{deliveryLogs.slice(0, 20).map((log: any) => <tr key={log.eventId + log.channel} className="border-t border-slate-800 text-slate-300"><td className="p-2 uppercase">{log.channel}</td><td className="p-2">{log.provider}</td><td className={`p-2 font-bold ${log.status === 'SENT' ? 'text-emerald-300' : 'text-rose-300'}`}>{log.status}</td><td className="p-2">{log.attempts}</td><td className="p-2">{log.lastAttemptAt ? new Date(log.lastAttemptAt).toLocaleString() : '—'}</td></tr>)}</tbody>
            </table></div>}
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

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2"><span className="font-bold text-slate-200 uppercase text-[11px] tracking-wider flex items-center space-x-1.5"><Smartphone className="w-4 h-4 text-indigo-400" /><span>SMS Gateway Configuration</span></span><span className="text-[10px] text-slate-500 font-mono">Provider: {smsProvider.toUpperCase()}</span></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block font-bold text-slate-300">SMS Provider Adapter<select value={smsProvider} onChange={(e) => setSmsProvider(e.target.value as 'disabled' | 'twilio')} className="mt-1 w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"><option value="disabled">Disabled</option><option value="twilio">Twilio SMS</option></select></label>
              <label className="block font-bold text-slate-300">SMS Sender Number<input type="text" value={smsFromNumber} onChange={(e) => setSmsFromNumber(e.target.value)} placeholder="+92... (Twilio verified sender)" className="mt-1 w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono" /></label>
            </div>
            <p className="text-[10px] text-slate-500">SMS uses the securely stored Twilio Account SID and Auth Token above, but has its own provider switch and sender number. It does not depend on WhatsApp provider selection.</p>
          </div>
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
