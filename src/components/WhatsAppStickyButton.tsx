import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export interface WhatsAppSupportConfig {
  enabled: boolean;
  phoneNumber: string;       // e.g. "923001234567" or "+92 300 1234567"
  defaultMessage: string;    // e.g. "Hello! I need help with Hybrid Remote Jobs & ATS Resume Builder."
  agentName: string;         // e.g. "Sarah (HR Career Advisor)"
  supportHoursText: string;  // e.g. "Online • 9:00 AM - 9:00 PM PKT"
  position: 'bottom-right' | 'bottom-left';
  showGreetingBubble?: boolean;
  greetingText?: string;
  mobileSize?: 'compact' | 'standard' | 'large';
  desktopSize?: 'compact' | 'standard' | 'large';
  iconSize?: 'compact' | 'standard' | 'large';
  bubbleSize?: 'compact' | 'standard' | 'large';
  autoShowDelaySeconds?: number;
  showOnlineBadge?: boolean;
  greetingCtaText?: string;
  enablePulseAnimation?: boolean;
}

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppSupportConfig = {
  enabled: true,
  phoneNumber: '923001234567',
  defaultMessage: 'Hello! I need assistance regarding job applications and career alerts on HybridJobs.pk.',
  agentName: 'Ayesha (Career Advisor)',
  supportHoursText: 'Online • 9:00 AM - 9:00 PM PKT',
  position: 'bottom-right',
  showGreetingBubble: true,
  greetingText: 'Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!',
  mobileSize: 'standard',
  desktopSize: 'standard',
  iconSize: 'standard',
  bubbleSize: 'standard',
  autoShowDelaySeconds: 4.5,
  showOnlineBadge: true,
  greetingCtaText: 'Start WhatsApp Chat',
  enablePulseAnimation: true
};

interface WhatsAppStickyButtonProps {
  config?: WhatsAppSupportConfig;
  onOpenLegalModal?: () => void;
}

const getMobileButtonClass = (size?: string) => {
  switch (size) {
    case 'compact': return 'w-12 h-12';
    case 'large': return 'w-16 h-16';
    case 'standard':
    default: return 'w-14 h-14';
  }
};

const getDesktopButtonClass = (size?: string) => {
  switch (size) {
    case 'compact': return 'sm:w-14 sm:h-14';
    case 'large': return 'sm:w-20 sm:h-20';
    case 'standard':
    default: return 'sm:w-16 sm:h-16';
  }
};

const getIconSizeClass = (size?: string) => {
  switch (size) {
    case 'compact': return 'w-5 h-5 sm:w-6 sm:h-6';
    case 'large': return 'w-8 h-8 sm:w-10 sm:h-10';
    case 'standard':
    default: return 'w-7 h-7 sm:w-8 sm:h-8';
  }
};

const getBubbleSizeClass = (size?: string) => {
  switch (size) {
    case 'compact': return 'w-64 sm:w-72 p-3 text-[10px]';
    case 'large': return 'w-80 sm:w-96 p-5 text-xs';
    case 'standard':
    default: return 'w-72 sm:w-80 p-4 text-[11px]';
  }
};

export const WhatsAppStickyButton: React.FC<WhatsAppStickyButtonProps> = ({
  config = DEFAULT_WHATSAPP_CONFIG
}) => {
  const [isOpenPrompt, setIsOpenPrompt] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const showGreeting = config.showGreetingBubble !== false;
  const autoShowDelayMs = (config.autoShowDelaySeconds ?? DEFAULT_WHATSAPP_CONFIG.autoShowDelaySeconds ?? 4.5) * 1000;
  const showBadge = config.showOnlineBadge !== false;
  const showPulse = config.enablePulseAnimation !== false;
  const ctaButtonText = config.greetingCtaText || DEFAULT_WHATSAPP_CONFIG.greetingCtaText || 'Start WhatsApp Chat';

  // Auto-show tooltip prompt after configured delay seconds if greeting bubble enabled and not interacted
  useEffect(() => {
    if (!showGreeting) return;
    const timer = setTimeout(() => {
      if (!hasInteracted) {
        setIsOpenPrompt(true);
      }
    }, autoShowDelayMs);
    return () => clearTimeout(timer);
  }, [hasInteracted, showGreeting, autoShowDelayMs]);

  if (!config.enabled) return null;

  // Sanitize phone number (strip spaces, dashes, plus signs)
  const cleanPhone = (config.phoneNumber || DEFAULT_WHATSAPP_CONFIG.phoneNumber).replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(config.defaultMessage || DEFAULT_WHATSAPP_CONFIG.defaultMessage);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

  const handleOpenWhatsApp = () => {
    setHasInteracted(true);
    setIsOpenPrompt(false);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const positionClass = config.position === 'bottom-left' 
    ? 'left-5 sm:left-7' 
    : 'right-5 sm:right-7';

  const buttonSizeClasses = `${getMobileButtonClass(config.mobileSize)} ${getDesktopButtonClass(config.desktopSize)}`;
  const iconSizeClass = getIconSizeClass(config.iconSize);
  const bubbleSizeClass = getBubbleSizeClass(config.bubbleSize);
  const visibleGreetingText = config.greetingText || DEFAULT_WHATSAPP_CONFIG.greetingText;

  return (
    <div 
      id="whatsapp-sticky-container"
      className={`fixed bottom-6 ${positionClass} z-[9990] flex flex-col items-end pointer-events-auto select-none`}
    >
      {/* Floating Interactive Speech Bubble Prompt */}
      {showGreeting && isOpenPrompt && (
        <div 
          id="whatsapp-prompt-bubble"
          className={`mb-3 ${bubbleSizeClass} bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl shadow-2xl text-slate-100 animate-bounce-subtle relative`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpenPrompt(false);
              setHasInteracted(true);
            }}
            className="absolute top-2.5 right-2.5 p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-start space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
                💬
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
            </div>

            <div className="flex-1 pr-4">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-black text-white">{config.agentName || DEFAULT_WHATSAPP_CONFIG.agentName}</span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                  HR Support
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mb-2">{config.supportHoursText || DEFAULT_WHATSAPP_CONFIG.supportHoursText}</div>
              
              <p className="text-[11px] text-slate-300 leading-snug bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                "{visibleGreetingText}"
              </p>

              <button
                onClick={handleOpenWhatsApp}
                className="mt-2.5 w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{ctaButtonText}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Sticky WhatsApp Circular Button */}
      <div className="relative group">
        {/* Pulsing Aura */}
        {showPulse && (
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full blur-sm opacity-70 group-hover:opacity-100 animate-pulse transition duration-300" />
        )}

        <button
          id="whatsapp-sticky-button"
          onClick={() => {
            if (!showGreeting) {
              handleOpenWhatsApp();
            } else if (isOpenPrompt) {
              handleOpenWhatsApp();
            } else {
              setIsOpenPrompt(true);
            }
          }}
          title="Chat on WhatsApp"
          className={`relative flex items-center justify-center ${buttonSizeClasses} rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/20`}
        >
          {/* Lucide MessageCircle WhatsApp Icon */}
          <MessageCircle className={`${iconSizeClass} stroke-[2.2] drop-shadow-md`} />

          {/* Active Online Notification Badge */}
          {showBadge && (
            <span className="absolute top-0 right-0 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-slate-900 items-center justify-center text-[8px] font-black text-slate-950">
                1
              </span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
