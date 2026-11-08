import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Briefcase, 
  Building2, 
  CreditCard, 
  Megaphone, 
  User, 
  ChevronRight, 
  ChevronDown, 
  X,
  Menu,
  FileText,
  Sparkles,
  History,
  Bookmark,
  Plus,
  Wallet,
  Bell,
  Lock,
  MessageSquare,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';

type DashboardTab = 'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat' | 'campaigns';
type OverviewSubView = 'metrics' | 'recommendations' | 'history';
type AppSubTab = 'submitted' | 'saved' | 'alerts' | 'documents';
type CampaignSubTab = 'my-campaigns' | 'create' | 'wallet';
type GlobalTab = 'jobs' | 'cv' | 'alerts' | 'dashboard';

interface NavSubItem {
  label: string;
  icon?: any;
  tab?: DashboardTab;
  subView?: OverviewSubView;
  subTab?: AppSubTab | CampaignSubTab;
  isGlobal?: boolean;
  globalTab?: GlobalTab;
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
  onNavigate: (params: {
    tab?: DashboardTab;
    subView?: OverviewSubView;
    subTab?: AppSubTab | CampaignSubTab;
    isGlobal?: boolean;
    globalTab?: GlobalTab;
  }) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const UserDashboardNavigation: React.FC<UserDashboardNavigationProps> = ({
  activeTab,
  overviewSubView,
  appSubTab,
  campaignSubTab,
  onNavigate,
  isOpen,
  onClose
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('dashboard');

  const menuStructure: NavItem[] = [
    {
      id: 'dashboard',
      label: 'DASHBOARD',
      icon: LayoutDashboard,
      subItems: [
        { label: 'Overview', tab: 'overview', subView: 'metrics', icon: LayoutDashboard },
        { label: 'Recommendations', tab: 'overview', subView: 'recommendations', icon: Sparkles },
        { label: 'Payment History', tab: 'overview', subView: 'history', icon: History },
      ]
    },
    {
      id: 'find-jobs',
      label: 'FIND JOBS',
      icon: Search,
      subItems: [
        { label: 'Explore All Jobs', isGlobal: true, globalTab: 'jobs', icon: Search },
      ]
    },
    {
      id: 'career-center',
      label: 'CAREER CENTER',
      icon: Briefcase,
      subItems: [
        { label: 'My Applications', tab: 'applications', subTab: 'submitted', icon: FileText },
        { label: 'Saved Jobs', tab: 'applications', subTab: 'saved', icon: Bookmark },
        { label: 'My Job Alerts', tab: 'applications', subTab: 'alerts', icon: Bell },
        { label: 'My Documents', tab: 'applications', subTab: 'documents', icon: FileText },
        { label: 'ATS CV Builder', isGlobal: true, globalTab: 'cv', icon: Zap },
      ]
    },
    {
      id: 'employer-center',
      label: 'EMPLOYER CENTER',
      icon: Building2,
      subItems: [
        { label: 'Post New Job', tab: 'post-job', icon: Plus },
        { label: 'My Job Listings', tab: 'my-jobs', icon: Building2 },
      ]
    },
    {
      id: 'membership-payments',
      label: 'MEMBERSHIP & PAYMENTS',
      icon: CreditCard,
      subItems: [
        { label: 'Membership Status', tab: 'overview', subView: 'metrics', icon: ShieldCheck },
        { label: 'Payment History', tab: 'overview', subView: 'history', icon: History },
        { label: 'Wallet & Deposit', tab: 'campaigns', subTab: 'wallet', icon: Wallet },
        { label: 'Paid WhatsApp Alerts', isGlobal: true, globalTab: 'alerts', icon: Zap },
      ]
    },
    {
      id: 'ads-campaigns',
      label: 'ADVERTISEMENTS',
      icon: Megaphone,
      subItems: [
        { label: 'My Campaigns', tab: 'campaigns', subTab: 'my-campaigns', icon: Megaphone },
        { label: 'Create Campaign', tab: 'campaigns', subTab: 'create', icon: Plus },
        { label: 'Campaign Wallet', tab: 'campaigns', subTab: 'wallet', icon: Wallet },
      ]
    },
    {
      id: 'account-support',
      label: 'MY ACCOUNT',
      icon: User,
      subItems: [
        { label: 'Profile Settings', tab: 'profile', icon: User },
        { label: 'Security', tab: 'profile', icon: Lock },
        { label: 'Support Inbox', tab: 'chat', icon: MessageSquare },
      ]
    }
  ];

  const handleCategoryClick = (id: string) => {
    setExpandedCategory(expandedCategory === id ? null : id);
  };

  const isActive = (item: NavSubItem) => {
    if (item.isGlobal) return false; // App-level active state handled elsewhere
    if (activeTab !== item.tab) return false;
    if (item.subView && overviewSubView !== item.subView) return false;
    if (item.subTab) {
        if (activeTab === 'applications' && appSubTab !== item.subTab) return false;
        if (activeTab === 'campaigns' && campaignSubTab !== item.subTab) return false;
    }
    return true;
  };

  const NavContent = (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800 w-64 overflow-y-auto">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between lg:justify-start space-x-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-slate-950" />
        </div>
        <span className="font-black text-white tracking-tighter text-sm">PRO DASHBOARD</span>
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
                onClick={() => handleCategoryClick(category.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-all group ${
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
                <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 py-1">
                  {category.subItems.map((subItem, idx) => {
                    const active = isActive(subItem);
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          onNavigate({
                            tab: subItem.tab,
                            subView: subItem.subView,
                            subTab: subItem.subTab,
                            isGlobal: subItem.isGlobal,
                            globalTab: subItem.globalTab
                          });
                          if (window.innerWidth < 1024) onClose();
                        }}
                        className={`w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          active 
                            ? 'text-emerald-400 bg-emerald-500/10' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        {subItem.icon && <subItem.icon className="w-3 h-3 shrink-0" />}
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

      <div className="p-4 border-t border-slate-800">
        <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Preview Mode</p>
            <p className="text-[11px] text-slate-300 leading-tight">Professional Menu is currently in preview.</p>
        </div>
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
        <div 
          className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
          onClick={onClose}
        />
        <div className={`absolute left-0 top-0 bottom-0 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {NavContent}
        </div>
      </div>
    </>
  );
};
