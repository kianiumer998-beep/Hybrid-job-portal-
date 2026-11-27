import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Mail,
  Smartphone,
  ShieldCheck,
  Save,
  Send,
  Layers,
  Percent,
  RotateCcw,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Flame,
  FileText,
  Megaphone,
  Bell,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '../../services/api';
import { AdminFeatureFlags, Job, Subscriber, UserAccount } from '../../types/job';
import { Advertisement } from '../../types/ad';
import { CommunicationProviderConfig } from '../../types/adminSuite';

export interface AdminMasterRuleEngineProps {
  pricing: any;
  onUpdatePricing?: (updated: any) => void;
  canManagePricing: boolean;
  canManageSettings: boolean;
  featureFlags?: AdminFeatureFlags;
  commConfig?: CommunicationProviderConfig;
  users?: UserAccount[];
  subscribers?: Subscriber[];
  ads?: Advertisement[];
  jobs?: Job[];
  onSwitchToBroadcast?: () => void;
  onSwitchToGateways?: () => void;
}

export type AutomationProfile = 'auto-pilot' | 'high-urgency' | 'balanced' | 'custom';

export interface MasterMonitoredScopes {
  whatsappPackages: boolean;
  emailPackages: boolean;
  smsPackages: boolean;
  cvPackages: boolean;
  jobPackages: boolean;
  urgentFeaturedJobs: boolean;
  adCampaignsPlcSic: boolean;
  earlyAccessPass: boolean;
  employerSubscriptions: boolean;
}

const DEFAULT_SCOPES: MasterMonitoredScopes = {
  whatsappPackages: true,
  emailPackages: true,
  smsPackages: true,
  cvPackages: true,
  jobPackages: true,
  urgentFeaturedJobs: true,
  adCampaignsPlcSic: true,
  earlyAccessPass: true,
  employerSubscriptions: true
};

const DEFAULT_TEMPLATE_SUBJECT = '⚡ {{portal_name}} Alert: {{package_name}} is {{usage_percent}}% consumed';
const DEFAULT_TEMPLATE_BODY =
  'Assalam-o-Alaikum {{user_name}},\n\nYour active {{package_name}} on CareerPak has reached {{usage_percent}}% utilization.\n• Days Remaining: {{days_remaining}} day(s)\n• Expiry Date: {{expiry_date}}\n• Available Quota: {{remaining_quota}}\n\nRenew or upgrade now in your Employer Dashboard to avoid any service disruption.';

export const AdminMasterRuleEngine: React.FC<AdminMasterRuleEngineProps> = ({
  pricing,
  onUpdatePricing,
  canManagePricing,
  canManageSettings,
  featureFlags,
  commConfig,
  users = [],
  subscribers = [],
  ads = [],
  jobs = [],
  onSwitchToBroadcast,
  onSwitchToGateways
}) => {
  const reminderRaw = pricing?.subscriptionReminderSettings || {};

  // Master Engine Switch
  const [engineEnabled, setEngineEnabled] = useState<boolean>(reminderRaw.enabled !== false);

  // Automation Preset Profile
  const [automationProfile, setAutomationProfile] = useState<AutomationProfile>(() => {
    if (reminderRaw.automationProfile) return reminderRaw.automationProfile;
    return 'auto-pilot';
  });

  // Percentage Usage Triggers (e.g. 20%, 30%, 50%, 80%, 100%)
  const [percentTriggers, setPercentTriggers] = useState<number[]>(() => {
    if (Array.isArray(reminderRaw.percentTriggers) && reminderRaw.percentTriggers.length > 0) {
      return reminderRaw.percentTriggers
        .map((n: any) => Math.min(100, Math.max(1, Number(n) || 1)))
        .sort((a: number, b: number) => a - b);
    }
    return [20, 30, 50, 80, 100];
  });

  // Custom % input toggle
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [customPercentInput, setCustomPercentInput] = useState<string>('');

  // Repeat Cadence: none, 5%, 10%, 2d, 3d
  const [repeatMode, setRepeatMode] = useState<'none' | 'percent-5' | 'percent-10' | 'days-2' | 'days-3'>(() => {
    if (reminderRaw.repeatMode === 'none') return 'none';
    if (reminderRaw.repeatMode === 'days') {
      return Number(reminderRaw.repeatDaysInterval) === 3 ? 'days-3' : 'days-2';
    }
    return Number(reminderRaw.repeatIntervalPercent) === 10 ? 'percent-10' : 'percent-5';
  });

  // Multi-Channel Delivery Flags
  const [inAppEnabled, setInAppEnabled] = useState<boolean>(reminderRaw.inAppEnabled !== false);
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(reminderRaw.whatsappEnabled === true);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(reminderRaw.emailEnabled === true);
  const [smsEnabled, setSmsEnabled] = useState<boolean>(reminderRaw.smsEnabled === true);

  // Lead Time Days (Days before final expiry)
  const [inAppDaysBefore, setInAppDaysBefore] = useState<number>(
    Number.isInteger(Number(reminderRaw.inAppDaysBefore)) ? Number(reminderRaw.inAppDaysBefore) : (Number(reminderRaw.daysBefore) || 3)
  );
  const [whatsappDaysBefore, setWhatsappDaysBefore] = useState<number>(
    Number.isInteger(Number(reminderRaw.whatsappDaysBefore)) ? Number(reminderRaw.whatsappDaysBefore) : (Number(reminderRaw.daysBefore) || 3)
  );
  const [emailDaysBefore, setEmailDaysBefore] = useState<number>(
    Number.isInteger(Number(reminderRaw.emailDaysBefore)) ? Number(reminderRaw.emailDaysBefore) : (Number(reminderRaw.daysBefore) || 3)
  );
  const [smsDaysBefore, setSmsDaysBefore] = useState<number>(
    Number.isInteger(Number(reminderRaw.smsDaysBefore)) ? Number(reminderRaw.smsDaysBefore) : (Number(reminderRaw.daysBefore) || 1)
  );

  // 9 Explicit Monitored Scopes
  const [scopes, setScopes] = useState<MasterMonitoredScopes>(() => {
    const raw = reminderRaw.targetScopes || {};
    return {
      whatsappPackages: raw.whatsappPackages !== undefined ? raw.whatsappPackages === true : true,
      emailPackages: raw.emailPackages !== undefined ? raw.emailPackages === true : true,
      smsPackages: raw.smsPackages !== undefined ? raw.smsPackages === true : true,
      cvPackages: raw.cvPackages !== undefined ? raw.cvPackages === true : true,
      jobPackages: raw.jobPackages !== undefined ? raw.jobPackages === true : (raw.jobSlots !== false),
      urgentFeaturedJobs: raw.urgentFeaturedJobs !== undefined ? raw.urgentFeaturedJobs === true : true,
      adCampaignsPlcSic: raw.adCampaignsPlcSic !== undefined ? raw.adCampaignsPlcSic === true : (raw.campaigns !== false),
      earlyAccessPass: raw.earlyAccessPass !== undefined ? raw.earlyAccessPass === true : (raw.earlyAccess !== false),
      employerSubscriptions: raw.employerSubscriptions !== undefined ? raw.employerSubscriptions === true : (raw.subscriptions !== false)
    };
  });

  // Collapsible Sections to keep UI clean and to-the-point
  const [isTemplateOpen, setIsTemplateOpen] = useState<boolean>(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState<boolean>(false);

  // Template State
  const [templateSubject, setTemplateSubject] = useState<string>(
    reminderRaw.templateSubject || DEFAULT_TEMPLATE_SUBJECT
  );
  const [templateBody, setTemplateBody] = useState<string>(
    reminderRaw.templateBody || DEFAULT_TEMPLATE_BODY
  );

  // Save, Simulation & Live Test State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isDispatchingLive, setIsDispatchingLive] = useState<boolean>(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Sync state if external pricing updates
  useEffect(() => {
    if (!pricing?.subscriptionReminderSettings) return;
    const s = pricing.subscriptionReminderSettings;
    setEngineEnabled(s.enabled !== false);
    if (s.automationProfile) setAutomationProfile(s.automationProfile);
    if (Array.isArray(s.percentTriggers) && s.percentTriggers.length > 0) {
      setPercentTriggers(s.percentTriggers.map((n: any) => Math.min(100, Math.max(1, Number(n) || 1))).sort((a: number, b: number) => a - b));
    }
    if (s.inAppDaysBefore) setInAppDaysBefore(Number(s.inAppDaysBefore));
    if (s.whatsappDaysBefore) setWhatsappDaysBefore(Number(s.whatsappDaysBefore));
    if (s.emailDaysBefore) setEmailDaysBefore(Number(s.emailDaysBefore));
    if (s.smsDaysBefore) setSmsDaysBefore(Number(s.smsDaysBefore));
    if (s.inAppEnabled !== undefined) setInAppEnabled(s.inAppEnabled);
    if (s.whatsappEnabled !== undefined) setWhatsappEnabled(s.whatsappEnabled);
    if (s.emailEnabled !== undefined) setEmailEnabled(s.emailEnabled);
    if (s.smsEnabled !== undefined) setSmsEnabled(s.smsEnabled);

    if (s.targetScopes) {
      const raw = s.targetScopes;
      setScopes({
        whatsappPackages: raw.whatsappPackages !== undefined ? raw.whatsappPackages === true : true,
        emailPackages: raw.emailPackages !== undefined ? raw.emailPackages === true : true,
        smsPackages: raw.smsPackages !== undefined ? raw.smsPackages === true : true,
        cvPackages: raw.cvPackages !== undefined ? raw.cvPackages === true : true,
        jobPackages: raw.jobPackages !== undefined ? raw.jobPackages === true : (raw.jobSlots !== false),
        urgentFeaturedJobs: raw.urgentFeaturedJobs !== undefined ? raw.urgentFeaturedJobs === true : true,
        adCampaignsPlcSic: raw.adCampaignsPlcSic !== undefined ? raw.adCampaignsPlcSic === true : (raw.campaigns !== false),
        earlyAccessPass: raw.earlyAccessPass !== undefined ? raw.earlyAccessPass === true : (raw.earlyAccess !== false),
        employerSubscriptions: raw.employerSubscriptions !== undefined ? raw.employerSubscriptions === true : (raw.subscriptions !== false)
      });
    }
    if (s.templateSubject) setTemplateSubject(s.templateSubject);
    if (s.templateBody) setTemplateBody(s.templateBody);
  }, [pricing]);

  // Apply Automation Profile
  const handleApplyProfile = (profile: AutomationProfile) => {
    setAutomationProfile(profile);
    if (profile === 'auto-pilot') {
      setPercentTriggers([20, 30, 50, 80, 100]);
      setRepeatMode('percent-10');
      setInAppEnabled(true);
      setEmailEnabled(true);
      setWhatsappEnabled(true);
      setSmsEnabled(false);
      setInAppDaysBefore(3);
      setWhatsappDaysBefore(3);
      setEmailDaysBefore(3);
      setSmsDaysBefore(1);
      setScopes(DEFAULT_SCOPES);
    } else if (profile === 'high-urgency') {
      setPercentTriggers([20, 40, 60, 80, 95, 100]);
      setRepeatMode('percent-5');
      setInAppEnabled(true);
      setEmailEnabled(true);
      setWhatsappEnabled(true);
      setSmsEnabled(true);
      setInAppDaysBefore(5);
      setWhatsappDaysBefore(5);
      setEmailDaysBefore(5);
      setSmsDaysBefore(2);
      setScopes(DEFAULT_SCOPES);
    } else if (profile === 'balanced') {
      setPercentTriggers([50, 80, 100]);
      setRepeatMode('none');
      setInAppEnabled(true);
      setEmailEnabled(true);
      setWhatsappEnabled(false);
      setSmsEnabled(false);
      setInAppDaysBefore(3);
      setEmailDaysBefore(3);
      setScopes(DEFAULT_SCOPES);
    }
  };

  // Toggle single milestone
  const toggleMilestone = (val: number) => {
    setAutomationProfile('custom');
    setPercentTriggers((prev) => {
      if (prev.includes(val)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((p) => p !== val).sort((a, b) => a - b);
      }
      return [...prev, val].sort((a, b) => a - b);
    });
  };

  // Add custom milestone
  const handleAddCustomPercent = () => {
    const parsed = parseInt(customPercentInput.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      if (!percentTriggers.includes(parsed)) {
        setAutomationProfile('custom');
        setPercentTriggers((prev) => [...prev, parsed].sort((a, b) => a - b));
      }
      setCustomPercentInput('');
      setShowCustomInput(false);
    }
  };

  // Toggle monitored scope
  const toggleScope = (key: keyof MasterMonitoredScopes) => {
    setScopes((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const selectAllScopes = () => setScopes(DEFAULT_SCOPES);
  const clearAllScopes = () => {
    setScopes({
      whatsappPackages: false,
      emailPackages: false,
      smsPackages: false,
      cvPackages: false,
      jobPackages: false,
      urgentFeaturedJobs: false,
      adCampaignsPlcSic: false,
      earlyAccessPass: false,
      employerSubscriptions: false
    });
  };

  const activeScopesCount = useMemo(() => {
    return Object.values(scopes).filter(Boolean).length;
  }, [scopes]);

  // Insert token into message
  const insertToken = (token: string) => {
    setTemplateBody((prev) => prev + ` {{${token}}}`);
  };

  // Simulation Counts
  const simulationMetrics = useMemo(() => {
    const totalCommercialEntities = users.length + ads.length + jobs.length;
    let nearExpiry = 0;
    let atMilestone = 0;
    const now = Date.now();

    users.forEach((u) => {
      if (u.plan === 'Premium' || u.membershipStatus === 'Active') {
        if (u.expiryDate) {
          const expMs = new Date(u.expiryDate.replace(' ', 'T')).getTime();
          const actMs = u.activationDate ? new Date(u.activationDate.replace(' ', 'T')).getTime() : (expMs - 30 * 86400000);
          const totalDuration = Math.max(1, expMs - actMs);
          const elapsed = Math.max(0, now - actMs);
          const pct = Math.min(100, Math.floor((elapsed / totalDuration) * 100));
          if (pct >= 50) atMilestone++;
          const daysLeft = (expMs - now) / 86400000;
          if (daysLeft > 0 && daysLeft <= 3) nearExpiry++;
        }
      }
    });

    return {
      totalCommercialEntities,
      atMilestone,
      nearExpiry
    };
  }, [users, ads, jobs]);

  // Live Test Dispatch
  const handleTestDispatchNow = async () => {
    if (!canManagePricing) return;
    setIsDispatchingLive(true);
    setDispatchNotice(null);
    setDispatchError(null);
    try {
      const res = await api.pricing.dispatchReminder({
        scope: 'all-scheduled',
        channels: {
          inApp: inAppEnabled,
          whatsapp: whatsappEnabled,
          email: emailEnabled,
          sms: smsEnabled
        }
      });
      if (res?.success) {
        setDispatchNotice(res.message || 'Master Rule Engine evaluated and live test reminder tick dispatched.');
      } else {
        setDispatchError(res?.message || 'Server returned an error executing rule test dispatch.');
      }
    } catch (err: any) {
      setDispatchError(err?.message || 'Network error triggering live test dispatch.');
    } finally {
      setIsDispatchingLive(false);
    }
  };

  // Save Settings
  const handleSaveEngine = async () => {
    if (!canManagePricing) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const anyChannelActive = inAppEnabled || whatsappEnabled || emailEnabled || smsEnabled;
      const computedRepeatMode = repeatMode === 'none' ? 'none' : repeatMode.startsWith('days') ? 'days' : 'percent';
      const computedRepeatPercent = repeatMode === 'percent-10' ? 10 : 5;
      const computedRepeatDays = repeatMode === 'days-3' ? 3 : 2;

      const payload = {
        subscriptionReminderSettings: {
          ...reminderRaw,
          enabled: engineEnabled && anyChannelActive,
          automationProfile,
          daysBefore: inAppDaysBefore,
          inAppEnabled,
          inAppDaysBefore,
          whatsappEnabled,
          whatsappDaysBefore,
          emailEnabled,
          emailDaysBefore,
          smsEnabled,
          smsDaysBefore,
          percentTriggers,
          repeatMode: computedRepeatMode,
          repeatIntervalPercent: computedRepeatPercent,
          repeatDaysInterval: computedRepeatDays,
          targetScopes: {
            whatsappPackages: scopes.whatsappPackages,
            emailPackages: scopes.emailPackages,
            smsPackages: scopes.smsPackages,
            cvPackages: scopes.cvPackages,
            jobPackages: scopes.jobPackages,
            urgentFeaturedJobs: scopes.urgentFeaturedJobs,
            adCampaignsPlcSic: scopes.adCampaignsPlcSic,
            earlyAccessPass: scopes.earlyAccessPass,
            employerSubscriptions: scopes.employerSubscriptions,
            // Maintain backward-compatible aliases:
            subscriptions: scopes.employerSubscriptions,
            campaigns: scopes.adCampaignsPlcSic,
            jobSlots: scopes.jobPackages,
            earlyAccess: scopes.earlyAccessPass
          },
          templateSubject,
          templateBody
        }
      };

      const result = await api.pricing.update(payload);
      if (result?.success) {
        setSaveSuccess(true);
        onUpdatePricing?.(result.pricing);
        setTimeout(() => setSaveSuccess(false), 4500);
      } else {
        setSaveError(result?.message || 'Failed to save Master Rule Engine configuration.');
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Network error saving Master Rule Engine configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3.5 text-white">
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-3.5 sm:p-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Central Automated Engine</span>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  engineEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {engineEnabled ? '● Engine Active' : '○ Engine Paused'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {activeScopesCount}/9 Scopes Monitored
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black text-white">
              Master Expiry &amp; Usage Rule Engine (مرکزی خودکار رول انجن)
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              ایک ہی جگہ سے واٹس ایپ، ای میل، ایس ایم ایس، سی وی پیکجز، جاب کوٹہ، ارجنٹ جابز، پی ایل سی اور ایس آئی سی کمپینز کے لیے پرسنٹیج اور ایکسپائری الرٹس خودکار سیٹ کریں۔
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!canManagePricing}
              onClick={() => setEngineEnabled(!engineEnabled)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                engineEnabled
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-600'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{engineEnabled ? 'Engine ON' : 'Engine OFF'}</span>
            </button>
            <button
              type="button"
              disabled={!canManagePricing || isSaving}
              onClick={handleSaveEngine}
              className="min-h-[36px] px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black border border-amber-400 shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving...' : 'Save Master Rules'}</span>
            </button>
          </div>
        </div>

        {/* Save Notifications */}
        {saveSuccess && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Master Rule Engine configuration authoritatively saved and applied to all packages.</span>
          </div>
        )}
        {saveError && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
      </div>

      {/* STEP 1: ONE-CLICK AUTOMATION PRESETS (ایزی ٹو یوز اٹومیٹک پروفائل) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-black text-white">
              1. Automation Mode (خودکار ورک فلو موڈ)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400">1-Click Auto Configuration</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {/* Profile: Recommended Auto-Pilot */}
          <button
            type="button"
            disabled={!canManagePricing}
            onClick={() => handleApplyProfile('auto-pilot')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              automationProfile === 'auto-pilot'
                ? 'bg-amber-500/15 border-amber-400 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-white text-xs flex items-center gap-1.5">
                  <span>🚀</span> Auto-Pilot (Recommended)
                </span>
                {automationProfile === 'auto-pilot' && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                20%, 30%, 50%, 80%, 100% + Repeat every 10% usage + In-App, WhatsApp &amp; Email.
              </p>
            </div>
            <span className="mt-2 text-[9px] font-bold text-amber-300">خودکار بہترین سیٹنگ</span>
          </button>

          {/* Profile: High Urgency */}
          <button
            type="button"
            disabled={!canManagePricing}
            onClick={() => handleApplyProfile('high-urgency')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              automationProfile === 'high-urgency'
                ? 'bg-rose-500/15 border-rose-400 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-white text-xs flex items-center gap-1.5">
                  <span>⚡</span> High Urgency Alert
                </span>
                {automationProfile === 'high-urgency' && <Check className="w-3.5 h-3.5 text-rose-400 stroke-[3]" />}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                20%, 40%, 60%, 80%, 95%, 100% + Repeat every 5% + All 4 channels with SMS.
              </p>
            </div>
            <span className="mt-2 text-[9px] font-bold text-rose-300">فوری و ہائی الرٹ</span>
          </button>

          {/* Profile: Balanced */}
          <button
            type="button"
            disabled={!canManagePricing}
            onClick={() => handleApplyProfile('balanced')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              automationProfile === 'balanced'
                ? 'bg-sky-500/15 border-sky-400 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-white text-xs flex items-center gap-1.5">
                  <span>🛡️</span> Standard Balanced
                </span>
                {automationProfile === 'balanced' && <Check className="w-3.5 h-3.5 text-sky-400 stroke-[3]" />}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                50%, 80%, 100% milestones + No repeat + In-App and Email only.
              </p>
            </div>
            <span className="mt-2 text-[9px] font-bold text-sky-300">معتدل الرٹس</span>
          </button>

          {/* Profile: Custom */}
          <button
            type="button"
            disabled={!canManagePricing}
            onClick={() => setAutomationProfile('custom')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              automationProfile === 'custom'
                ? 'bg-purple-500/15 border-purple-400 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-white text-xs flex items-center gap-1.5">
                  <span>⚙️</span> Custom Tailored
                </span>
                {automationProfile === 'custom' && <Check className="w-3.5 h-3.5 text-purple-400 stroke-[3]" />}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                دستی طور پر مخصوص پرسنٹیج، ریپیٹ انٹرولز، اور چینلز اپنی مرضی سے سیٹ کریں۔
              </p>
            </div>
            <span className="mt-2 text-[9px] font-bold text-purple-300">کسٹم سیٹنگ</span>
          </button>
        </div>
      </div>

      {/* STEP 2: MONITORED COMMERCIAL SCOPES (مانیٹر سکوپ: واٹس ایپ، ای میل، ایس ایم ایس، سی وی، جابز، ارجنٹ جابز، پی ایل سی، ایس آئی سی) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <div>
              <h4 className="text-xs sm:text-sm font-black text-white">
                2. Monitored Scope (لاگو ہونے والے پیکجز و پروڈکٹس)
              </h4>
              <p className="text-[10px] text-slate-400">
                سلیکٹ کریں کہ یہ ماسٹر رولز کن کن ایکٹیو پیکجز اور فیچرز پر لاگو ہوں:
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!canManagePricing}
              onClick={selectAllScopes}
              className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-500/40 cursor-pointer"
            >
              Select All (9 Scopes)
            </button>
            <button
              type="button"
              disabled={!canManagePricing}
              onClick={clearAllScopes}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 text-[10px] font-bold border border-slate-800 cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* 9 Scopes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {/* 1. WhatsApp Packages */}
          <div
            onClick={() => canManagePricing && toggleScope('whatsappPackages')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.whatsappPackages
                ? 'bg-emerald-950/30 border-emerald-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">WhatsApp Packages</span>
                <span className="text-[10px] text-slate-400 block truncate">واٹس ایپ الرٹس و مارکیٹنگ پیکجز</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.whatsappPackages}
              className="accent-emerald-400 shrink-0 pointer-events-none"
            />
          </div>

          {/* 2. Email Packages */}
          <div
            onClick={() => canManagePricing && toggleScope('emailPackages')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.emailPackages
                ? 'bg-sky-950/30 border-sky-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">Email Packages</span>
                <span className="text-[10px] text-slate-400 block truncate">ای میل الرٹس و براڈکاسٹ پیکجز</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.emailPackages}
              className="accent-sky-400 shrink-0 pointer-events-none"
            />
          </div>

          {/* 3. SMS Packages */}
          <div
            onClick={() => canManagePricing && toggleScope('smsPackages')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.smsPackages
                ? 'bg-indigo-950/30 border-indigo-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">SMS Packages</span>
                <span className="text-[10px] text-slate-400 block truncate">ایس ایم ایس الرٹس و کوٹہ پیکجز</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.smsPackages}
              className="accent-indigo-400 shrink-0 pointer-events-none"
            />
          </div>

          {/* 4. CV Packages */}
          <div
            onClick={() => canManagePricing && toggleScope('cvPackages')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.cvPackages
                ? 'bg-amber-950/30 border-amber-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">CV Search &amp; Downloads</span>
                <span className="text-[10px] text-slate-400 block truncate">سی وی سرچ و ریزیومے ڈاؤنلوڈ پیکجز</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.cvPackages}
              className="accent-amber-400 shrink-0 pointer-events-none"
            />
          </div>

          {/* 5. Job Posting Packages */}
          <div
            onClick={() => canManagePricing && toggleScope('jobPackages')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.jobPackages
                ? 'bg-teal-950/30 border-teal-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase className="w-4 h-4 text-teal-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">Job Posting Packages</span>
                <span className="text-[10px] text-slate-400 block truncate">جاب پوسٹنگ کوٹہ و سٹینڈرڈ پیکجز</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.jobPackages}
              className="accent-teal-400 shrink-0 pointer-events-none"
            />
          </div>

          {/* 6. Urgent & Featured Jobs */}
          <div
            onClick={() => canManagePricing && toggleScope('urgentFeaturedJobs')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.urgentFeaturedJobs
                ? 'bg-rose-950/30 border-rose-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">Urgent &amp; Featured Jobs</span>
                <span className="text-[10px] text-slate-400 block truncate">ارجنٹ اور فیچرڈ جاب ٹیگز</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.urgentFeaturedJobs}
              className="accent-rose-400 shrink-0 pointer-events-none"
            />
          </div>

          {/* 7. PLC & SIC Ad Campaigns */}
          <div
            onClick={() => canManagePricing && toggleScope('adCampaignsPlcSic')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.adCampaignsPlcSic
                ? 'bg-orange-950/30 border-orange-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Megaphone className="w-4 h-4 text-orange-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">PLC &amp; SIC Ad Campaigns</span>
                <span className="text-[10px] text-slate-400 block truncate">پی ایل سی اور ایس آئی سی ایڈ کمپینز</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.adCampaignsPlcSic}
              className="accent-orange-400 shrink-0 pointer-events-none"
            />
          </div>

          {/* 8. Early Access Pass */}
          <div
            onClick={() => canManagePricing && toggleScope('earlyAccessPass')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.earlyAccessPass
                ? 'bg-yellow-950/30 border-yellow-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">Early Access Job Pass</span>
                <span className="text-[10px] text-slate-400 block truncate">ارلی ایکسس جاب پاس (24 گھنٹے قبل)</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.earlyAccessPass}
              className="accent-yellow-400 shrink-0 pointer-events-none"
            />
          </div>

          {/* 9. Employer Subscriptions */}
          <div
            onClick={() => canManagePricing && toggleScope('employerSubscriptions')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              scopes.employerSubscriptions
                ? 'bg-violet-950/30 border-violet-500/50 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">Employer Subscriptions</span>
                <span className="text-[10px] text-slate-400 block truncate">مین ایمپلائر رکنیت و سبسکرپشنز</span>
              </div>
            </div>
            <input
              type="checkbox"
              readOnly
              checked={scopes.employerSubscriptions}
              className="accent-violet-400 shrink-0 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* STEP 3: USAGE MILESTONE TRIGGERS & REPEAT CADENCE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-black text-white">
              3. Usage Percentage Triggers &amp; Repeat Follow-Up (یوزیج پرسنٹیج اور ریپیٹ)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {percentTriggers.join('% • ')}% Active
          </span>
        </div>

        {/* Milestone Buttons Bar */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300">
            Active Warning Milestones (کلک کر کے پرسنٹیج آن / آف کریں):
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[20, 25, 30, 40, 50, 60, 75, 80, 90, 100].map((preset) => {
              const isActive = percentTriggers.includes(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={!canManagePricing}
                  onClick={() => toggleMilestone(preset)}
                  className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  <span>{preset}%</span>
                </button>
              );
            })}

            {/* Custom % Button */}
            {!showCustomInput ? (
              <button
                type="button"
                disabled={!canManagePricing}
                onClick={() => setShowCustomInput(true)}
                className="min-h-[32px] px-2.5 py-1 rounded-xl bg-slate-950 border border-dashed border-slate-700 hover:border-slate-500 text-slate-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Custom %</span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="%"
                  value={customPercentInput}
                  onChange={(e) => setCustomPercentInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomPercent()}
                  className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-amber-500 text-xs font-mono text-center text-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustomPercent}
                  className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="px-2 py-1 text-slate-400 text-xs hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="relative w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 opacity-30 w-full" />
            {percentTriggers.map((pct) => (
              <div
                key={pct}
                style={{ left: `${Math.min(98, Math.max(2, pct))}%` }}
                className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-sm"
                title={`Notification trigger at ${pct}%`}
              />
            ))}
          </div>
        </div>

        {/* Repeat Follow-Up Cadence */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <label className="text-[11px] font-bold text-slate-300">
            Repeat Cadence (فالو اپ نوٹیفیکیشن کتنے وقفے بعد دوبارہ بھیجی جائے):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
            {[
              { id: 'none', label: 'No Repeat (Once)', desc: 'صرف مائل سٹون پر' },
              { id: 'percent-5', label: 'Every 5% Usage', desc: 'ہر 5 فیصد پر' },
              { id: 'percent-10', label: 'Every 10% Usage', desc: 'ہر 10 فیصد پر' },
              { id: 'days-2', label: 'Every 2 Days', desc: 'ہر 2 دن بعد' },
              { id: 'days-3', label: 'Every 3 Days', desc: 'ہر 3 دن بعد' }
            ].map((item) => {
              const isSelected = repeatMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!canManagePricing}
                  onClick={() => {
                    setAutomationProfile('custom');
                    setRepeatMode(item.id as any);
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-500/20 border-indigo-400 text-white font-bold shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-[11px] font-bold block">{item.label}</span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* STEP 4: MULTI-CHANNEL SELECTION (صرف سلیکٹ کرنے پر اس کے آپشنز نظر آئیں گے) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-400" />
            <div>
              <h4 className="text-xs sm:text-sm font-black text-white">
                4. Multi-Channel Dispatch &amp; Pre-Expiry Lead Time (ملٹی چینل نوٹیفیکیشنز)
              </h4>
              <p className="text-[10px] text-slate-400">
                چینل سلیکٹ کرنے پر اس کے متعلقہ دن اور اختیارات سامنے آئیں گے:
              </p>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {[inAppEnabled && 'In-App', whatsappEnabled && 'WhatsApp', emailEnabled && 'Email', smsEnabled && 'SMS'].filter(Boolean).join(' • ') || 'None Selected'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Channel 1: In-App Alerts */}
          <div
            className={`rounded-2xl border transition-all p-3 space-y-2.5 ${
              inAppEnabled
                ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                : 'bg-slate-950/50 border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className={`w-4 h-4 ${inAppEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
                <div>
                  <span className="text-xs font-bold text-white block">In-App Dashboard Alerts</span>
                  <span className="text-[10px] text-slate-400 block">پورٹل گھنٹی نوٹیفیکیشن</span>
                </div>
              </div>
              <button
                type="button"
                disabled={!canManagePricing}
                onClick={() => setInAppEnabled(!inAppEnabled)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  inAppEnabled
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                {inAppEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* ONLY SHOWN WHEN IN-APP IS SELECTED */}
            {inAppEnabled && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 animate-fadeIn text-xs">
                <span className="text-[11px] text-slate-300 font-medium">Pre-expiry notice lead time:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 5, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={!canManagePricing}
                      onClick={() => setInAppDaysBefore(days)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        inAppDaysBefore === days
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500 ml-0.5">before</span>
                </div>
              </div>
            )}
          </div>

          {/* Channel 2: WhatsApp Alerts */}
          <div
            className={`rounded-2xl border transition-all p-3 space-y-2.5 ${
              whatsappEnabled
                ? 'bg-slate-950 border-emerald-500/40 shadow-sm'
                : 'bg-slate-950/50 border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <MessageCircle className={`w-4 h-4 ${whatsappEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div>
                  <span className="text-xs font-bold text-white block">WhatsApp Automated Message</span>
                  <span className="text-[10px] text-slate-400 block">واٹس ایپ کلاؤڈ یا ٹویلیو الرٹس</span>
                </div>
              </div>
              <button
                type="button"
                disabled={!canManagePricing}
                onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  whatsappEnabled
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                {whatsappEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* ONLY SHOWN WHEN WHATSAPP IS SELECTED */}
            {whatsappEnabled && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 animate-fadeIn text-xs">
                <span className="text-[11px] text-slate-300 font-medium">Pre-expiry notice lead time:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 5, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={!canManagePricing}
                      onClick={() => setWhatsappDaysBefore(days)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        whatsappDaysBefore === days
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500 ml-0.5">before</span>
                </div>
              </div>
            )}
          </div>

          {/* Channel 3: Email Notifications */}
          <div
            className={`rounded-2xl border transition-all p-3 space-y-2.5 ${
              emailEnabled
                ? 'bg-slate-950 border-sky-500/40 shadow-sm'
                : 'bg-slate-950/50 border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className={`w-4 h-4 ${emailEnabled ? 'text-sky-400' : 'text-slate-500'}`} />
                <div>
                  <span className="text-xs font-bold text-white block">Email Direct Notifications</span>
                  <span className="text-[10px] text-slate-400 block">ای میل ان باکس الرٹ (SMTP / SendGrid / Resend)</span>
                </div>
              </div>
              <button
                type="button"
                disabled={!canManagePricing}
                onClick={() => setEmailEnabled(!emailEnabled)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  emailEnabled
                    ? 'bg-sky-400 text-slate-950 border-sky-300'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                {emailEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* ONLY SHOWN WHEN EMAIL IS SELECTED */}
            {emailEnabled && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 animate-fadeIn text-xs">
                <span className="text-[11px] text-slate-300 font-medium">Pre-expiry notice lead time:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 5, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={!canManagePricing}
                      onClick={() => setEmailDaysBefore(days)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        emailDaysBefore === days
                          ? 'bg-sky-400 text-slate-950 font-black'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500 ml-0.5">before</span>
                </div>
              </div>
            )}
          </div>

          {/* Channel 4: SMS Alerts */}
          <div
            className={`rounded-2xl border transition-all p-3 space-y-2.5 ${
              smsEnabled
                ? 'bg-slate-950 border-indigo-500/40 shadow-sm'
                : 'bg-slate-950/50 border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Smartphone className={`w-4 h-4 ${smsEnabled ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div>
                  <span className="text-xs font-bold text-white block">Direct SMS Blast</span>
                  <span className="text-[10px] text-slate-400 block">براہِ راست موبائل ایس ایم ایس الرٹ</span>
                </div>
              </div>
              <button
                type="button"
                disabled={!canManagePricing}
                onClick={() => setSmsEnabled(!smsEnabled)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  smsEnabled
                    ? 'bg-indigo-500 text-slate-950 border-indigo-400'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                {smsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* ONLY SHOWN WHEN SMS IS SELECTED */}
            {smsEnabled && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 animate-fadeIn text-xs">
                <span className="text-[11px] text-slate-300 font-medium">Pre-expiry notice lead time:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 5].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={!canManagePricing}
                      onClick={() => setSmsDaysBefore(days)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        smsDaysBefore === days
                          ? 'bg-indigo-500 text-slate-950 font-black'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500 ml-0.5">before</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STEP 5: COLLAPSIBLE TEMPLATE & TOKENS (صرف ضرورت پڑنے پر کھولیں تاکہ پیج بوجھل نہ ہو) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsTemplateOpen(!isTemplateOpen)}
          className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-white">
                5. Notification Message Template (پیغام و ڈائنامک ویری ایبلز)
              </h4>
              <p className="text-[10px] text-slate-400 truncate max-w-lg">
                Preview: {templateSubject}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-amber-400 font-bold hidden sm:inline">
              {isTemplateOpen ? 'Click to Collapse' : 'Click to Customize'}
            </span>
            {isTemplateOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {isTemplateOpen && (
          <div className="p-3.5 sm:p-4 pt-0 border-t border-slate-800/80 space-y-3 animate-fadeIn text-xs">
            {/* Clickable Variable Token Inserters */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Click variable to insert into message template:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { token: 'user_name', label: 'User Name' },
                  { token: 'package_name', label: 'Package Name' },
                  { token: 'usage_percent', label: 'Usage %' },
                  { token: 'days_remaining', label: 'Days Remaining' },
                  { token: 'expiry_date', label: 'Expiry Date' },
                  { token: 'remaining_quota', label: 'Available Quota' },
                  { token: 'portal_name', label: 'Portal Name' }
                ].map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    disabled={!canManagePricing}
                    onClick={() => insertToken(item.token)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 font-mono text-[11px] font-bold cursor-pointer transition-all"
                  >
                    + {`{{${item.token}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Notification Subject / Title:
              </label>
              <input
                type="text"
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-300">
                  Notification Body Message:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateSubject(DEFAULT_TEMPLATE_SUBJECT);
                    setTemplateBody(DEFAULT_TEMPLATE_BODY);
                  }}
                  className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer font-bold"
                >
                  Reset to Default Template
                </button>
              </div>
              <textarea
                rows={4}
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>

      {/* STEP 6: BOTTOM ACTION BAR & SIMULATION AUDIT */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                Live Simulation: {simulationMetrics.totalCommercialEntities} Commercial Accounts Active
              </span>
              <span className="text-[10px] text-slate-400 block">
                {simulationMetrics.atMilestone} at &gt;=50% utilization • {simulationMetrics.nearExpiry} near final expiry (&lt;=3 days)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canManagePricing || isDispatchingLive}
              onClick={handleTestDispatchNow}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isDispatchingLive ? 'animate-spin' : ''}`} />
              <span>{isDispatchingLive ? 'Evaluating...' : 'Run Test Dispatch Now'}</span>
            </button>
            <button
              type="button"
              disabled={!canManagePricing || isSaving}
              onClick={handleSaveEngine}
              className="min-h-[38px] px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black border border-emerald-400 shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving Master Rules...' : 'Save & Apply All Rules'}</span>
            </button>
          </div>
        </div>

        {dispatchNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{dispatchNotice}</span>
          </div>
        )}
        {dispatchError && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{dispatchError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
