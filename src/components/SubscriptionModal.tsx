import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  Zap,
  Lock,
  CreditCard,
  ArrowRight,
  Upload,
  Image as ImageIcon,
  Receipt,
  AlertCircle
} from 'lucide-react';
import { Subscriber, UserAccount } from '../types/job';
import { api } from '../services/api';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribeSuccess: (subscriberData: Subscriber) => void;
  initialSelectedJobTitle?: string;
  currentUser?: UserAccount | null;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscribeSuccess,
  initialSelectedJobTitle,
  currentUser
}) => {
  const [plan, setPlan] = useState<'Pro Alerts' | 'VIP Jobseeker'>('Pro Alerts');
  const [paymentMethod, setPaymentMethod] = useState<'Easypaisa' | 'JazzCash' | 'Bank Transfer' | 'Card'>('JazzCash');
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [trxId, setTrxId] = useState('');
  const [proofScreenshotUrl, setProofScreenshotUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTx, setSubmittedTx] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Receipt screenshot file size must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofScreenshotUrl(reader.result);
        setErrorMessage('');
      }
    };
    reader.readAsDataURL(file);
  };

  const getDepositAccountDetails = () => {
    switch (paymentMethod) {
      case 'JazzCash':
        return {
          title: 'JazzCash Mobile Account',
          account: '0300-1234567',
          accountTitle: 'HybridJobs PK (Official)',
          note: 'Dial *786# or use JazzCash app to transfer fee and save the 11-digit TID receipt.'
        };
      case 'Easypaisa':
        return {
          title: 'Easypaisa Direct Wallet',
          account: '0345-9876543',
          accountTitle: 'HybridJobs PK (Official)',
          note: 'Send via Easypaisa mobile app and copy the 11-digit Transaction ID.'
        };
      case 'Bank Transfer':
        return {
          title: 'Meezan Bank Raast / IBAN',
          account: 'PK88MEZN00012345678901',
          accountTitle: 'Hybrid Job Portal PVT LTD',
          note: '1Link / Raast inter-bank fund transfer. Keep your bank confirmation receipt.'
        };
      case 'Card':
        return {
          title: 'Visa / Mastercard Processing',
          account: 'Direct Merchant Settlement',
          accountTitle: 'Secure Card Deposit Desk',
          note: 'Submit your card payment confirmation code / bank SMS reference.'
        };
      default:
        return {
          title: 'Payment Channel',
          account: 'HybridJobs Official Account',
          accountTitle: 'HybridJobs PK',
          note: 'Submit your deposit slip or transaction reference.'
        };
    }
  };

  const depositDetails = getDepositAccountDetails();
  const amountPaid = plan === 'Pro Alerts' ? 300 : 800;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim() || !phone.trim() || !email.trim()) {
      setErrorMessage('Please fill out your Full Name, Phone (WhatsApp), and Email address.');
      return;
    }

    if (!trxId.trim() && !proofScreenshotUrl) {
      setErrorMessage('Please provide either the Transaction ID (TID) or upload a Payment Receipt Screenshot.');
      return;
    }

    setIsSubmitting(true);
    const finalTrxId = trxId.trim() || `SUB-${Date.now().toString(36).toUpperCase()}`;

    try {
      // Submit payment transaction with explicit Pending status for manual admin verification
      const txRes = await api.transactions.submit({
        amount: amountPaid,
        currency: 'PKR',
        type: 'Subscription',
        plan,
        paymentMethod,
        transactionId: finalTrxId,
        senderName: name.trim(),
        senderPhoneOrAccount: phone.trim(),
        depositBankOrWalletName: `${depositDetails.title}: ${depositDetails.account}`,
        proofScreenshotUrl: proofScreenshotUrl.trim() || undefined,
        proofNote: proofNote.trim() || undefined,
        userId: currentUser?.id || undefined,
        userEmail: email.trim(),
        userName: name.trim(),
        jobTitleRef: initialSelectedJobTitle || undefined,
        idempotencyKey: `sub-${email.trim().toLowerCase()}-${Date.now()}`
      });

      if (txRes && txRes.success && txRes.transaction) {
        // Business rule: All manual payments enter 'Pending' status awaiting administrator verification
        const newSub: Subscriber = {
          id: txRes.transaction.id || ('sub-' + Date.now()),
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          plan,
          paymentMethod,
          amountPaid: Number(txRes.transaction.amount) || amountPaid,
          currency: 'PKR',
          status: 'Pending', // Pending manual admin verification
          subscribedAt: new Date().toISOString(),
          whatsappEnabled: true,
          transactionRef: txRes.transaction.transactionId || finalTrxId
        };

        setSubmittedTx(txRes.transaction);
        setIsSubmitting(false);
        onSubscribeSuccess(newSub);
      } else {
        setErrorMessage(txRes?.message || 'Could not record payment. Please check your details and try again.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error submitting payment transaction.');
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

        {/* Pending Verification Confirmation Screen */}
        {submittedTx ? (
          <div className="p-8 text-center space-y-5 animate-in fade-in">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/40">
              <Clock className="w-9 h-9 animate-pulse" />
            </div>

            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold mb-2">
                <span>Verification Pending • تصدیق زیر التواء</span>
              </div>
              <h3 className="text-2xl font-black text-white">Payment Proof Submitted</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto leading-relaxed">
                Thank you, <strong className="text-white">{name}</strong>. Your payment submission for <strong className="text-emerald-400">{plan}</strong> has been securely logged and is pending manual review by an administrator.
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300 text-left space-y-2.5 max-w-md mx-auto">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Transaction ID (TID):</span>
                <code className="font-mono font-bold text-amber-300">{submittedTx.transactionId || trxId}</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Review Status:</span>
                <span className="font-bold text-amber-400 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending Admin Verification</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Package & Fee:</span>
                <span className="font-bold text-white">{plan} (PKR {amountPaid})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Payment Gateway:</span>
                <span className="font-bold text-white">{paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">WhatsApp Alert Number:</span>
                <span className="font-bold text-emerald-400">{phone}</span>
              </div>

              {proofScreenshotUrl && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-400 block mb-1.5 text-[11px] font-semibold">Attached Payment Proof:</span>
                  <div className="max-h-32 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center p-1">
                    <img
                      src={proofScreenshotUrl}
                      alt="Submitted Receipt Proof"
                      className="max-h-28 rounded-lg object-contain mx-auto"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
              <div className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Our administration team verifies payments against official statements. Your WhatsApp alerts and premium apply features will be activated immediately upon admin approval.
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSubmittedTx(null);
                  onClose();
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
              >
                Done & Return to Portal
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            
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
                  { id: 'Bank Transfer', name: 'Bank Raast' },
                  { id: 'Card', name: 'Card / Slip' }
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
              <div className="flex items-center justify-between font-bold text-amber-300 mb-1">
                <span>{depositDetails.title}</span>
                <span className="text-emerald-400 font-mono text-sm">PKR {amountPaid}</span>
              </div>
              <div className="text-slate-300">
                Deposit to: <strong className="text-emerald-400 font-mono font-bold text-sm select-all">{depositDetails.account}</strong>
              </div>
              <div className="text-slate-400 text-[11px]">
                Account Title: <span className="text-white font-semibold">{depositDetails.accountTitle}</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                {depositDetails.note}
              </p>
            </div>

            {/* Input Details */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
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
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Transaction ID & Receipt Proof Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Bank / Wallet TID Reference
                  </label>
                  <input
                    type="text"
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="e.g. JC-8829103 or 11-digit TID"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Upload Screenshot Proof
                  </label>
                  <label className="flex items-center justify-center space-x-2 px-3 py-2 bg-slate-950 border border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer text-xs text-slate-300 transition-colors">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span className="truncate">{proofScreenshotUrl ? 'Replace Screenshot' : 'Attach Receipt Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Screenshot Preview if Attached */}
              {proofScreenshotUrl && (
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={proofScreenshotUrl}
                      alt="Receipt preview"
                      className="w-12 h-12 object-cover rounded-lg border border-slate-700"
                    />
                    <div className="text-xs">
                      <span className="text-emerald-400 font-bold block">Payment Receipt Attached</span>
                      <span className="text-[10px] text-slate-500">Ready for admin verification</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofScreenshotUrl('')}
                    className="text-xs text-rose-400 hover:text-rose-300 p-1 rounded"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Optional Note for Administrator
                </label>
                <input
                  type="text"
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="e.g. Paid from JazzCash account registered to Muhammad Ali"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Recording Payment Proof...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-slate-950" />
                  <span>Submit Payment Proof for Verification (PKR {amountPaid})</span>
                  <ArrowRight className="w-4 h-4 text-slate-950 ml-1" />
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-500 flex items-center justify-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>All payments require manual admin review and approval prior to activation.</span>
            </p>

          </form>
        )}

      </div>
    </div>
  );
};
