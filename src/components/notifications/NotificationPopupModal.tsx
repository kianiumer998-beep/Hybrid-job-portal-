import React from 'react';
import { X, ExternalLink, Flame, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { NotificationItem } from '../../types/notification';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

interface NotificationPopupModalProps {
  notification: NotificationItem | null;
  onClose: () => void;
  onMarkRead: (id: string) => Promise<void>;
  onTriggerMandatoryAction?: (notif: NotificationItem) => void;
}

export const NotificationPopupModal: React.FC<NotificationPopupModalProps> = ({
  notification,
  onClose,
  onMarkRead,
  onTriggerMandatoryAction
}) => {
  if (!notification) return null;

  const isMandatory = notification.isMandatory && !notification.userState?.completed && !notification.userState?.adminOverridden;

  const handleCtaClick = () => {
    onMarkRead(notification.id);
    if (notification.ctaUrl) {
      if (notification.target === '_self') {
        window.location.href = notification.ctaUrl;
      } else {
        window.open(notification.ctaUrl, '_blank');
      }
    }
    if (!isMandatory) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
        {/* Banner/Header */}
        <div className={`p-6 border-b ${
          isMandatory
            ? 'bg-rose-950/40 border-rose-500/30'
            : notification.priority === 'urgent'
            ? 'bg-amber-950/30 border-amber-500/30'
            : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isMandatory ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-rose-400" />
                  Mandatory Notice
                </span>
              ) : notification.priority === 'urgent' ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <Flame className="w-3.5 h-3.5 mr-1 text-rose-400" />
                  Urgent Notice
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Portal Announcement
                </span>
              )}
            </div>

            {notification.dismissible !== false && !isMandatory && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <h2 className="text-lg font-black text-white mt-3">{notification.title}</h2>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {notification.imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-md">
              <img
                src={notification.imageUrl}
                alt={notification.title}
                className="w-full h-auto object-cover max-h-56"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div
            className="text-sm text-slate-200 leading-relaxed prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(notification.body) }}
          />
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-end gap-3">
          {notification.dismissible !== false && !isMandatory && (
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
          )}

          {isMandatory && onTriggerMandatoryAction && (
            <button
              onClick={() => {
                onClose();
                onTriggerMandatoryAction(notification);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Review & Complete Requirement</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {notification.ctaText && notification.ctaUrl && !isMandatory && (
            <button
              onClick={handleCtaClick}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <span>{notification.ctaText}</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
