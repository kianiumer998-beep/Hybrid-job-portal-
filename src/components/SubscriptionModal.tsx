import React, { useState } from 'react';
import { X, CheckCircle2, Sparkles, Phone, Mail, ShieldCheck, Zap, Lock, CreditCard, ArrowRight } from 'lucide-react';
import { Subscriber } from '../types/job';
import { api } from '../services/api';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribeSuccess: (subscriberData: Subscriber) => void;
  initialSelectedJobTitle?: string;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscribeSuccess,
  initialSelectedJobTitle
}) => {
  const [plan, setPlan] = useState<'Pro Alerts' | 'VIP Jobseeker'>('Pro Alerts');
  const [paymentMethod, setPaymentMethod] = useState<'Easypaisa' | 'JazzCash' | 'Bank Transfer' | 'Card'>('JazzCash');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [trxId, setTrxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setErrorMessage('Please fill out your Name, Phone (WhatsApp), and Email.');
      return;
    }

    setIsSubmitting(true);
    const amountPaid = plan === 'Pro Alerts' ? 300 : 800;
    const finalTrxId = trxId.trim() || `SUB-${Date.now().toString(36).toUpperCase()}`;

    try {
      // 1. Submit real transaction to backend
      const txRes = await api.transactions.submit({
        amount: amountPaid,
        currency: 'PKR',
        type: `Subscription: ${plan}`,
        paymentMethod,
        transactionId: finalTrxId,
        senderName: name.trim(),
        senderPhoneOrAccount: phone.trim(),
        userEmail: email.trim(),
        userName: name.trim(),
        jobTitleRef: initialSelectedJobTitle || undefined,
        idempotencyKey: `sub-${email.trim().toLowerCase()}-${Date.now()}`
      });

      if (txRes && (txRes.success || txRes.transaction)) {
        const newSub: Subscriber = {
          id: 'sub-' + Date.now(),
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          plan,
          paymentMethod,
          amountPaid,
          currency: 'PKR',
          status: 'Active',
          subscribedAt: new Date().toISOString(),
          whatsappEnabled: true
        };

        setIsSubmitting(false);
        setSuccessState(true);

        setTimeout(() => {
          onSubscribeSuccess(newSub);
        }, 1500);
      } else {
        setErrorMessage(txRes?.message || 'Could not record payment. Please check details and try again.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing payment transaction.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Top Header */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
            <Zap className="w-3.5 h-3.5" />
            <span>Instant WhatsApp & Direct Apply Unlock</span>
          </div>

          <h2 className="text-2xl font-black text-white leading-snug">
            {initialSelectedJobTitle ? (
              <>
                Unlock Instant Apply for <span className="text-emerald-400">{initialSelectedJobTitle}</span>
              </>
            ) : (
              'Get WhatsApp Job Alerts & Direct Application Access'
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Subscribe once to receive daily verified remote & hybrid job openings directly on WhatsApp and apply instantly with 1-click.
          </p>
        </div>

        {/* Success Confirmation Animation */}
        {successState ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-extrabold text-white">Payment Confirmed!</h3>
            <p className="text-sm text-slate-300">
              Welcome to <strong>Pro Alert Subscribers</strong>. Direct application unlocked and WhatsApp alerts activated for <span className="text-emerald-400">{phone}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* Package Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Select Subscription Package
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setPlan('Pro Alerts')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    plan === 'Pro Alerts'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">Pro Jobseeker</span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">Popular</span>
                  </div>
                  <div className="text-xl font-black text-emerald-400">PKR 300 <span className="text-xs font-normal text-slate-400">/ mo</span></div>
                  <ul className="mt-2 text-[11px] space-y-1 text-slate-300">
                    <li className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Instant WhatsApp Alerts</span>
                    </li>
                    <li className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Direct HR Apply Unlocked</span>
                    </li>
                  </ul>
                </div>

                <div
                  onClick={() => setPlan('VIP Jobseeker')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    plan === 'VIP Jobseeker'
                      ? 'bg-indigo-500/10 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">VIP Executive</span>
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold">Priority</span>
                  </div>
                  <div className="text-xl font-black text-indigo-400">PKR 800 <span className="text-xs font-normal text-slate-400">/ mo</span></div>
                  <ul className="mt-2 text-[11px] space-y-1 text-slate-300">
                    <li className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                      <span>Recruiter Priority Routing</span>
                    </li>
                    <li className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                      <span>Free Premium CV Unlocked</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Select Payment Method
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'JazzCash', name: 'JazzCash' },
                  { id: 'Easypaisa', name: 'Easypaisa' },
                  { id: 'Bank Transfer', name: 'Bank Account' },
                  { id: 'Card', name: 'Debit/Credit' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition-all ${
                      paymentMethod === m.id
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Account Instructions Box */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              {paymentMethod === 'JazzCash' && (
                <p>Send <strong>PKR {plan === 'Pro Alerts' ? 300 : 800}</strong> to JazzCash Account: <strong className="text-emerald-400">0300-1234567</strong> (Title: HybridJobs PK)</p>
              )}
              {paymentMethod === 'Easypaisa' && (
                <p>Send <strong>PKR {plan === 'Pro Alerts' ? 300 : 800}</strong> to Easypaisa Account: <strong className="text-emerald-400">0345-9876543</strong> (Title: HybridJobs PK)</p>
              )}
              {paymentMethod === 'Bank Transfer' && (
                <p>Transfer to Meezan Bank IBAN: <strong className="text-emerald-400">PK88MEZN00012345678901</strong></p>
              )}
              {paymentMethod === 'Card' && (
                <p>Instant secure checkout via Visa/Mastercard processing gateway.</p>
              )}
            </div>

            {/* Input Details */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {errorMessage}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Muhammad Ali"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">WhatsApp Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ali@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Transaction Reference ID / Card TRX (Optional)
                </label>
                <input
                  type="text"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="e.g. TRX-998231 or 6-digit TID"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Processing Payment Simulation...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-slate-950" />
                  <span>Activate Pro Subscription (PKR {plan === 'Pro Alerts' ? 300 : 800})</span>
                  <ArrowRight className="w-4 h-4 text-slate-950 ml-1" />
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-500 flex items-center justify-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Instant activation. Cancel anytime via WhatsApp support.</span>
            </p>

          </form>
        )}

      </div>
    </div>
  );
};
