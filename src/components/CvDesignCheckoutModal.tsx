import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Lock, Smartphone, Upload, Wallet, X } from 'lucide-react';
import { api } from '../services/api';
import { PublicPaymentMethodConfig, PublicPaymentSettings } from '../types/adminPayment';

interface CvDesignCheckoutModalProps {
  isOpen: boolean;
  templateId: string;
  templateName: string;
  pricePkr: number;
  walletBalance: number;
  currentUser: { id: string; name?: string; email?: string; phone?: string } | null;
  onClose: () => void;
  onComplete: (result: { status: 'Success' | 'Pending'; message: string }) => void;
}

export const CvDesignCheckoutModal: React.FC<CvDesignCheckoutModalProps> = ({
  isOpen, templateId, templateName, pricePkr, walletBalance, currentUser, onClose, onComplete
}) => {
  const [settings, setSettings] = useState<PublicPaymentSettings | null>(null);
  const [checkoutPrice, setCheckoutPrice] = useState(Number(pricePkr) || 0);
  const [displayName, setDisplayName] = useState(templateName);
  const [priceReady, setPriceReady] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('Wallet Balance');
  const [senderName, setSenderName] = useState(currentUser?.name || '');
  const [senderPhone, setSenderPhone] = useState(currentUser?.phone || '');
  const [transactionId, setTransactionId] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setError('');
    setSuccessMessage('');
    setCheckoutPrice(Number(pricePkr) || 0);
    setDisplayName(templateName);
    setPriceReady(false);
    setTransactionId('');
    setProofNote('');
    setScreenshot('');
    setCustomValues({});
    setSenderName(currentUser?.name || '');
    setSenderPhone(currentUser?.phone || '');
    setLoadingSettings(true);
    api.pricing.get().then((res) => {
      if (!active) return;
      const cv = res?.success ? res?.pricing?.cvBuilder : null;
      if (!cv) { setError('Current CV pricing could not be confirmed. Please try again.'); return; }
      let latestPrice = 0;
      if (templateId === 'export:pdf') latestPrice = Number(cv.pdfExportPkr ?? cv.standardPdfExportPkr ?? 0);
      else if (templateId === 'export:ats') latestPrice = Number(cv.atsTextExportPkr || 0);
      else {
        const selected = Array.isArray(cv.templates) ? cv.templates.find((item: any) => item?.id === templateId) : null;
        if (!selected || selected.enabled === false || selected.free === true) { setError('This CV design is no longer available for one-time purchase.'); return; }
        latestPrice = Number(selected.pricePkr || 0);
        setDisplayName(String(selected.name || templateName));
      }
      if (!Number.isFinite(latestPrice) || latestPrice <= 0) { setError('The administrator has not configured a valid one-time price for this item.'); return; }
      setCheckoutPrice(latestPrice);
      setPriceReady(true);
    }).catch(() => {
      if (active) setError('Current CV pricing could not be confirmed. Please try again.');
    });
    api.paymentSettings.get().then((res) => {
      if (!active) return;
      const next = res?.success && res?.configured && res?.settings?.methods ? res.settings as PublicPaymentSettings : null;
      setSettings(next);
      const enabled = next ? Object.values(next.methods || {}).filter((method: any) => method?.enabled && method.accountTitle && method.accountNumber) : [];
      const defaultMethod = next?.defaultMethod && enabled.some((method: any) => method.id === next.defaultMethod)
        ? next.defaultMethod
        : (enabled[0] as any)?.id;
      setSelectedMethod(Number(walletBalance) >= Number(checkoutPrice || pricePkr) ? 'Wallet Balance' : (defaultMethod || 'Wallet Balance'));
    }).catch(() => {
      if (active) setSettings(null);
    }).finally(() => {
      if (active) setLoadingSettings(false);
    });
    return () => { active = false; };
  }, [isOpen, templateId, templateName, walletBalance, pricePkr, currentUser?.id]);

  const manualMethods = useMemo(() => settings
    ? Object.values(settings.methods || {}).filter((method: any) => method?.enabled && method.accountTitle && method.accountNumber) as PublicPaymentMethodConfig[]
    : [], [settings]);
  const activeMethod = manualMethods.find((method) => method.id === selectedMethod) || null;
  const hasWallet = Number.isFinite(Number(walletBalance)) && Number(walletBalance) >= Number(checkoutPrice);

  const handleScreenshot = (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt image must be 5 MB or smaller.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG and WebP receipt images are accepted.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshot(reader.result);
        setError('');
      }
    };
    reader.onerror = () => setError('Could not read the receipt image.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!currentUser?.id) {
      setError('Please sign in before purchasing a CV design.');
      return;
    }
    if (!templateId || !priceReady || !Number.isFinite(Number(checkoutPrice)) || Number(checkoutPrice) <= 0) {
      setError('This design does not have a valid one-time price.');
      return;
    }
    const walletPayment = selectedMethod === 'Wallet Balance';
    if (walletPayment && !hasWallet) {
      setError('Your wallet balance is insufficient. Select a manual payment method or add funds to your wallet.');
      return;
    }
    if (!walletPayment) {
      if (!activeMethod) {
        setError('Select an enabled payment method.');
        return;
      }
      if (activeMethod.transactionIdRequired && !transactionId.trim()) {
        setError(`Please enter ${activeMethod.transactionIdLabel || 'the Transaction ID'}.`);
        return;
      }
      if (activeMethod.screenshotRequired && !screenshot) {
        setError('Please upload your payment receipt.');
        return;
      }
      if (!transactionId.trim() && !screenshot) {
        setError('Please provide a Transaction ID or receipt screenshot.');
        return;
      }
      if (activeMethod.senderNameRequired && !senderName.trim()) {
        setError('Please enter the sender name.');
        return;
      }
      if (activeMethod.senderPhoneRequired && !senderPhone.trim()) {
        setError('Please enter the sender phone/account number.');
        return;
      }
      if (activeMethod.proofNoteRequired && !proofNote.trim()) {
        setError('Please enter the required payment note.');
        return;
      }
      for (const field of activeMethod.customFields || []) {
        if (field.required && !String(customValues[field.id] || '').trim()) {
          setError(`Please complete the required field: ${field.label}.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const result = await api.transactions.submit({
        currency: 'PKR',
        type: 'CV Design Purchase',
        paymentMethod: selectedMethod,
        cvTemplateId: templateId,
        expectedAmount: checkoutPrice,
        ...(walletPayment ? {} : {
          transactionId: transactionId.trim() || undefined,
          senderName: senderName.trim() || currentUser.name || 'Customer',
          senderPhoneOrAccount: senderPhone.trim() || undefined,
          proofScreenshotUrl: screenshot || undefined,
          proofNote: proofNote.trim() || undefined,
          customFieldValues: customValues
        }),
        userName: currentUser.name,
        userEmail: currentUser.email,
        idempotencyKey: `cv-design-${currentUser.id}-${templateId}-${Date.now()}`
      });
      if (!result?.success || !result?.transaction) {
        if (result?.transaction?.status === 'Success' || /already own|already been purchased/i.test(String(result?.message || ''))) {
          onComplete({ status: 'Success', message: 'This CV item is already unlocked on your account.' });
          onClose();
          return;
        }
        if (result?.transaction?.status === 'Pending' || /awaiting verification/i.test(String(result?.message || ''))) {
          onComplete({ status: 'Pending', message: 'A payment for this CV item is already awaiting administrator verification.' });
          onClose();
          return;
        }
        setError(result?.message || 'Payment could not be submitted. Please try again.');
        return;
      }
      if (result.transaction.status === 'Success') {
        onComplete({ status: 'Success', message: 'Payment completed. This CV design is now unlocked for your account.' });
        onClose();
        return;
      }
      if (result.transaction.status === 'Pending') {
        onComplete({ status: 'Pending', message: 'Payment proof submitted. This CV design will unlock after the administrator verifies your payment.' });
        onClose();
        return;
      }
      setError(result.message || 'The payment did not complete. Please check your transaction status.');
    } catch (err: any) {
      setError(err?.message || 'Payment service is temporarily unavailable.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="cv-design-checkout-title">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div><h2 id="cv-design-checkout-title" className="text-lg font-black text-white">Unlock CV Design</h2><p className="mt-1 text-xs text-slate-400">One-time payment · No recurring subscription</p></div>
          <button type="button" onClick={onClose} aria-label="Close checkout" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-white">{displayName}</p><p className="mt-1 text-[11px] text-slate-400">Permanent access to this design on your account</p></div><p className="whitespace-nowrap text-lg font-black text-emerald-300">PKR {Number(checkoutPrice).toLocaleString('en-PK')}</p></div>
            <p className="mt-3 text-xs text-slate-400">Wallet balance: <strong className="text-white">PKR {Number(walletBalance || 0).toLocaleString('en-PK')}</strong></p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Choose payment method</p>
            <button type="button" onClick={() => setSelectedMethod('Wallet Balance')} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selectedMethod === 'Wallet Balance' ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-800 bg-slate-900'}`}>
              <span className="flex items-center gap-3"><Wallet className="h-5 w-5 text-emerald-300" /><span><strong className="block text-sm text-white">Wallet Balance</strong><small className="text-[11px] text-slate-400">{hasWallet ? 'Pay instantly from your account wallet' : 'Insufficient balance — add wallet funds or use another method'}</small></span></span>
              <span className="text-xs font-bold text-slate-300">{hasWallet ? 'Available' : 'Low balance'}</span>
            </button>
            {loadingSettings && <p className="text-xs text-slate-500">Loading enabled payment methods…</p>}
            {manualMethods.map((method) => <button key={method.id} type="button" onClick={() => setSelectedMethod(method.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selectedMethod === method.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-800 bg-slate-900'}`}>
              <span className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-indigo-300" /><span><strong className="block text-sm text-white">{method.name}</strong><small className="text-[11px] text-slate-400">Submit receipt for administrator verification</small></span></span>
              {selectedMethod === method.id && <CheckCircle2 className="h-4 w-4 text-indigo-300" />}
            </button>)}
            {!loadingSettings && manualMethods.length === 0 && !hasWallet && <p className="text-xs text-amber-300">No manual payment methods are currently available. Please add funds to your wallet or contact support.</p>}
          </div>

          {selectedMethod !== 'Wallet Balance' && activeMethod && (
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div><h3 className="text-sm font-bold text-white">Payment instructions</h3><p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{activeMethod.instructions}</p><div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"><p><span className="text-slate-500">Account title: </span><strong className="text-white">{activeMethod.accountTitle}</strong></p><p><span className="text-slate-500">Account number: </span><strong className="text-white">{activeMethod.accountNumber}</strong></p>{activeMethod.bankName && <p><span className="text-slate-500">Bank: </span><strong className="text-white">{activeMethod.bankName}</strong></p>}{activeMethod.iban && <p><span className="text-slate-500">IBAN: </span><strong className="text-white">{activeMethod.iban}</strong></p>}</div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-slate-400">Sender name {activeMethod.senderNameRequired && <span className="text-rose-400">*</span>}<input value={senderName} onChange={(e) => setSenderName(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400">Sender phone/account {activeMethod.senderPhoneRequired && <span className="text-rose-400">*</span>}<input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400 sm:col-span-2">{activeMethod.transactionIdLabel || 'Transaction ID'} {activeMethod.transactionIdRequired && <span className="text-rose-400">*</span>}<input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} maxLength={160} placeholder={activeMethod.transactionIdPlaceholder || 'Enter payment reference'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400 sm:col-span-2">{activeMethod.screenshotLabel || 'Payment receipt screenshot'} {activeMethod.screenshotRequired && <span className="text-rose-400">*</span>}<span className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-3 text-slate-300"><Upload className="h-4 w-4" /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleScreenshot(e.target.files?.[0])} className="min-w-0 text-xs" /></span>{screenshot && <small className="text-emerald-300">Receipt image attached</small>}</label>
                <label className="text-xs text-slate-400 sm:col-span-2">{activeMethod.proofNoteLabel || 'Payment note'} {activeMethod.proofNoteRequired && <span className="text-rose-400">*</span>}<textarea value={proofNote} onChange={(e) => setProofNote(e.target.value)} maxLength={1000} rows={2} placeholder={activeMethod.proofNotePlaceholder || 'Optional note'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
                {(activeMethod.customFields || []).map((field) => <label key={field.id} className="text-xs text-slate-400">{field.label} {field.required && <span className="text-rose-400">*</span>}<input type={field.type === 'number' ? 'number' : 'text'} value={customValues[field.id] || ''} onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.id]: e.target.value }))} placeholder={field.placeholder || ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />{field.helpText && <small className="text-slate-500">{field.helpText}</small>}</label>)}
              </div>
            </div>
          )}

          {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
          {successMessage && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{successMessage}</div>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-900">Cancel</button>
            <button type="submit" disabled={submitting || loadingSettings || !priceReady || (selectedMethod === 'Wallet Balance' && !hasWallet)} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedMethod === 'Wallet Balance' ? <Wallet className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              {submitting ? 'Processing…' : selectedMethod === 'Wallet Balance' ? `Pay PKR ${Number(pricePkr).toLocaleString('en-PK')}` : 'Submit Payment Proof'}
            </button>
          </div>
          <p className="flex items-center justify-center gap-1 text-[10px] text-slate-500"><Lock className="h-3 w-3" /> Payment is validated by the server. Pending manual payments do not unlock the design.</p>
        </form>
      </div>
    </div>
  );
};
