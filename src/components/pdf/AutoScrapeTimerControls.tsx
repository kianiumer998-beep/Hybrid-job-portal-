import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Clock, 
  Play, 
  Pause, 
  RefreshCw, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  CheckCircle2, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface AutoScrapeConfig {
  enabled: boolean;
  intervalMinutes: number; // 15, 30, 60, 120, or 3 (rapid test)
  targetScope: 'all' | 'selected';
  preventDuplicates: boolean;
  autoApprove: boolean;
}

interface AutoScrapeTimerControlsProps {
  config: AutoScrapeConfig;
  onChangeConfig: (newConfig: AutoScrapeConfig) => void;
  selectedCount: number;
  totalPortalsCount: number;
  lastRunTimestamp: string | null;
  onTriggerInstantAutoRun: () => void;
  isCrawling: boolean;
}

export const AutoScrapeTimerControls: React.FC<AutoScrapeTimerControlsProps> = ({
  config,
  onChangeConfig,
  selectedCount,
  totalPortalsCount,
  lastRunTimestamp,
  onTriggerInstantAutoRun,
  isCrawling
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(config.intervalMinutes * 60);

  // Sync timer when interval config changes
  useEffect(() => {
    setSecondsLeft(config.intervalMinutes * 60);
  }, [config.intervalMinutes]);

  // Live countdown timer when enabled
  useEffect(() => {
    if (!config.enabled) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onTriggerInstantAutoRun();
          return config.intervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [config.enabled, config.intervalMinutes, onTriggerInstantAutoRun]);

  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(((config.intervalMinutes * 60 - secondsLeft) / (config.intervalMinutes * 60)) * 100))
  );

  const formatLastRunRelative = (ts: string | null) => {
    if (!ts) return 'Never executed';
    try {
      const d = new Date(ts.replace(' ', 'T'));
      const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hours ago`;
      return `${Math.floor(diffHours / 24)} days ago`;
    } catch {
      return ts.substring(11, 16) || 'Recently';
    }
  };

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
      config.enabled 
        ? 'bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border-indigo-500/50 shadow-lg shadow-indigo-500/10' 
        : 'bg-slate-900/80 border-slate-800'
    }`}>
      {/* HEADER SUMMARY BAR */}
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            config.enabled 
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            <Bot className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs sm:text-sm font-black text-white flex items-center space-x-1.5">
                <span>🤖 Auto-Select & Auto-Scrape Engine</span>
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                config.enabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {config.enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1 inline-block" />}
                {config.enabled ? `Active (${config.intervalMinutes}m cycle)` : 'Disabled'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              {config.enabled ? (
                <span className="text-indigo-200">
                  Crawling every <strong className="text-amber-300 font-bold">{config.intervalMinutes} mins</strong> • Target:{' '}
                  <strong className="text-white">
                    {config.targetScope === 'selected' ? `${selectedCount} Selected Portals` : `All ${totalPortalsCount} Portals`}
                  </strong> • Prevents duplicates with saved timestamps.
                </span>
              ) : (
                'Enable automated background scraping with customizable 15m/30m timer and duplicate protection.'
              )}
            </p>
          </div>
        </div>

        {/* TIMER STATUS & PRIMARY TOGGLE */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          {config.enabled && (
            <div className="flex items-center space-x-2 bg-slate-900/90 border border-indigo-500/30 px-3 py-1.5 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Next Crawl In</div>
                <div className="text-xs font-black font-mono text-amber-300">
                  {formatCountdown(secondsLeft)}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-1.5">
            {config.enabled && (
              <button
                type="button"
                disabled={isCrawling}
                onClick={onTriggerInstantAutoRun}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1 transition-all disabled:opacity-50 cursor-pointer"
                title="Trigger automated scrape immediately without waiting for timer"
              >
                <RefreshCw className={`w-3 h-3 ${isCrawling ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Run Now</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onChangeConfig({ ...config, enabled: !config.enabled })}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1.5 cursor-pointer transition-all shadow-md ${
                config.enabled 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
              }`}
            >
              {config.enabled ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Disable Timer</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Enable Auto-Scraper</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Configure timer intervals & scope"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* PROGRESS BAR FOR ACTIVE TIMER */}
      {config.enabled && (
        <div className="w-full bg-slate-800/60 h-1">
          <div 
            className="bg-gradient-to-r from-indigo-500 via-amber-400 to-emerald-400 h-1 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* EXPANDED SETTINGS PANEL */}
      {isExpanded && (
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 text-xs space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. INTERVAL SELECTION */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Timer Frequency / Crawl Interval:</span>
              </label>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { label: '15 Min', val: 15 },
                  { label: '30 Min', val: 30 },
                  { label: '1 Hour', val: 60 },
                  { label: '2 Hours', val: 120 },
                  { label: '3 Min (Test)', val: 3 }
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => onChangeConfig({ ...config, intervalMinutes: item.val })}
                    className={`py-1.5 rounded-lg font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer ${
                      config.intervalMinutes === item.val
                        ? 'bg-indigo-500 text-white shadow ring-1 ring-indigo-400'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. TARGET SCOPE SELECTION */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Target Selection Mode:</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeConfig({ ...config, targetScope: 'all' })}
                  className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                    config.targetScope === 'all'
                      ? 'bg-indigo-950/60 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-[11px]">All {totalPortalsCount} Portals</div>
                  <div className="text-[10px] text-slate-400">Sequential full-system crawl</div>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeConfig({ ...config, targetScope: 'selected' })}
                  className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                    config.targetScope === 'selected'
                      ? 'bg-indigo-950/60 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-[11px]">Selected Portals ({selectedCount})</div>
                  <div className="text-[10px] text-slate-400">Only manual checked items</div>
                </button>
              </div>
            </div>

            {/* 3. DUPLICATE PREVENTION & AUTO-PUBLISH */}
            <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] font-bold text-slate-300 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Duplicate Prevention Rules:</span>
              </div>

              <label className="flex items-center space-x-2 cursor-pointer text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={config.preventDuplicates}
                  onChange={(e) => onChangeConfig({ ...config, preventDuplicates: e.target.checked })}
                  className="rounded text-indigo-500 focus:ring-0 cursor-pointer"
                />
                <span>Auto-Skip Duplicates (Match Case No. & Title)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={config.autoApprove}
                  onChange={(e) => onChangeConfig({ ...config, autoApprove: e.target.checked })}
                  className="rounded text-indigo-500 focus:ring-0 cursor-pointer"
                />
                <span>Direct Ingest to Live Jobs (Skip Pending Queue)</span>
              </label>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Last Background Execution:</span>
              <strong className="text-slate-200">{formatLastRunRelative(lastRunTimestamp)}</strong>
            </div>

            <div className="flex items-center space-x-2 text-indigo-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Timestamps are saved to each scraper to prevent duplicate re-ingestion.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
