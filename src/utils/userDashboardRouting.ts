export type UserDashboardTab =
  | 'overview'
  | 'profile'
  | 'applications'
  | 'post-job'
  | 'my-jobs'
  | 'chat'
  | 'campaigns';

export interface UserDashboardRoute {
  tab: UserDashboardTab;
  subView?: 'metrics' | 'recommendations' | 'history';
  subTab?: 'submitted' | 'saved' | 'alerts' | 'documents' | 'my-campaigns' | 'create' | 'wallet';
  accountSubTab?: 'profile' | 'security';
  globalTab?: 'jobs' | 'cv' | 'alerts';
  action?: 'subscription' | 'deposit' | 'notifications';
}

export const USER_DASHBOARD_BASE_PATH = '/user/dashboard';

export const USER_DASHBOARD_ROUTES: Record<string, UserDashboardRoute> = {
  'dash-overview': { tab: 'overview', subView: 'metrics' },
  'jobs-recommended': { tab: 'overview', subView: 'recommendations' },
  'jobs-explore': { tab: 'overview', globalTab: 'jobs' },
  'jobs-applications': { tab: 'applications', subTab: 'submitted' },
  'jobs-saved': { tab: 'applications', subTab: 'saved' },
  'jobs-alerts': { tab: 'applications', subTab: 'alerts' },
  'career-cv': { tab: 'overview', globalTab: 'cv' },
  'career-docs': { tab: 'applications', subTab: 'documents' },
  'emp-post': { tab: 'post-job' },
  'emp-listings': { tab: 'my-jobs' },
  'emp-verification': { tab: 'profile', accountSubTab: 'profile' },
  'ads-list': { tab: 'campaigns', subTab: 'my-campaigns' },
  'ads-create': { tab: 'campaigns', subTab: 'create' },
  'mem-wallet': { tab: 'campaigns', subTab: 'wallet' },
  'membership-plan': { tab: 'overview', action: 'subscription' },
  'wallet-deposit': { tab: 'overview', action: 'deposit' },
  'mem-history': { tab: 'overview', subView: 'history' },
  'mem-whatsapp': { tab: 'overview', globalTab: 'alerts' },
  'notifications-center': { tab: 'overview', action: 'notifications' },
  'acc-chat': { tab: 'chat' },
  'acc-profile': { tab: 'profile', accountSubTab: 'profile' },
  'acc-security': { tab: 'profile', accountSubTab: 'security' }
};

const LEGACY_ROUTE_IDS: Record<string, string> = {
  'dash-recs': 'jobs-recommended',
  'dash-history': 'mem-history',
  'find-explore': 'jobs-explore',
  'career-apps': 'jobs-applications',
  'career-saved': 'jobs-saved',
  'career-alerts': 'jobs-alerts',
  'mem-status': 'dash-overview',
  'mem-plans': 'membership-plan',
  'ads-wallet': 'mem-wallet'
};

export function getUserDashboardRouteId(pathname: string): string | null {
  const prefix = USER_DASHBOARD_BASE_PATH + '/';
  if (!pathname.startsWith(prefix)) return null;
  const rawId = pathname.slice(prefix.length).split('/')[0];
  let id = rawId;
  try { id = decodeURIComponent(rawId); } catch {}
  const normalized = LEGACY_ROUTE_IDS[id] || id;
  return USER_DASHBOARD_ROUTES[normalized] ? normalized : null;
}

export function getUserDashboardPath(routeId: string): string {
  const normalized = LEGACY_ROUTE_IDS[routeId] || routeId;
  return USER_DASHBOARD_ROUTES[normalized]
    ? USER_DASHBOARD_BASE_PATH + '/' + encodeURIComponent(normalized)
    : USER_DASHBOARD_BASE_PATH + '/dash-overview';
}

export function getUserDashboardRouteIdForState(state: {
  activeNavId: string | null;
  activeTab: UserDashboardTab;
  overviewSubView: 'metrics' | 'recommendations' | 'history';
  appSubTab: 'submitted' | 'saved' | 'alerts' | 'documents';
  campaignSubTab: 'my-campaigns' | 'create' | 'wallet';
  accountSubTab: 'profile' | 'security';
}): string {
  const activeId = state.activeNavId
    ? (LEGACY_ROUTE_IDS[state.activeNavId] || state.activeNavId)
    : '';
  const activeRoute = USER_DASHBOARD_ROUTES[activeId];
  if (activeRoute) {
    if (activeRoute.action || activeRoute.globalTab) return activeId;
    if (activeRoute.tab === state.activeTab &&
        (!activeRoute.subView || activeRoute.subView === state.overviewSubView) &&
        (!activeRoute.subTab || activeRoute.subTab === (state.activeTab === 'applications' ? state.appSubTab : state.campaignSubTab)) &&
        (!activeRoute.accountSubTab || activeRoute.accountSubTab === state.accountSubTab)) {
      return activeId;
    }
  }

  const match = Object.entries(USER_DASHBOARD_ROUTES).find(([, route]) => {
    if (route.action || route.globalTab || route.tab !== state.activeTab) return false;
    if (route.subView && route.subView !== state.overviewSubView) return false;
    if (route.subTab) {
      const currentSubTab = state.activeTab === 'applications' ? state.appSubTab : state.campaignSubTab;
      if (route.subTab !== currentSubTab) return false;
    }
    if (route.accountSubTab && route.accountSubTab !== state.accountSubTab) return false;
    return true;
  });
  return match?.[0] || 'dash-overview';
}
