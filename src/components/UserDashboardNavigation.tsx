import React, { useEffect, useState } from 'react';
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

interface NavSubItem {
  id: string;
  label: string;
  icon?: any;
  tab?: DashboardTab;
  subView?: OverviewSubView;
  subTab?: AppSubTab | CampaignSubTab;
  accountSubTab?: 'profile' | 'security';
  isGlobal?: boolean;
  globalTab?: GlobalTab;
  isLogout?: boolean;
  action?: 'notifications' | 'deposit' | 'subscription';
  employerOnly?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
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
  onOpenNotifications: () => void;
  onOpenDeposit: () => void;
  onOpenSubscription: () => void;
  isOpen: boolean;
  onClose: () => void;
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
  onOpenNotifications,
  onOpenDeposit,
  onOpenSubscription,
  isOpen,
  onClose
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('dashboard');

  // Let mobile users dismiss the navigation with the standard Escape key.
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const menuStructure: NavItem[] = ([
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, subItems: [
      { id: 'dash-overview', label: 'Dashboard Overview', tab: 'overview', subView: 'metrics', icon: LayoutDashboard },
      { id: 'membership-plan', label: 'Membership & Plans', tab: 'overview', subView: 'metrics', icon: Crown },
      { id: 'jobs-recommended', label: 'Recommended Jobs', tab: 'overview', subView: 'recommendations', icon: Sparkles },
    ]},
    { id: 'jobs', label: 'Find Jobs', icon: Search, subItems: [
      { id: 'jobs-explore', label: 'Explore All Jobs', isGlobal: true, globalTab: 'jobs', icon: Search },
      { id: 'jobs-applications', label: 'My Applications', tab: 'applications', subTab: 'submitted', icon: FileText },
      { id: 'jobs-saved', label: 'Saved Jobs', tab: 'applications', subTab: 'saved', icon: Bookmark },
      { id: 'jobs-alerts', label: 'Job Alerts', tab: 'applications', subTab: 'alerts', icon: Bell },
    ]},
    { id: 'career-center', label: 'Career & CV', icon: FileText, subItems: [
      { id: 'career-cv', label: 'CV Builder', isGlobal: true, globalTab: 'cv', icon: Zap },
      { id: 'career-docs', label: 'My Documents', tab: 'applications', subTab: 'documents', icon: FileText },
    ]},
    { id: 'employer-center', label: 'Employer Center', icon: Building2, subItems: [
      { id: 'emp-post', label: 'Post a Job', tab: 'post-job', icon: Plus },
      { id: 'emp-listings', label: 'My Job Listings & Status', tab: 'my-jobs', icon: Building2 },
      { id: 'emp-verification', label: 'Business Verification', tab: 'profile', accountSubTab: 'profile', icon: ShieldCheck, employerOnly: true },
    ]},
    { id: 'ads-campaigns', label: 'Ads & Campaigns', icon: Megaphone, subItems: [
      { id: 'ads-list', label: 'My Campaigns', tab: 'campaigns', subTab: 'my-campaigns', icon: Megaphone },
      { id: 'ads-create', label: 'Create Campaign', tab: 'campaigns', subTab: 'create', icon: Plus },
    ]},
    { id: 'membership-payments', label: 'Wallet & Payments', icon: Wallet, subItems: [
      { id: 'mem-wallet', label: 'Wallet & Balance', tab: 'campaigns', subTab: 'wallet', icon: Wallet },
      { id: 'wallet-deposit', label: 'Add Funds / Deposit', action: 'deposit', icon: Plus },
      { id: 'membership-renew', label: 'Renew / Upgrade Plan', action: 'subscription', icon: Crown },
      { id: 'mem-history', label: 'Payment History', tab: 'overview', subView: 'history', icon: History },
    ]},
    { id: 'communication', label: 'Alerts & Communication', icon: Bell, subItems: [
      { id: 'mem-whatsapp', label: 'WhatsApp & Job Alerts', isGlobal: true, globalTab: 'alerts', icon: Zap },
      { id: 'notifications-center', label: 'Notifications Center', action: 'notifications', icon: Bell },
      { id: 'acc-chat', label: 'Support Inbox', tab: 'chat', icon: MessageSquare },
    ]},
    { id: 'account-support', label: 'My Account', icon: User, subItems: [
      { id: 'acc-profile', label: 'Profile & Preferences', tab: 'profile', accountSubTab: 'profile', icon: User },
      { id: 'acc-security', label: 'Security & Password', tab: 'profile', accountSubTab: 'security', icon: Lock },
    ]},
  ] as NavItem[]).map((category) => ({
    ...category,
    subItems: category.subItems.filter((item) => !item.employerOnly || userRole === 'Employer/Job Poster')
  })).filter((category) => category.id !== 'employer-center' || userRole === 'Employer/Job Poster');
  
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

  const NavContent = (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800 w-[min(85vw,20rem)] lg:w-64 overflow-y-auto">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between lg:justify-start space-x-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-slate-950" />
        </div>
        <span className="font-black text-white tracking-tighter text-sm">MY DASHBOARD</span>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {menuStructure.map((category) => {
          const isExpanded = expandedCategory === category.id;
          return (
            <div key={category.id} className="space-y-1">
              <button
                type="button"
                onClick={() => handleCategoryClick(category.id)}
                aria-expanded={isExpanded}
                aria-controls={`user-nav-${category.id}`}
                className={`w-full flex items-center justify-between px-3 py-3 min-h-11 rounded-xl text-xs font-bold transition-all group ${
                  isExpanded ? 'bg-slate-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <category.icon className={`w-4 h-4 ${isExpanded ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                  <span>{category.label}</span>
                </div>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
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
                        className={`w-full flex items-center space-x-2 px-3 py-2.5 min-h-10 rounded-lg text-xs font-semibold transition-all ${
                          active 
                            ? 'text-emerald-400 bg-emerald-500/10' 
                            : subItem.isLogout
                            ? 'text-rose-400 hover:bg-rose-500/10'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        {subItem.icon && <subItem.icon className={`w-3 h-3 shrink-0 ${subItem.isLogout ? 'text-rose-400' : ''}`} />}
                        <span className="truncate">{subItem.label}</span>
                        {active && <div className="w-1 h-1 rounded-full bg-emerald-400 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
      <div className={`lg:hidden fixed inset-0 z-50 transition-all duration-300 ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}>
        <button
          type="button"
          aria-label="Close dashboard navigation"
          tabIndex={isOpen ? 0 : -1}
          className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <div className={`absolute left-0 top-0 bottom-0 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {NavContent}
        </div>
      </div>

      {/* Mobile quick navigation: frequent destinations only; full menu remains in the drawer. */}
      <nav aria-label="Mobile quick navigation" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/85 pb-1">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {[
            { id: 'dash-overview', label: 'Home', icon: LayoutDashboard, tab: 'overview' as DashboardTab, subView: 'metrics' as OverviewSubView },
            { id: 'jobs-explore', label: 'Jobs', icon: Search, isGlobal: true, globalTab: 'jobs' as GlobalTab },
            { id: 'career-cv', label: 'CV', icon: FileText, isGlobal: true, globalTab: 'cv' as GlobalTab },
            { id: 'mem-whatsapp', label: 'Alerts', icon: Bell, isGlobal: true, globalTab: 'alerts' as GlobalTab },
            { id: 'acc-profile', label: 'Account', icon: User, tab: 'profile' as DashboardTab, accountSubTab: 'profile' as const },
          ].map((item) => {
            // Dashboard-local selection reflects the actual current view, not a stale global-route ID.
            const active = isActive(item);
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  onNavigate({
                    id: item.id,
                    tab: item.tab,
                    subView: item.subView,
                    accountSubTab: item.accountSubTab,
                    isGlobal: item.isGlobal,
                    globalTab: item.globalTab
                  });
                  onClose();
                }}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${active ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
