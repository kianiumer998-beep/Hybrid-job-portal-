import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Sparkles, Send, CheckCircle2, PhoneCall } from 'lucide-react';

export interface WhatsAppSupportConfig {
  enabled: boolean;
  phoneNumber: string;       // e.g. "923001234567" or "+92 300 1234567"
  defaultMessage: string;    // e.g. "Hello! I need help with Hybrid Remote Jobs & ATS Resume Builder."
  agentName: string;         // e.g. "Sarah (HR Career Advisor)"
  supportHoursText: string;  // e.g. "Online • 9:00 AM - 9:00 PM PKT"
  position: 'bottom-right' | 'bottom-left';
}

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppSupportConfig = {
  enabled: true,
  phoneNumber: '923001234567',
  defaultMessage: 'Hello! I need assistance regarding job applications and career alerts on HybridJobs.pk.',
  agentName: 'Ayesha (Career Advisor)',
  supportHoursText: 'Online • 9:00 AM - 9:00 PM PKT',
  position: 'bottom-right'
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
    ? 'left-5 sm:left-7' 
    : 'right-5 sm:right-7';

  return (
    <div 
      id="whatsapp-sticky-container"
      className={`fixed bottom-6 ${positionClass} z-[9990] flex flex-col items-end pointer-events-auto select-none`}
    >
      {/* Floating Interactive Speech Bubble Prompt */}
      {isOpenPrompt && (
        <div 
          id="whatsapp-prompt-bubble"
          className="mb-3 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-4 shadow-2xl text-slate-100 animate-bounce-subtle relative"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpenPrompt(false);
              setHasInteracted(true);
            }}
            className="absolute top-2.5 right-2.5 p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
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
                <span className="text-xs font-black text-white">{config.agentName}</span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                  HR Support
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mb-2">{config.supportHoursText}</div>
              
              <p className="text-[11px] text-slate-300 leading-snug bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                "Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!"
              </p>

              <button
                onClick={handleOpenWhatsApp}
                className="mt-2.5 w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Start WhatsApp Chat</span>
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
          className="relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/20"
        >
          {/* Lucide MessageCircle WhatsApp Icon */}
          <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2] drop-shadow-md" />

          {/* Active Online Notification Badge */}
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-slate-900 items-center justify-center text-[8px] font-black text-slate-950">
              1
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};
