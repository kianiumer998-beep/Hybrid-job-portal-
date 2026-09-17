import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Info,
  Flame,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { NotificationItem } from '../../types/notification';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onTriggerMandatoryAction?: (notif: NotificationItem) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onTriggerMandatoryAction
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  if (!isOpen) return null;

  const displayList = notifications.filter(n => {
    if (filter === 'unread') {
      return !n.userState?.read;
    }
    return true;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <Flame className="w-3 h-3 mr-1 text-rose-400" /> Urgent
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-400" /> Important
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <Info className="w-3 h-3 mr-1 text-slate-400" /> Info
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <AlertCircle className="w-3 h-3 mr-1 text-indigo-400" /> Notice
          </span>
        );
    }
  };

  const handleMarkAll = async () => {
    setIsMarkingAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black text-white">Notifications & Alerts</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Portal announcements, career alerts, and account requirements</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={isMarkingAll}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filter === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filter === 'unread'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
          <span className="text-slate-500 text-[11px]">Synced via MongoDB</span>
        </div>

        {/* Notification List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {displayList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-sm">No notifications to display</p>
              <p className="text-xs text-slate-500 mt-1">You are all caught up with portal alerts.</p>
            </div>
          ) : (
            displayList.map(item => {
              const isUnread = !item.userState?.read;
              const isMandatory = item.isMandatory && !item.userState?.completed && !item.userState?.adminOverridden;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isMandatory
                      ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/20'
                      : isUnread
                      ? 'bg-slate-800/60 border-indigo-500/40 shadow-md'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1 mb-1.5">
                        {getPriorityBadge(item.priority)}

                        {item.isMandatory && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <ShieldCheck className="w-3 h-3 mr-1 text-rose-400" />
                            {item.userState?.completed
                              ? 'Action Completed'
                              : item.userState?.adminOverridden
                              ? 'Admin Unlocked'
                              : 'Mandatory Action Required'}
                          </span>
                        )}

                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}

                        <span className="text-[11px] text-slate-500 ml-auto">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>

                      {/* Sanitized HTML Body */}
                      <div
                        className="text-xs text-slate-300 leading-relaxed mb-3 prose prose-invert max-w-none break-words"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.body) }}
                      />

                      {/* Optional Image */}
                      {item.imageUrl && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-slate-800 max-h-48">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-auto object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/60 flex-wrap gap-y-2">
                        {/* Mandatory Action Trigger */}
                        {isMandatory && onTriggerMandatoryAction && (
                          <button
                            onClick={() => onTriggerMandatoryAction(item)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center space-x-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Complete Required Action</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* CTA Link */}
                        {item.ctaText && item.ctaUrl && (
                          <a
                            href={item.ctaUrl}
                            target={item.target || '_blank'}
                            rel="noopener noreferrer"
                            onClick={() => onMarkRead(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-500/20 transition-all"
                          >
                            <span>{item.ctaText}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Mark Read */}
                        {isUnread && (
                          <button
                            onClick={() => onMarkRead(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
                          >
                            Mark as read
                          </button>
                        )}

                        {/* Dismiss (if dismissible) */}
                        {item.dismissible !== false && (
                          <button
                            onClick={() => onDismiss(item.id)}
                            className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-medium transition-all ml-auto flex items-center space-x-1 cursor-pointer"
                            title="Dismiss notification"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Dismiss</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
