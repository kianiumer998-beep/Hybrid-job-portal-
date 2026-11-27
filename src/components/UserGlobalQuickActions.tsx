import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Search, FileText, Bell, User, Briefcase, MessageSquare, Wallet, Crown, ClipboardList, ShieldCheck, Megaphone, Star, Zap, Bookmark, Settings, History } from 'lucide-react';
import { api } from '../services/api';
import { USER_DASHBOARD_ROUTES, getUserDashboardPath, getUserDashboardRouteId } from '../utils/userDashboardRouting';

type GlobalTab = 'jobs' | 'cv' | 'alerts' | 'dashboard';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  destination?: string;
  enabled?: boolean;
  mobile?: boolean;
}

interface UserGlobalQuickActionsProps {
  currentUser: { id?: string; role?: string } | null;
  activeTab: GlobalTab;
  onNavigateTab: (tab: GlobalTab) => void;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  { id: 'dash-overview', label: 'Home', icon: 'LayoutDashboard', destination: '/user/dashboard', enabled: true, mobile: true },
  { id: 'jobs-explore', label: 'Jobs', icon: 'Search', destination: '/jobs', enabled: true, mobile: true },
  { id: 'career-cv', label: 'CV', icon: 'FileText', destination: '/cv', enabled: true, mobile: true },
  { id: 'mem-whatsapp', label: 'Alerts', icon: 'Bell', destination: '/alerts', enabled: true, mobile: true },
  { id: 'acc-profile', label: 'Account', icon: 'User', destination: '/user/dashboard/acc-profile', enabled: true, mobile: true }
];

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  LayoutDashboard, Search, FileText, Bell, User, Briefcase, MessageSquare, Wallet, Crown,
  ClipboardList, ShieldCheck, Megaphone, Star, Zap, Bookmark, Settings, History
};

export const UserGlobalQuickActions: React.FC<UserGlobalQuickActionsProps> = ({
  currentUser,
  activeTab,
  onNavigateTab
}) => {
  const [quickActions, setQuickActions] = useState<QuickAction[]>(DEFAULT_ACTIONS);

  useEffect(() => {
    let mounted = true;
    api.settings.getUserDashboardNavigation().then((result: any) => {
      if (!mounted || !result?.success || !Array.isArray(result.config?.quickActions)) return;
      setQuickActions(result.config.quickActions);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [currentUser?.id]);

  if (!currentUser) return null;

  const visibleActions = quickActions
    .filter((item) => item?.enabled === true && item?.mobile === true && USER_DASHBOARD_ROUTES[item.id])
    .filter((item) => {
      const route = USER_DASHBOARD_ROUTES[item.id];
      return !(route.tab === 'post-job' || route.tab === 'my-jobs' || route.tab === 'campaigns') ||
        currentUser.role === 'Employer/Job Poster';
    })
    .slice(0, 5);

  if (!visibleActions.length) return null;

  const handleAction = (id: string) => {
    const route = USER_DASHBOARD_ROUTES[id];
    if (!route) return;
    if (route.globalTab) {
      onNavigateTab(route.globalTab);
      return;
    }
    window.history.pushState({}, '', getUserDashboardPath(id));
    onNavigateTab('dashboard');
  };

  const currentRouteId = typeof window !== 'undefined' ? getUserDashboardRouteId(window.location.pathname) || '' : '';

  return (
    <nav aria-label="Persistent mobile quick actions" className="md:hidden fixed inset-x-0 bottom-0 z-[70] border-t border-slate-800 bg-slate-950/96 backdrop-blur-lg supports-[backdrop-filter]:bg-slate-950/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.3)]">
      <div className={`mx-auto grid max-w-xl px-1 ${visibleActions.length >= 4 ? 'grid-cols-5' : visibleActions.length === 3 ? 'grid-cols-3' : visibleActions.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {visibleActions.map((item) => {
          const route = USER_DASHBOARD_ROUTES[item.id];
          const Icon = ACTION_ICONS[item.icon] || LayoutDashboard;
          const isActive = route.globalTab
            ? activeTab === route.globalTab
            : activeTab === 'dashboard' && currentRouteId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleAction(item.id)}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${isActive ? 'text-emerald-300 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {isActive && <span className="absolute top-1 h-0.5 w-4 rounded-full bg-emerald-400" aria-hidden="true" />}
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
