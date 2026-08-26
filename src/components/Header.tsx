import React from 'react';
import { UserAccount } from '../types/job';
import { Briefcase, FileText, Bell, Sparkles, ShieldCheck, CheckCircle2, Bookmark, Menu, X, User, LogIn, LayoutDashboard } from 'lucide-react';

interface HeaderProps {
  activeTab: 'jobs' | 'cv' | 'alerts' | 'dashboard';
  setActiveTab: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
  isSubscribed: boolean;
  onOpenSubscriptionModal: () => void;
  savedJobsCount: number;
  currentUser: UserAccount | null;
  onOpenAuthModal: () => void;
  isAdminLoggedIn: boolean;
  onToggleAdminView: () => void;
  showAdminView: boolean;
  activeAdsCount?: number;
  onOpenAdDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isSubscribed,
  onOpenSubscriptionModal,
  savedJobsCount,
  currentUser,
  onOpenAuthModal,
  isAdminLoggedIn,
  onToggleAdminView,
  showAdminView,
  activeAdsCount = 0,
  onOpenAdDrawer
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('jobs')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  HybridJobs<span className="text-emerald-400">.pk</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Global & PK
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Automated Remote Portal & CV Engine</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => { setActiveTab('jobs'); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === 'jobs' && !showAdminView
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Explore Jobs</span>
              {savedJobsCount > 0 && (
                <span className="ml-1 bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
                  {savedJobsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('cv'); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === 'cv' && !showAdminView
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>ATS CV Builder</span>
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                Pro
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('alerts'); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === 'alerts' && !showAdminView
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Job Alerts</span>
            </button>

            {currentUser && (
              <button
                onClick={() => { setActiveTab('dashboard'); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === 'dashboard' && !showAdminView
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span>User Dashboard</span>
              </button>
            )}
          </nav>

          {/* Right Action Controls */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Live Announcements / Ads Bell */}
            <button
              onClick={onOpenAdDrawer}
              className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 hover:border-amber-500/40 transition-all cursor-pointer"
              title="View Live Announcements & Alerts"
            >
              <Bell className="w-4 h-4" />
              {activeAdsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-md shadow-rose-500/50">
                  {activeAdsCount}
                </span>
              )}
            </button>

            {/* User Login/Account Button */}
            {currentUser ? (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-xs font-bold transition-all"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span>{currentUser.name}</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center space-x-1.5 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login / Register</span>
              </button>
            )}

            {/* Admin Switcher if Admin Logged In */}
            {isAdminLoggedIn && (
              <button
                onClick={onToggleAdminView}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  showAdminView
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-amber-400 border border-amber-500/40 hover:bg-slate-700'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{showAdminView ? 'Exit Admin' : 'Admin Panel'}</span>
              </button>
            )}

            {/* Subscriber Status Badge */}
            {isSubscribed ? (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Pro Subscriber</span>
              </div>
            ) : (
              <button
                onClick={onOpenSubscriptionModal}
                className="relative group overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-[1px] font-semibold text-xs transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95"
              >
                <div className="flex items-center space-x-2 rounded-[11px] bg-slate-950 px-3 py-1.5 transition-all group-hover:bg-opacity-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="text-white group-hover:text-slate-950 transition-colors">
                    Job Alerts (PKR 300)
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="md:hidden flex items-center space-x-2">
            {!currentUser && (
              <button
                onClick={onOpenAuthModal}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
              >
                Login
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-6 space-y-2">
          <button
            onClick={() => { setActiveTab('jobs'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between ${
              activeTab === 'jobs' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Briefcase className="w-5 h-5 text-emerald-400" />
              <span>Explore Jobs</span>
            </div>
            {savedJobsCount > 0 && (
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
                {savedJobsCount} saved
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('cv'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center space-x-3 ${
              activeTab === 'cv' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-300'
            }`}
          >
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>Automated ATS CV Builder</span>
          </button>

          <button
            onClick={() => { setActiveTab('alerts'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center space-x-3 ${
              activeTab === 'alerts' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-300'
            }`}
          >
            <Bell className="w-5 h-5 text-amber-400" />
            <span>Job Alerts</span>
          </button>

          {currentUser ? (
            <button
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center space-x-3 ${
                activeTab === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 text-emerald-400" />
              <span>User Dashboard ({currentUser.name})</span>
            </button>
          ) : (
            <button
              onClick={() => { onOpenAuthModal(); setMobileMenuOpen(false); }}
              className="w-full mt-2 py-3 rounded-xl bg-slate-800 text-emerald-400 font-bold text-sm border border-emerald-500/30 flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Login / Register Account</span>
            </button>
          )}

          {!isSubscribed && (
            <button
              onClick={() => { onOpenSubscriptionModal(); setMobileMenuOpen(false); }}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-sm shadow-lg flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Subscribe for Job Alerts (PKR 300)</span>
            </button>
          )}

          {isAdminLoggedIn && (
            <button
              onClick={() => { onToggleAdminView(); setMobileMenuOpen(false); }}
              className="w-full mt-2 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{showAdminView ? 'Exit Admin View' : 'Open Secret Admin Dashboard'}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
