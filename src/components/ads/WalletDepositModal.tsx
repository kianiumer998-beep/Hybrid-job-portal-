import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { PublicPaymentMethodConfig, PublicPaymentSettings } from '../../types/adminPayment';

interface WalletDepositPayload {
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  proofScreenshotUrl?: string;
  senderName?: string;
  senderPhoneOrAccount?: string;
  depositBankOrWalletName?: string;
  proofNote?: string;
  requestedPlanId?: string;
}

export interface AttachedDepositPlan {
  id: string;
  name: string;
  pricePkr: number;
  durationDays: number;
}

interface WalletDepositModalProps {
  isOpen: boolean;
  initialAmount: number;
  minDefaultDepositPkr?: number;
  attachedPlan?: AttachedDepositPlan | null;
  currentWalletBalance?: number;
  onBackToPlans?: () => void;
  onClose: () => void;
  onDepositWallet: (
    depositData: WalletDepositPayload
  ) => Promise<{ success: boolean; transaction?: any; message?: string } | boolean | void> | void;
}

type DepositStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<DepositStep, string> = {
  1: 'Payment Method',
  2: 'Select Amount',
  3: 'Send Payment',
  4: 'Submit Proof'
};

function extractEnabledPaymentMethods(
  settings: PublicPaymentSettings | null
): Array<[string, PublicPaymentMethodConfig]> {
  if (!settings || !settings.isConfigured || !settings.methods) return [];

  const result: Array<[string, PublicPaymentMethodConfig]> = [];
  const seenIds = new Set<string>();

  const isValidMethod = (m: any): m is PublicPaymentMethodConfig =>
    Boolean(
      m &&
        m.enabled &&
        typeof m.accountTitle === 'string' &&
        m.accountTitle.trim().length > 0 &&
        typeof m.accountNumber === 'string' &&
        m.accountNumber.trim().length > 0
    );

  for (const [key, method] of Object.entries(settings.methods)) {
    if (!method) continue;
    const normId = String(method.id || key).trim().toLowerCase();
    if (!normId || seenIds.has(normId)) continue;
    seenIds.add(normId);
    if (isValidMethod(method)) {
      result.push([key, method]);
    }
  }

  if (Array.isArray(settings.customMethods)) {
    for (const cm of settings.customMethods) {
      if (!cm || !cm.id) continue;
      const normId = String(cm.id).trim().toLowerCase();
      if (!normId || seenIds.has(normId)) continue;
      seenIds.add(normId);
      if (isValidMethod(cm)) {
        result.push([cm.id, cm]);
      }
    }
  }

  return result;
}

export const WalletDepositModal: React.FC<WalletDepositModalProps> = ({
  isOpen,
  initialAmount,
  minDefaultDepositPkr = 500,
  attachedPlan = null,
  currentWalletBalance = 0,
  onBackToPlans,
  onClose,
  onDepositWallet
}) => {
  const [step, setStep] = useState<DepositStep>(1);
  const [serverPaymentSettings, setServerPaymentSettings] = useState<PublicPaymentSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(false);

  const [selectedMethodKey, setSelectedMethodKey] = useState<string>('');
  const [amountInput, setAmountInput] = useState<number>(initialAmount || minDefaultDepositPkr);

  const [senderName, setSenderName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [txRef, setTxRef] = useState<string>('');
  const [proofScreenshotUrl, setProofScreenshotUrl] = useState<string>('');
  const [proofNote, setProofNote] = useState<string>('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const [copiedField, setCopiedField] = useState<'account' | 'iban' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confirmedTx, setConfirmedTx] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    setStep(1);
    setSelectedMethodKey('');
    setAmountInput(initialAmount || minDefaultDepositPkr);
    setSenderName('');
    setSenderPhone('');
    setTxRef('');
    setProofScreenshotUrl('');
    setProofNote('');
    setCustomFieldValues({});
    setCopiedField(null);
    setError(null);
    setIsSubmitting(false);
    setIsSuccess(false);
    setConfirmedTx(null);
    setIsLoadingSettings(true);

    api.paymentSettings
      .get()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && res.configured && res.settings && res.settings.methods) {
          setServerPaymentSettings(res.settings);
        } else {
          setServerPaymentSettings(null);
        }
      })
      .catch(() => {
        if (isMounted) setServerPaymentSettings(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSettings(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialAmount, minDefaultDepositPkr]);

  const enabledMethods = useMemo(
    () => extractEnabledPaymentMethods(serverPaymentSettings),
    [serverPaymentSettings]
  );

  const selectedMethod: PublicPaymentMethodConfig | null = useMemo(() => {
    if (!selectedMethodKey) return null;
    const found = enabledMethods.find(([k]) => k === selectedMethodKey);
    return found ? found[1] : null;
  }, [enabledMethods, selectedMethodKey]);

  const activeFixedAmounts = useMemo(
    () => (selectedMethod?.walletDepositFixedAmounts || []).filter((item) => item.enabled),
    [selectedMethod]
  );
  const customAmountAllowed = selectedMethod?.walletDepositAllowCustomAmount !== false;
  const minAmount = selectedMethod?.walletDepositMinimumAmount ?? minDefaultDepositPkr;
  const maxAmount = selectedMethod?.walletDepositMaximumAmount;

  const sortedCustomFields = useMemo(() => {
    if (!selectedMethod?.customFields?.length) return [];
    return [...selectedMethod.customFields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [selectedMethod]);

  if (!isOpen) return null;

  const handleClose = () => {
    setError(null);
    setIsSuccess(false);
    setConfirmedTx(null);
    onClose();
  };

  const safeWalletBalance = Number.isFinite(Number(currentWalletBalance))
    ? Math.max(0, Number(currentWalletBalance))
    : 0;
  const planShortfall = attachedPlan
    ? Math.max(0, Math.round(attachedPlan.pricePkr - safeWalletBalance))
    : 0;

  const handleSelectMethod = (key: string, method: PublicPaymentMethodConfig) => {
    setSelectedMethodKey(key);
    setCustomFieldValues({});
    setError(null);

    const fixed = (method.walletDepositFixedAmounts || [])
      .filter((item) => item.enabled)
      .sort((a, b) => a.amount - b.amount);
    const allowCustom = method.walletDepositAllowCustomAmount !== false;
    const methodMin = method.walletDepositMinimumAmount ?? minDefaultDepositPkr;
    const methodMax = method.walletDepositMaximumAmount;
    const targetInitial = attachedPlan && planShortfall > 0 ? planShortfall : initialAmount;

    if (!allowCustom) {
      if (fixed.length > 0) {
        const coveringFixed = fixed.find((item) => item.amount >= targetInitial);
        const exactFixed = fixed.find((item) => item.amount === targetInitial);
        setAmountInput(
          exactFixed
            ? exactFixed.amount
            : coveringFixed
            ? coveringFixed.amount
            : fixed[fixed.length - 1].amount
        );
      } else {
        setAmountInput(0);
      }
    } else {
      let nextAmount = targetInitial || methodMin;
      if (fixed.length > 0 && !fixed.some((item) => item.amount === nextAmount)) {
        const validDefault = nextAmount >= methodMin && (methodMax === undefined || nextAmount <= methodMax);
        if (!validDefault) {
          const coveringFixed = fixed.find((item) => item.amount >= targetInitial);
          nextAmount = coveringFixed ? coveringFixed.amount : fixed[0].amount;
        }
      } else {
        if (nextAmount < methodMin) nextAmount = methodMin;
        if (methodMax !== undefined && nextAmount > methodMax) nextAmount = methodMax;
      }
      setAmountInput(nextAmount);
    }

    setStep(2);
  };

  const validateAmountForSelectedMethod = (): string | null => {
    if (!selectedMethod) {
      return 'Please select a payment method first.';
    }
    if (!customAmountAllowed && activeFixedAmounts.length === 0) {
      return `No deposit amounts are currently enabled for ${selectedMethod.name}. Please choose another method.`;
    }
    const isFixedSelection = activeFixedAmounts.some((item) => item.amount === amountInput);
    if (!customAmountAllowed && !isFixedSelection) {
      return 'Please select one of the available fixed deposit amounts.';
    }
    if (!Number.isSafeInteger(amountInput) || amountInput <= 0) {
      return 'Deposit amount must be a valid whole PKR amount.';
    }
    if (!isFixedSelection && amountInput < minAmount) {
      return `Minimum deposit for ${selectedMethod.name} is PKR ${minAmount.toLocaleString()}.`;
    }
    if (!isFixedSelection && maxAmount !== undefined && amountInput > maxAmount) {
      return `Maximum deposit for ${selectedMethod.name} is PKR ${maxAmount.toLocaleString()}.`;
    }
    return null;
  };

  const handleProceedToInstructions = () => {
    const amountErr = validateAmountForSelectedMethod();
    if (amountErr) {
      setError(amountErr);
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleCopyText = async (value: string, field: 'account' | 'iban') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 1800);
    } catch {
      // Clipboard fallback not strictly needed; text remains select-all
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofScreenshotUrl(reader.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedMethod) {
      setError('Payment channel unavailable. Please select a method again.');
      setStep(1);
      return;
    }

    const amountErr = validateAmountForSelectedMethod();
    if (amountErr) {
      setError(amountErr);
      setStep(2);
      return;
    }

    if (selectedMethod.senderNameRequired && !senderName.trim()) {
      setError(`Please enter ${selectedMethod.senderNameLabel || 'Sender Name'}.`);
      return;
    }
    if (selectedMethod.senderPhoneRequired && !senderPhone.trim()) {
      setError(`Please enter ${selectedMethod.senderPhoneLabel || 'Sender Account / Phone'}.`);
      return;
    }
    if (selectedMethod.transactionIdRequired && !txRef.trim()) {
      setError(`Please enter ${selectedMethod.transactionIdLabel || 'Transaction ID (TID)'}.`);
      return;
    }
    if (selectedMethod.screenshotRequired && !proofScreenshotUrl) {
      setError(`Please upload ${selectedMethod.screenshotLabel || 'Receipt Screenshot'}.`);
      return;
    }
    if (selectedMethod.proofNoteRequired && !proofNote.trim()) {
      setError(`Please enter ${selectedMethod.proofNoteLabel || 'Deposit Note'}.`);
      return;
    }

    for (const cf of sortedCustomFields) {
      const val = (customFieldValues[cf.id] || '').trim();
      if (cf.required && !val) {
        setError(`Please enter required field "${cf.label}".`);
        return;
      }
    }

    if (!txRef.trim() && !proofScreenshotUrl) {
      setError('Please enter Transaction ID or upload a receipt screenshot.');
      return;
    }

    setIsSubmitting(true);
    try {
      const depositAccountDesc = `${selectedMethod.name}: ${selectedMethod.accountNumber}${
        selectedMethod.bankName ? ` (${selectedMethod.bankName})` : ''
      }`;

      const customDetails =
        sortedCustomFields.length > 0
          ? sortedCustomFields
              .map((f) => {
                const rawVal = (customFieldValues[f.id] || '').trim();
                const cleanLabel = f.label.replace(/[:\r\n]+/g, ' ').trim();
                const cleanVal = rawVal.replace(/[\r\n]+/g, ' ').trim();
                return `${cleanLabel}: ${cleanVal || 'N/A'}`;
              })
              .join('\n')
          : '';

      const cleanUserNote = proofNote.replace(/--- Custom Proof Details ---/gi, '').trim();
      const effectiveProofNote = [
        cleanUserNote ? `User Note: ${cleanUserNote}` : '',
        customDetails ? `--- Custom Proof Details ---\n${customDetails}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      const res = await onDepositWallet({
        amount: amountInput,
        paymentMethod: selectedMethod.name,
        transactionId: txRef.trim() || undefined,
        proofScreenshotUrl: proofScreenshotUrl || undefined,
        senderName: senderName.trim() || undefined,
        senderPhoneOrAccount: senderPhone.trim() || undefined,
        depositBankOrWalletName: depositAccountDesc,
        proofNote: effectiveProofNote.trim() || undefined,
        ...(attachedPlan?.id ? { requestedPlanId: attachedPlan.id } : {})
      });

      if (res && typeof res === 'object' && (res as any).success) {
        setConfirmedTx((res as any).transaction || { id: txRef.trim() || 'Pending', amount: amountInput });
        setIsSuccess(true);
      } else if (res && typeof res === 'object' && (res as any).success === false) {
        setError((res as any).message || 'Failed to submit wallet deposit proof.');
      } else if (res === false) {
        setError('Failed to submit wallet deposit proof.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error submitting wallet deposit proof.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Deposit Wallet Funds"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-5 max-w-md w-full shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto space-y-3.5">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
              {isSuccess ? 'Deposit Submitted' : 'Deposit Funds'}
            </h3>
            {!isSuccess && (
              <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                Step {step} of 4 · {STEP_LABELS[step]}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close deposit modal"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {isSuccess && confirmedTx ? (
          <div className="space-y-3.5 py-1">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Deposit Proof Received</div>
                <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                  {attachedPlan
                    ? `Once admin verifies this deposit, your wallet is credited and "${attachedPlan.name}" activates automatically if total balance covers PKR ${attachedPlan.pricePkr.toLocaleString()}.`
                    : 'Wallet will be credited after admin verification.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800/80 text-xs">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-400 text-[11px]">Reference</span>
                <code className="font-mono font-bold text-amber-300 text-[11px]">
                  {confirmedTx.transactionId || confirmedTx.id || txRef || 'Pending'}
                </code>
              </div>
              {attachedPlan && (
                <div className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className="text-slate-400 text-[11px]">Selected Plan</span>
                  <span className="font-semibold text-indigo-300 text-[11px] truncate">
                    {attachedPlan.name} (PKR {attachedPlan.pricePkr.toLocaleString()})
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-400 text-[11px]">Method</span>
                <span className="font-semibold text-white text-[11px]">{selectedMethod?.name}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-400 text-[11px]">Amount</span>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  PKR {amountInput.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-400 text-[11px]">Status</span>
                <span className="font-semibold text-amber-300 flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3" />
                  <span>Pending Review</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : isLoadingSettings ? (
          <div className="py-8 text-center space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400" />
            <p className="text-xs text-slate-400">Loading payment methods...</p>
          </div>
        ) : !serverPaymentSettings || !serverPaymentSettings.isConfigured || enabledMethods.length === 0 ? (
          <div className="space-y-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Deposit Unavailable</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-snug">
                No receiving payment accounts are currently enabled by the administrator. Please check back later.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Compact 4-Step Segmented Progress Bar */}
            <div className="grid grid-cols-4 gap-1.5" aria-label="Deposit progress">
              {([1, 2, 3, 4] as DepositStep[]).map((s) => {
                const isDone = step > s;
                const isCurrent = step === s;
                const canJump = isDone && (s === 1 || Boolean(selectedMethod));
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!canJump}
                    onClick={() => {
                      if (!canJump) return;
                      setError(null);
                      setStep(s);
                    }}
                    title={STEP_LABELS[s]}
                    className={`h-1.5 rounded-full transition-colors ${
                      isCurrent
                        ? 'bg-emerald-400'
                        : isDone
                        ? 'bg-emerald-600/80 hover:bg-emerald-500 cursor-pointer'
                        : 'bg-slate-800 cursor-default'
                    }`}
                  />
                );
              })}
            </div>

            {attachedPlan && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-[11px]">
                <div className="min-w-0">
                  <span className="text-indigo-300 font-semibold block truncate">
                    Plan: {attachedPlan.name}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    Wallet: PKR {safeWalletBalance.toLocaleString()}
                    {planShortfall > 0 ? ` · Needed: PKR ${planShortfall.toLocaleString()}` : ' · Wallet covers plan'}
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                  PKR {attachedPlan.pricePkr.toLocaleString()}
                </span>
              </div>
            )}

            {/* STEP 1: CHOOSE PAYMENT METHOD */}
            {step === 1 && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-300 font-medium">
                  Choose a payment method to continue:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {enabledMethods.map(([key, method]) => {
                    const fixedCount = (method.walletDepositFixedAmounts || []).filter((a) => a.enabled).length;
                    const allowCustom = method.walletDepositAllowCustomAmount !== false;
                    const mMin = method.walletDepositMinimumAmount ?? minDefaultDepositPkr;
                    const isDefault = serverPaymentSettings.defaultMethod?.toLowerCase() === key.toLowerCase();

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectMethod(key, method)}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          selectedMethodKey === key
                            ? 'bg-emerald-500/10 border-emerald-400 text-white'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-600 text-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <span>{method.name}</span>
                            {isDefault && (
                              <span className="text-[10px] font-medium text-emerald-400">· Default</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {method.bankName
                              ? method.bankName
                              : fixedCount > 0 && !allowCustom
                              ? `${fixedCount} preset amounts`
                              : `Min PKR ${mMin.toLocaleString()}`}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>

                {onBackToPlans && (
                  <div className="pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={onBackToPlans}
                      className="text-[11px] text-slate-400 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Back to Membership &amp; Plans</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: SELECT AMOUNT FOR CHOSEN METHOD */}
            {step === 2 && selectedMethod && (
              <div className="space-y-3">
                {/* Method Context Bar */}
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                  <span className="text-slate-400 truncate">
                    Method: <strong className="text-white">{selectedMethod.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold shrink-0 cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                {/* Preset Amounts (if enabled by admin for this method) */}
                {activeFixedAmounts.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Select Amount (PKR)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {activeFixedAmounts.map((item) => (
                        <button
                          key={item.amount}
                          type="button"
                          onClick={() => {
                            setAmountInput(item.amount);
                            setError(null);
                          }}
                          className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold font-mono tabular-nums transition-colors cursor-pointer ${
                            amountInput === item.amount
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          {item.amount.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Amount Input (if allowed by admin for this method) */}
                {customAmountAllowed ? (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      {activeFixedAmounts.length > 0 ? 'Or custom amount (PKR)' : 'Enter deposit amount (PKR)'}
                    </label>
                    <input
                      type="number"
                      min={minAmount}
                      max={maxAmount}
                      step="1"
                      value={amountInput || ''}
                      onChange={(e) => {
                        setAmountInput(parseInt(e.target.value, 10) || 0);
                        setError(null);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-emerald-400 font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                      Min PKR {minAmount.toLocaleString()}
                      {maxAmount !== undefined ? ` · Max PKR ${maxAmount.toLocaleString()}` : ''}
                    </p>
                  </div>
                ) : activeFixedAmounts.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300">
                    No deposit amounts are enabled for {selectedMethod.name}. Please choose another method.
                  </div>
                ) : null}

                {attachedPlan && amountInput > 0 && (
                  <div className={`p-2 rounded-lg border text-[11px] tabular-nums ${
                    safeWalletBalance + amountInput >= attachedPlan.pricePkr
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    {safeWalletBalance + amountInput >= attachedPlan.pricePkr
                      ? `After approval: PKR ${(safeWalletBalance + amountInput).toLocaleString()} total · Activates "${attachedPlan.name}" automatically (PKR ${(safeWalletBalance + amountInput - attachedPlan.pricePkr).toLocaleString()} stays in wallet).`
                      : `After approval: PKR ${(safeWalletBalance + amountInput).toLocaleString()} credited to wallet · PKR ${(attachedPlan.pricePkr - (safeWalletBalance + amountInput)).toLocaleString()} more needed to activate "${attachedPlan.name}".`}
                  </div>
                )}

                {error && (
                  <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[11px] text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToInstructions}
                    disabled={!customAmountAllowed && activeFixedAmounts.length === 0}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <span>Next: Account Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: RECEIVING ACCOUNT DETAILS */}
            {step === 3 && selectedMethod && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                  <span className="text-slate-300 truncate">
                    {selectedMethod.name} ·{' '}
                    <strong className="text-emerald-400 font-mono tabular-nums">
                      PKR {amountInput.toLocaleString()}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(2);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold shrink-0 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                {/* Single clean structural container with hairline dividers */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-[11px] font-semibold text-amber-300">
                      Send Exact Amount To
                    </span>
                    <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                      PKR {amountInput.toLocaleString()}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {selectedMethod.bankName && (
                      <div className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-400 shrink-0">Bank</span>
                        <span className="font-semibold text-white text-right truncate">
                          {selectedMethod.bankName}
                        </span>
                      </div>
                    )}

                    <div className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-400 shrink-0">Account Title</span>
                      <span className="font-semibold text-white text-right truncate">
                        {selectedMethod.accountTitle}
                      </span>
                    </div>

                    <div className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-400 shrink-0">Account No.</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-emerald-400 select-all truncate">
                          {selectedMethod.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(selectedMethod.accountNumber, 'account')}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {copiedField === 'account' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {selectedMethod.iban && (
                      <div className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-400 shrink-0">IBAN / Raast</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-indigo-300 select-all truncate text-[10px]">
                            {selectedMethod.iban}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(selectedMethod.iban!, 'iban')}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            {copiedField === 'iban' ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedMethod.instructions && (
                    <p className="text-[11px] text-slate-400 pt-1.5 border-t border-slate-800 leading-snug">
                      {selectedMethod.instructions}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(2);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(4);
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>I Sent Payment · Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SUBMIT PAYMENT PROOF DETAILS */}
            {step === 4 && selectedMethod && (
              <form onSubmit={handleSubmitProof} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                  <span className="text-slate-300 truncate">
                    {selectedMethod.name} ·{' '}
                    <strong className="text-emerald-400 font-mono tabular-nums">
                      PKR {amountInput.toLocaleString()}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(3);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold shrink-0 cursor-pointer"
                  >
                    Account
                  </button>
                </div>

                {(selectedMethod.formTitle || selectedMethod.formSubtitle) && (
                  <div className="text-[11px] text-slate-300">
                    {selectedMethod.formTitle && (
                      <div className="font-bold text-white">{selectedMethod.formTitle}</div>
                    )}
                    {selectedMethod.formSubtitle && (
                      <div className="text-slate-400 text-[10px]">{selectedMethod.formSubtitle}</div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      {selectedMethod.senderNameLabel || 'Sender Name'}
                      {selectedMethod.senderNameRequired && ' *'}
                    </label>
                    <input
                      type="text"
                      required={selectedMethod.senderNameRequired}
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Account holder name"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      {selectedMethod.senderPhoneLabel || 'Sender Number'}
                      {selectedMethod.senderPhoneRequired && ' *'}
                    </label>
                    <input
                      type="text"
                      required={selectedMethod.senderPhoneRequired}
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder={selectedMethod.senderPhonePlaceholder || '0300-1234567'}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      {selectedMethod.transactionIdLabel || 'Transaction ID (TID)'}
                      {selectedMethod.transactionIdRequired && ' *'}
                    </label>
                    <input
                      type="text"
                      required={selectedMethod.transactionIdRequired}
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder={selectedMethod.transactionIdPlaceholder || 'e.g. 11-digit TID'}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                    {selectedMethod.transactionIdHelpText && (
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {selectedMethod.transactionIdHelpText}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      {selectedMethod.screenshotLabel || 'Receipt Screenshot'}
                      {selectedMethod.screenshotRequired && ' *'}
                    </label>
                    <label className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-dashed border-slate-700 hover:border-emerald-500 rounded-lg cursor-pointer text-xs text-slate-300 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {proofScreenshotUrl ? 'Change Image' : 'Upload Receipt'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {selectedMethod.screenshotHelpText && (
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {selectedMethod.screenshotHelpText}
                      </p>
                    )}
                  </div>
                </div>

                {proofScreenshotUrl && (
                  <div className="px-2.5 py-1.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={proofScreenshotUrl}
                        alt="Payment receipt preview"
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 object-cover rounded border border-slate-700 shrink-0"
                      />
                      <span className="text-[11px] text-emerald-400 font-semibold truncate">
                        Receipt attached
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProofScreenshotUrl('')}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {sortedCustomFields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    {sortedCustomFields.map((cf) => (
                      <div key={cf.id} className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          {cf.label}
                          {cf.required && ' *'}
                        </label>
                        <input
                          type={cf.type === 'number' ? 'number' : 'text'}
                          required={cf.required}
                          value={customFieldValues[cf.id] || ''}
                          onChange={(e) =>
                            setCustomFieldValues((prev) => ({
                              ...prev,
                              [cf.id]: e.target.value
                            }))
                          }
                          placeholder={cf.placeholder || cf.label}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                        {cf.helpText && (
                          <p className="text-[10px] text-slate-500 leading-tight">{cf.helpText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    {selectedMethod.proofNoteLabel || 'Remarks (Optional)'}
                    {selectedMethod.proofNoteRequired && ' *'}
                  </label>
                  <input
                    type="text"
                    required={selectedMethod.proofNoteRequired}
                    value={proofNote}
                    onChange={(e) => setProofNote(e.target.value)}
                    placeholder={selectedMethod.proofNotePlaceholder || 'Short note if needed'}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {error && (
                  <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[11px] text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(3);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Submit (PKR {amountInput.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Credited after admin verification.</span>
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
