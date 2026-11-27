import React, { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { 
  LayoutDashboard, 
  Search, 
  Building2, 
  Megaphone, 
  User, 
  ChevronRight, 
  ChevronDown, 
  X,
  FileText,
  Sparkles,
  History,
  Bookmark,
  Plus,
  Wallet,
  Crown,
  ShieldCheck,
  Bell,
  Lock,
  MessageSquare,
  Zap,
} from 'lucide-react';

type DashboardTab = 'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat' | 'campaigns';
type OverviewSubView = 'metrics' | 'recommendations' | 'history';
type AppSubTab = 'submitted' | 'saved' | 'alerts' | 'documents';
type CampaignSubTab = 'my-campaigns' | 'create' | 'wallet';
type GlobalTab = 'jobs' | 'cv' | 'alerts' | 'dashboard';
const QUICK_ACTION_ICONS: Record<string, LucideIcon> = { LayoutDashboard, Search, Building2, Megaphone, User, FileText, Sparkles, History, Bookmark, Plus, Wallet, Crown, ShieldCheck, Bell, Lock, MessageSquare, Zap };

interface NavSubItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  tab?: DashboardTab;
  subView?: OverviewSubView;
  subTab?: AppSubTab | CampaignSubTab;
  accountSubTab?: 'profile' | 'security';
  isGlobal?: boolean;
  globalTab?: GlobalTab;
  isLogout?: boolean;
  action?: 'notifications' | 'deposit' | 'subscription';
  employerOnly?: boolean;
  countKey?: keyof UserDashboardNavigationCounts;
}

interface UserDashboardNavigationCounts {
  applications: number;
  recommendedJobs: number;
  savedJobs: number;
  jobAlerts: number;
  documents: number;
  jobListings: number;
  campaigns: number;
  paymentTransactions: number;
  unreadNotifications: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  subItems: NavSubItem[];
}

interface UserDashboardNavigationProps {
  activeTab: DashboardTab;
  overviewSubView: OverviewSubView;
  appSubTab: AppSubTab;
  campaignSubTab: CampaignSubTab;
  accountSubTab: 'profile' | 'security';
  activeNavId: string | null;
  onNavigate: (params: {
    id: string;
    tab?: DashboardTab;
    subView?: OverviewSubView;
    subTab?: AppSubTab | CampaignSubTab;
    accountSubTab?: 'profile' | 'security';
    isGlobal?: boolean;
    globalTab?: GlobalTab;
    isLogout?: boolean;
  }) => void;
  onLogout: () => void;
  userRole: string;
  counts: UserDashboardNavigationCounts;
  onOpenNotifications: () => void;
  onOpenDeposit: () => void;
  onOpenSubscription: () => void;
  isOpen: boolean;
  onClose: () => void;
  variant?: 'professional' | 'new' | 'classic-new';
  quickActions?: Array<{ id: string; label: string; icon: string; destination: string; enabled: boolean; mobile: boolean; desktop: boolean }>;
  userIdentity?: string;
}

export const UserDashboardNavigation: React.FC<UserDashboardNavigationProps> = ({
  activeTab,
  overviewSubView,
  appSubTab,
  campaignSubTab,
  accountSubTab,
  activeNavId,
  onNavigate,
  onLogout,
  userRole,
  counts,
  onOpenNotifications,
  onOpenDeposit,
  onOpenSubscription,
  isOpen,
  onClose,
  variant = 'professional',
  quickActions = [],
  userIdentity = ''
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('dashboard');
  const drawerContentRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Prevent background scrolling while the mobile drawer is open.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  // Keep focus inside the mobile drawer, close it with Escape, and restore
  // focus to the control that opened it. The closed drawer is inert so keyboard
  // users cannot tab into hidden navigation controls.
  useEffect(() => {
    const drawer = drawerContentRef.current;
    if (drawer) drawer.inert = !isOpen;

    if (!isOpen) {
      previousFocusRef.current?.focus();
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => drawerContentRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    window.requestAnimationFrame(focusFirst);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(drawerContentRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || [])
        .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        drawerContentRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawerContentRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawerContentRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const menuStructure: NavItem[] = ([
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, subItems: [
      { id: 'dash-overview', label: 'Dashboard Overview', description: 'Your activity and membership snapshot', tab: 'overview', subView: 'metrics', icon: LayoutDashboard },
      { id: 'jobs-recommended', label: 'Recommended Jobs', description: 'Explore roles matched to your skills and activity', tab: 'overview', subView: 'recommendations', icon: Sparkles, countKey: 'recommendedJobs' },

    ]},
    { id: 'jobs', label: 'Find Jobs', icon: Search, subItems: [
      { id: 'jobs-explore', label: 'Explore All Jobs', description: 'Browse openings and apply', isGlobal: true, globalTab: 'jobs', icon: Search },
      { id: 'jobs-applications', label: 'My Applications', description: 'Track submitted applications and status', tab: 'applications', subTab: 'submitted', icon: FileText, countKey: 'applications' },
      { id: 'jobs-saved', label: 'Saved Jobs', description: 'Your bookmarked opportunities', tab: 'applications', subTab: 'saved', icon: Bookmark, countKey: 'savedJobs' },
      { id: 'jobs-alerts', label: 'Job Alerts', description: 'Create and manage matching alerts', tab: 'applications', subTab: 'alerts', icon: Bell, countKey: 'jobAlerts' },
    ]},
    { id: 'career-center', label: 'Career & CV', icon: FileText, subItems: [
      { id: 'career-cv', label: 'CV Builder', description: 'Create or update your professional CV', isGlobal: true, globalTab: 'cv', icon: Zap },
      { id: 'career-docs', label: 'My Documents', description: 'Resumes, cover letters and certificates', tab: 'applications', subTab: 'documents', icon: FileText, countKey: 'documents' },
    ]},
    { id: 'employer-center', label: 'Employer Center', icon: Building2, subItems: [
      { id: 'emp-post', label: 'Post a Job', description: 'Create and submit a new job opening', tab: 'post-job', icon: Plus },
      { id: 'emp-listings', label: 'My Job Listings & Applicants', description: 'Track listing status, review applicants and manage submissions', tab: 'my-jobs', icon: Building2, countKey: 'jobListings' },
      { id: 'emp-verification', label: 'Business Verification', description: 'Submit and track company verification', tab: 'profile', accountSubTab: 'profile', icon: ShieldCheck, employerOnly: true },
    ]},
    { id: 'ads-campaigns', label: 'Ads & Campaigns', icon: Megaphone, subItems: [
      { id: 'ads-list', label: 'My Campaigns', description: 'Review campaign status and performance', tab: 'campaigns', subTab: 'my-campaigns', icon: Megaphone, countKey: 'campaigns' },
      { id: 'ads-create', label: 'Create Campaign', description: 'Build and submit a new campaign', tab: 'campaigns', subTab: 'create', icon: Plus },
    ]},
    { id: 'membership-payments', label: 'Wallet & Payments', icon: Wallet, subItems: [
      { id: 'mem-wallet', label: 'Wallet & Balance', description: 'Available balance and held funds', tab: 'campaigns', subTab: 'wallet', icon: Wallet },
      { id: 'membership-plan', label: 'Membership & Plans', description: 'Compare available plans, benefits and renewal options', action: 'subscription', icon: Crown },
      { id: 'wallet-deposit', label: 'Add Funds / Deposit', description: 'Choose a payment method and submit your deposit proof', action: 'deposit', icon: Plus },
      { id: 'mem-history', label: 'Payment History', description: 'Review billing records, amounts, methods, status and receipts', tab: 'overview', subView: 'history', icon: History, countKey: 'paymentTransactions' },
    ]},
    { id: 'communication', label: 'Alerts & Communication', icon: Bell, subItems: [
      { id: 'mem-whatsapp', label: 'WhatsApp & Job Alerts', description: 'Manage available alert channels and job notification preferences', isGlobal: true, globalTab: 'alerts', icon: Zap },
      { id: 'notifications-center', label: 'Notifications Center', description: 'View updates and unread notifications', action: 'notifications', icon: Bell, countKey: 'unreadNotifications' },
    ]},
    { id: 'help-support', label: 'Help & Support', icon: MessageSquare, subItems: [
      { id: 'acc-chat', label: 'Support Inbox', description: 'Contact support and follow replies', tab: 'chat', icon: MessageSquare },
    ]},
    { id: 'account-support', label: 'My Account', icon: User, subItems: [
      { id: 'acc-profile', label: 'Profile & Preferences', description: 'Update your personal and contact details', tab: 'profile', accountSubTab: 'profile', icon: User },
      { id: 'acc-security', label: 'Security & Password', description: 'Change your account password securely', tab: 'profile', accountSubTab: 'security', icon: Lock },
    ]},
  ] as NavItem[]).map((category) => ({
    ...category,
    subItems: category.subItems.filter((item) => !item.employerOnly || userRole === 'Employer/Job Poster')
  }));
  
  // Keep the active destination visible when returning to the dashboard or
  // switching between legacy and professional navigation modes.
  useEffect(() => {
    if (!activeNavId) return;
    const legacyNavIdMap: Record<string, string> = {
      'dash-recs': 'jobs-recommended',
      'dash-history': 'mem-history',
      'find-explore': 'jobs-explore',
      'career-apps': 'jobs-applications',
      'career-saved': 'jobs-saved',
      'career-alerts': 'jobs-alerts',
      'mem-status': 'dash-overview',
      'mem-plans': 'dash-overview',
      'ads-wallet': 'mem-wallet',
    };
    const effectiveActiveNavId = legacyNavIdMap[activeNavId] || activeNavId;
    const activeCategory = menuStructure.find((category) =>
      category.subItems.some((item) => item.id === effectiveActiveNavId)
    );
    if (activeCategory) setExpandedCategory(activeCategory.id);
  }, [activeNavId]);

  // Open the correct section when the dashboard is entered from a deep link,
  // a global page, or the Classic menu (where no Professional item is selected).
  useEffect(() => {
    if (activeNavId) return;
    const categoryByTab: Record<DashboardTab, string> = {
      overview: overviewSubView === 'history' ? 'membership-payments' : 'dashboard',
      profile: 'account-support',
      applications: appSubTab === 'documents' ? 'career-center' : 'jobs',
      'post-job': 'employer-center',
      'my-jobs': 'employer-center',
      chat: 'help-support',
      campaigns: campaignSubTab === 'wallet' ? 'membership-payments' : 'ads-campaigns'
    };
    setExpandedCategory(categoryByTab[activeTab]);
  }, [activeNavId, activeTab, overviewSubView, appSubTab, campaignSubTab]);

  const handleCategoryClick = (id: string) => {
    setExpandedCategory(expandedCategory === id ? null : id);
  };

  const isActive = (item: NavSubItem) => {
    if (item.isLogout) return false;
    
    // Translate IDs saved by the previous Professional Menu before checking active state.
    const legacyNavIdMap: Record<string, string> = {
      'dash-recs': 'jobs-recommended',
      'dash-history': 'mem-history',
      'find-explore': 'jobs-explore',
      'career-apps': 'jobs-applications',
      'career-saved': 'jobs-saved',
      'career-alerts': 'jobs-alerts',
      'mem-status': 'dash-overview',
      'mem-plans': 'dash-overview',
      'ads-wallet': 'mem-wallet',
    };
    const effectiveActiveNavId = activeNavId ? (legacyNavIdMap[activeNavId] || activeNavId) : null;
    const activeMenuItem = effectiveActiveNavId
      ? menuStructure.flatMap((category) => category.subItems).find((subItem) => subItem.id === effectiveActiveNavId)
      : undefined;
    // Global destinations unmount the dashboard; when the user returns, highlight the actual dashboard tab instead of a stale global link.
    if (activeMenuItem && !activeMenuItem.isGlobal) {
      return effectiveActiveNavId === item.id;
    }

    // Fallback: Check if the current dashboard state matches this item.
    // This handles the initial state when switching from Classic to Pro.
    if (activeTab !== item.tab) return false;
    if (item.subView && overviewSubView !== item.subView) return false;
    if (item.accountSubTab && accountSubTab !== item.accountSubTab) return false;
    if (item.subTab) {
        if (activeTab === 'applications' && appSubTab !== item.subTab) return false;
        if (activeTab === 'campaigns' && campaignSubTab !== item.subTab) return false;
    }
    
    return true;
  };

  // Classic New keeps the complete New Menu structure and navigation actions.
  // Responsive category grid guarantees 4, 5, or 6 visible icon tabs per row.
  // but presents its main categories as Classic-style icon tabs across the top.
  if (variant === 'classic-new') {
    const expandedMenu = menuStructure.find((category) => category.id === expandedCategory);
    return (
      <div className="relative z-30 w-full border-b border-slate-800 bg-slate-950/95 shadow-lg shadow-slate-950/30 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-1.5"><span className="text-[11px] font-black tracking-wider text-white">MENU</span><span className="max-w-[65%] truncate text-[9px] text-slate-500">{userIdentity}</span></div>
        <nav aria-label="Classic New top icon menu" className="mx-auto grid max-w-7xl grid-cols-4 gap-1 px-2 py-2 min-[380px]:grid-cols-5 sm:grid-cols-6 sm:gap-2 sm:px-4">
          {menuStructure.map((category) => {
            const isExpanded = expandedCategory === category.id;
            const categoryHasActiveItem = category.subItems.some(isActive);
            const CategoryIcon = category.icon;
            return (
              <button key={category.id} type="button" onClick={() => handleCategoryClick(category.id)}
                aria-expanded={isExpanded} aria-controls={isExpanded ? 'classic-new-submenu' : undefined}
                className={'relative flex min-w-0 w-full min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg sm:rounded-xl px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ' +
                  (isExpanded || categoryHasActiveItem ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100')}>
                <CategoryIcon aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="w-full break-words text-[9px] font-bold leading-tight min-[380px]:text-[10px] sm:text-[11px]">{category.label}</span>
                {categoryHasActiveItem && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>
        {expandedMenu && (
          <div id="classic-new-submenu" className="mx-auto max-w-7xl px-2 pb-3 sm:px-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 sm:p-3">
              <div className="mb-2 flex items-center gap-2 border-b border-slate-800 px-2 pb-2">
                <expandedMenu.icon aria-hidden="true" className="h-4 w-4 text-emerald-300" />
                <h3 className="text-xs font-extrabold text-white">{expandedMenu.label}</h3>
                <button type="button" onClick={() => setExpandedCategory(null)} className="ml-auto rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-800 hover:text-white">Close</button>
              </div>
              <div className="grid grid-cols-1 gap-1 min-[380px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {expandedMenu.subItems.map((subItem) => {
                  const active = isActive(subItem);
                  return (
                    <button key={subItem.id} type="button" onClick={() => {
                      if (subItem.isLogout) onLogout();
                      else if (subItem.action) {
                        onNavigate({ id: subItem.id });
                        if (subItem.action === 'notifications') onOpenNotifications();
                        if (subItem.action === 'deposit') onOpenDeposit();
                        if (subItem.action === 'subscription') onOpenSubscription();
                      } else {
                        onNavigate({ id: subItem.id, tab: subItem.tab, subView: subItem.subView, subTab: subItem.subTab, accountSubTab: subItem.accountSubTab, isGlobal: subItem.isGlobal, globalTab: subItem.globalTab });
                      }
                      setExpandedCategory(null);
                      onClose();
                    }} aria-current={active ? 'page' : undefined} title={subItem.label}
                    className={'flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' +
                      (active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800')}>
                      {subItem.icon && <subItem.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">{subItem.label}</span>
                        {subItem.description && <span className="mt-0.5 block truncate text-[10px] text-slate-500">{subItem.description}</span>}
                      </span>
                      {subItem.countKey && counts[subItem.countKey] > 0 && <span className="shrink-0 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">{counts[subItem.countKey] > 99 ? '99+' : counts[subItem.countKey]}</span>}
                      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      {/* Admin-configured fixed quick actions. */}
      <nav aria-label="Classic New mobile quick navigation" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/85 pb-[env(safe-area-inset-bottom)]">
        <div className={"mx-auto grid max-w-xl px-1 " + (quickActions.filter(item => item.enabled && item.mobile).length >= 4 ? "grid-cols-5" : "grid-cols-3")}>
          {quickActions.filter(item => item.enabled && item.mobile).slice(0,5).map((item) => {
            const target = menuStructure.flatMap(category => category.subItems).find(subItem => subItem.id === item.id);
            if (!target || (target.employerOnly && userRole !== 'Employer/Job Poster')) return null;
            const active = isActive(target);
            const ActionIcon = QUICK_ACTION_ICONS[item.icon] || target.icon;
            return <button key={item.id} type="button" aria-current={active ? "page" : undefined}
              onClick={() => {
                if (target.action === 'notifications') onOpenNotifications();
                else if (target.action === 'deposit') onOpenDeposit();
                else if (target.action === 'subscription') onOpenSubscription();
                else onNavigate({ id: target.id, tab: target.tab, subView: target.subView, subTab: target.subTab, accountSubTab: target.accountSubTab, isGlobal: target.isGlobal, globalTab: target.globalTab });
                onClose();
              }}
              className={"relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[9px] font-semibold " + (active ? "text-emerald-300 bg-emerald-500/10" : "text-slate-400 hover:text-slate-200")}>
              {active && <span className="absolute top-1 h-0.5 w-4 rounded-full bg-emerald-400" aria-hidden="true" />}
              {ActionIcon && <ActionIcon className="h-4 w-4" aria-hidden="true" />}<span className="max-w-full truncate">{item.label}</span>
            </button>;
          })}
        </div>
      </nav>av>
      </div>
    );
  }

  const NavContent = (
    <div className={`flex flex-col h-full border-r overflow-y-auto w-[min(88vw,21rem)] lg:w-64 ${variant === 'new' ? 'bg-slate-900 border-indigo-500/30' : 'bg-slate-950 border-slate-800'}`}>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between lg:justify-start space-x-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950/40">
            <LayoutDashboard className="w-5 h-5 text-slate-950" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block font-extrabold text-white tracking-tight text-sm">MENU</span>
          <span className="block truncate text-[9px] font-medium tracking-wide text-slate-500">{userIdentity || (userRole === 'Employer/Job Poster' ? 'EMPLOYER WORKSPACE' : 'JOB SEEKER WORKSPACE')}</span>
        </div>
        <button type="button" aria-label="Close navigation" onClick={onClose} className="lg:hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label={variant === 'new' ? 'New dashboard menu' : 'Dashboard sections'} className="flex-1 px-2 py-4 space-y-3">
        {variant === 'new' ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300">New Menu Preview</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Card-based navigation for comparison. Existing pages and actions are reused.</p>
            </div>
            {menuStructure.map((category) => (
              <section key={category.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <category.icon aria-hidden="true" className="h-4 w-4 text-indigo-300" />
                  <h3 className="text-[11px] font-black text-slate-200">{category.label}</h3>
                </div>
                <div className="space-y-1">
                  {category.subItems.map((subItem) => {
                    const active = isActive(subItem);
                    return (
                      <button key={subItem.id} type="button" onClick={() => {
                        if (subItem.isLogout) onLogout();
                        else if (subItem.action) {
                          onNavigate({ id: subItem.id });
                          if (subItem.action === 'notifications') onOpenNotifications();
                          if (subItem.action === 'deposit') onOpenDeposit();
                          if (subItem.action === 'subscription') onOpenSubscription();
                          onClose();
                        } else {
                          onNavigate({ id: subItem.id, tab: subItem.tab, subView: subItem.subView, subTab: subItem.subTab, accountSubTab: subItem.accountSubTab, isGlobal: subItem.isGlobal, globalTab: subItem.globalTab });
                          if (window.innerWidth < 1024) onClose();
                        }
                      }} aria-current={active ? 'page' : undefined} title={subItem.label}
                      className={'flex min-h-10 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ' + (active ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200' : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-white')}>
                        {subItem.icon && <subItem.icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-bold">{subItem.label}</span>
                          {subItem.description && <span className="mt-0.5 block truncate text-[9px] text-slate-500">{subItem.description}</span>}
                        </span>
                        {subItem.countKey && counts[subItem.countKey] > 0 && <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] font-black text-slate-300">{counts[subItem.countKey] > 99 ? '99+' : counts[subItem.countKey]}</span>}
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          menuStructure.map((category) => {
          const isExpanded = expandedCategory === category.id;
          const categoryHasActiveItem = category.subItems.some(isActive);
          return (
            <div key={category.id} className="space-y-1">
              <button
                type="button"
                onClick={() => handleCategoryClick(category.id)}
                aria-expanded={isExpanded}
                className={`w-full flex items-center justify-between px-2.5 py-2 min-h-9 rounded-lg text-[11px] font-bold transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                  isExpanded ? 'bg-slate-900 text-emerald-400' : categoryHasActiveItem ? 'text-slate-200 bg-slate-900/40' : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <category.icon aria-hidden="true" className={`w-4 h-4 ${isExpanded || categoryHasActiveItem ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                  <span>{category.label}</span>
                </div>
                {categoryHasActiveItem && !isExpanded && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />}
                {isExpanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />}
              </button>

              {isExpanded && (
                <div id={`user-nav-${category.id}`} className="ml-3 sm:ml-4 pl-3 sm:pl-4 border-l border-slate-800 space-y-1 py-1">
                  {category.subItems.map((subItem) => {
                    const active = isActive(subItem);
                    return (
                      <button
                        key={subItem.id}
                        type="button"
                        onClick={() => {
                          if (subItem.isLogout) {
                            onLogout();
                          } else if (subItem.action) {
                            // Keep the selected shortcut highlighted while its existing modal/drawer is open.
                            onNavigate({ id: subItem.id });
                            if (subItem.action === 'notifications') onOpenNotifications();
                            if (subItem.action === 'deposit') onOpenDeposit();
                            if (subItem.action === 'subscription') onOpenSubscription();
                            onClose();
                          } else {
                            onNavigate({
                              id: subItem.id,
                              tab: subItem.tab,
                              subView: subItem.subView,
                              subTab: subItem.subTab,
                              accountSubTab: subItem.accountSubTab,
                              isGlobal: subItem.isGlobal,
                              globalTab: subItem.globalTab
                            });
                          }
                          if (window.innerWidth < 1024) onClose();
                        }}
                        aria-current={active ? "page" : undefined}
                        title={subItem.label}
                        className={`w-full flex items-center space-x-2 px-2.5 py-2 min-h-9 rounded-lg text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                          active 
                            ? 'text-emerald-400 bg-emerald-500/10' 
                            : subItem.isLogout
                            ? 'text-rose-400 hover:bg-rose-500/10'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        {subItem.icon && <subItem.icon className={`w-3 h-3 shrink-0 ${subItem.isLogout ? 'text-rose-400' : ''}`} />}
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate">{subItem.label}</span>
                          {subItem.description && <span className={`mt-0.5 block truncate text-[10px] font-normal ${active ? 'text-emerald-200/70' : 'text-slate-500'}`}>{subItem.description}</span>}
                        </span>
                        {subItem.countKey && counts[subItem.countKey] > 0 && (
                          <span className={`shrink-0 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ${active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`} aria-label={`${counts[subItem.countKey]} ${subItem.label.toLowerCase()}`}>
                            {counts[subItem.countKey] > 99 ? '99+' : counts[subItem.countKey]}
                          </span>
                        )}
                        {active && <div className="w-1 h-1 rounded-full bg-emerald-400 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
        )}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button type="button" onClick={onLogout} className="w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors">
          <X className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 z-20">
        {NavContent}
      </aside>

      {/* Mobile Drawer */}
      <div role="dialog" aria-modal="true" aria-label="Dashboard navigation" aria-hidden={!isOpen} className={`lg:hidden fixed inset-0 z-50 transition-all duration-300 ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}>
        <button
          type="button"
          aria-label="Close dashboard navigation"
          tabIndex={isOpen ? 0 : -1}
          className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <div ref={drawerContentRef} tabIndex={-1} className={`absolute left-0 top-0 bottom-0 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {NavContent}
        </div>
      </div>

      {/* Mobile quick navigation: frequent destinations only; full menu remains in the drawer. */}
      <nav aria-label="Mobile quick navigation" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/85 pb-[env(safe-area-inset-bottom)]">
        <div className={"mx-auto grid max-w-xl px-1 " + (quickActions.filter(item => item.enabled && item.mobile).length >= 4 ? "grid-cols-5" : "grid-cols-3")}>
          {quickActions.filter(item => item.enabled && item.mobile).slice(0,5).map((item) => {
            const target = menuStructure.flatMap(category => category.subItems).find(subItem => subItem.id === item.id);
            if (!target || (target.employerOnly && userRole !== 'Employer/Job Poster')) return null;
            const active = isActive(target);
            const ActionIcon = QUICK_ACTION_ICONS[item.icon] || target.icon;
            return (
              <button key={item.id} type="button" aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (target.action === 'notifications') onOpenNotifications();
                  else if (target.action === 'deposit') onOpenDeposit();
                  else if (target.action === 'subscription') onOpenSubscription();
                  else onNavigate({ id: target.id, tab: target.tab, subView: target.subView, subTab: target.subTab, accountSubTab: target.accountSubTab, isGlobal: target.isGlobal, globalTab: target.globalTab });
                  onClose();
                }}
                className={"relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 " + (active ? "text-emerald-300 bg-emerald-500/10" : "text-slate-400 hover:text-slate-200")}>
                {active && <span className="absolute top-1 h-0.5 w-4 rounded-full bg-emerald-400" aria-hidden="true" />}
                {ActionIcon && <ActionIcon className="h-4 w-4" aria-hidden="true" />}
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
