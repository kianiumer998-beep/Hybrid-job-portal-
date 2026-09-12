import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Sparkles, Send, CheckCircle2, PhoneCall } from 'lucide-react';

export interface WhatsAppSupportConfig {
  enabled: boolean;
  phoneNumber: string;       // e.g. "923001234567" or "+92 300 1234567"
  defaultMessage: string;    // e.g. "Hello! I need help with Hybrid Remote Jobs & ATS Resume Builder."
  agentName: string;         // e.g. "Sarah (HR Career Advisor)"
  supportHoursText: string;  // e.g. "Online • 9:00 AM - 9:00 PM PKT"
  position: 'bottom-right' | 'bottom-left';
  ctaText?: string;          // e.g. "Start WhatsApp Chat"
  bubblePromptText?: string; // e.g. "Need help applying for remote jobs..."
  badgeText?: string;        // e.g. "HR Support"
  unreadCount?: number;      // e.g. 1
  mobileSize?: 'compact' | 'standard' | 'large';
  desktopSize?: 'compact' | 'standard' | 'large';
  bubbleSize?: 'compact' | 'standard' | 'large';
  iconSize?: 'compact' | 'standard' | 'large';
}

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppSupportConfig = {
  enabled: true,
  phoneNumber: '923001234567',
  defaultMessage: 'Hello! I need assistance regarding job applications and career alerts on HybridJobs.pk.',
  agentName: 'Ayesha (Career Advisor)',
  supportHoursText: 'Online • 9:00 AM - 9:00 PM PKT',
  position: 'bottom-right',
  ctaText: 'Start WhatsApp Chat',
  bubblePromptText: 'Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!',
  badgeText: 'HR Support',
  unreadCount: 1,
  mobileSize: 'compact',
  desktopSize: 'standard',
  bubbleSize: 'standard',
  iconSize: 'standard'
};

interface WhatsAppStickyButtonProps {
  config?: WhatsAppSupportConfig;
  onOpenLegalModal?: () => void;
}

export const WhatsAppStickyButton: React.FC<WhatsAppStickyButtonProps> = ({
  config = DEFAULT_WHATSAPP_CONFIG
}) => {
  const [isOpenPrompt, setIsOpenPrompt] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Auto-show a gentle tooltip prompt after 4 seconds if not closed
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasInteracted) {
        setIsOpenPrompt(true);
      }
    }, 4500);
    return () => clearTimeout(timer);
  }, [hasInteracted]);

  if (!config.enabled) return null;

  // Sanitize phone number (strip spaces, dashes, plus signs)
  const cleanPhone = config.phoneNumber.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(config.defaultMessage || 'Hello HybridJobs Support!');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

  const handleOpenWhatsApp = () => {
    setHasInteracted(true);
    setIsOpenPrompt(false);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const positionClass = config.position === 'bottom-left' 
    ? 'left-4 sm:left-7' 
    : 'right-4 sm:right-7';

  // Responsive size calculation
  const mobileBtn = config.mobileSize === 'compact' ? 'w-12 h-12' : config.mobileSize === 'large' ? 'w-16 h-16' : 'w-14 h-14';
  const desktopBtn = config.desktopSize === 'compact' ? 'sm:w-14 sm:h-14' : config.desktopSize === 'large' ? 'sm:w-20 sm:h-20' : 'sm:w-16 sm:h-16';
  const buttonSizeClass = `${mobileBtn} ${desktopBtn}`;

  const mobileIcon = config.iconSize === 'compact' ? 'w-5 h-5' : config.iconSize === 'large' ? 'w-7 h-7' : (config.mobileSize === 'compact' ? 'w-6 h-6' : 'w-7 h-7');
  const desktopIcon = config.iconSize === 'compact' ? 'sm:w-6 sm:h-6' : config.iconSize === 'large' ? 'sm:w-10 sm:h-10' : (config.desktopSize === 'large' ? 'sm:w-10 sm:h-10' : config.desktopSize === 'compact' ? 'sm:w-7 sm:h-7' : 'sm:w-8 sm:h-8');
  const iconSizeClass = `${mobileIcon} ${desktopIcon}`;

  const bubbleWidthClass = config.bubbleSize === 'compact'
    ? 'w-60 sm:w-72 p-2.5 sm:p-3'
    : config.bubbleSize === 'large'
    ? 'w-72 sm:w-96 p-4 sm:p-5'
    : 'w-64 sm:w-80 p-3 sm:p-4';

  return (
    <div 
      id="whatsapp-sticky-container"
      className={`fixed bottom-4 sm:bottom-6 ${positionClass} z-[9990] flex flex-col items-end pointer-events-auto select-none`}
    >
      {/* Floating Interactive Speech Bubble Prompt */}
      {isOpenPrompt && (
        <div 
          id="whatsapp-prompt-bubble"
          className={`mb-2.5 sm:mb-3 ${bubbleWidthClass} bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl shadow-2xl text-slate-100 animate-bounce-subtle relative`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpenPrompt(false);
              setHasInteracted(true);
            }}
            className="absolute top-2 right-2 p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>

          <div className="flex items-start space-x-2.5 sm:space-x-3">
            <div className="relative shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs sm:text-sm">
                💬
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
            </div>

            <div className="flex-1 pr-3 sm:pr-4 min-w-0">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="text-xs font-black text-white truncate">{config.agentName}</span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                  {config.badgeText || 'HR Support'}
                </span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 mb-1.5 sm:mb-2">{config.supportHoursText}</div>
              
              <p className="text-[10px] sm:text-[11px] text-slate-300 leading-snug bg-slate-950/60 p-2 sm:p-2.5 rounded-xl border border-slate-800">
                "{config.bubblePromptText || 'Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!'}"
              </p>

              <button
                onClick={handleOpenWhatsApp}
                className="mt-2 sm:mt-2.5 w-full py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] sm:text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{config.ctaText || 'Start WhatsApp Chat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Sticky WhatsApp Circular Button */}
      <div className="relative group">
        {/* Pulsing Aura */}
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full blur-sm opacity-70 group-hover:opacity-100 animate-pulse transition duration-300" />

        <button
          id="whatsapp-sticky-button"
          onClick={() => {
            if (isOpenPrompt) {
              handleOpenWhatsApp();
            } else {
              setIsOpenPrompt(true);
            }
          }}
          title="Chat on WhatsApp"
          className={`relative flex items-center justify-center ${buttonSizeClass} rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/20`}
        >
          {/* Lucide MessageCircle WhatsApp Icon */}
          <MessageCircle className={`${iconSizeClass} stroke-[2.2] drop-shadow-md`} />

          {/* Active Online Notification Badge */}
          {(config.unreadCount === undefined || config.unreadCount > 0) && (
            <span className="absolute top-0 right-0 flex h-3.5 w-3.5 sm:h-4 sm:w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 bg-emerald-400 border-2 border-slate-900 items-center justify-center text-[7px] sm:text-[8px] font-black text-slate-950">
                {config.unreadCount || 1}
              </span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
