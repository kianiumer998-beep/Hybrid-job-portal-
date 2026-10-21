import React, { useState, useMemo } from 'react';
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Copy,
  ExternalLink,
  DollarSign,
  AlertTriangle,
  FileText,
  Calendar,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  X
} from 'lucide-react';
import { PaymentTransaction, Currency, UserAccount, Job } from '../../types/job';

interface AdminPaymentVerificationHubProps {
  transactions: PaymentTransaction[];
  onApproveTransaction: (transactionId: string, note?: string) => void | Promise<any>;
  onRejectTransaction: (transactionId: string, reason: string) => void | Promise<any>;
  users?: UserAccount[];
  jobs?: Job[];
}

export const AdminPaymentVerificationHub: React.FC<AdminPaymentVerificationHubProps> = ({
  transactions,
  onApproveTransaction,
  onRejectTransaction,
  users = [],
  jobs = []
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [methodFilter, setMethodFilter] = useState<string>('All');

  // Selected Transaction for Detail / Screenshot Modal
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [showApproveBox, setShowApproveBox] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [copiedTid, setCopiedTid] = useState<boolean>(false);

  // Filtered list
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTid = tx.transactionId?.toLowerCase().includes(q) || tx.id.toLowerCase().includes(q);
        const matchesUser = tx.userName?.toLowerCase().includes(q) || tx.userEmail?.toLowerCase().includes(q);
        const matchesSender = tx.senderName?.toLowerCase().includes(q) || tx.senderPhoneOrAccount?.toLowerCase().includes(q);
        const matchesRef = tx.jobTitleRef?.toLowerCase().includes(q);
        if (!matchesTid && !matchesUser && !matchesSender && !matchesRef) return false;
      }

      // Status
      if (statusFilter !== 'All' && (tx.status as string) !== statusFilter) return false;

      // Type
      if (typeFilter !== 'All' && (tx.type as string) !== typeFilter) return false;

      // Method
      if (methodFilter !== 'All' && tx.paymentMethod !== methodFilter) return false;

      return true;
    });
  }, [transactions, searchQuery, statusFilter, typeFilter, methodFilter]);

  // Summary Metrics (Ensuring VerificationUncertain is counted separately)
  const stats = useMemo(() => {
    const pending = transactions.filter(t => t.status === 'Pending');
    const approved = transactions.filter(t => t.status === 'Success');
    const rejected = transactions.filter(t => t.status === 'Failed');
    const uncertain = transactions.filter(t => (t.status as any) === 'VerificationUncertain');
    const totalVolumePkr = approved.reduce((acc, t) => acc + (t.currency === 'PKR' ? t.amount : t.amount * 278), 0);
    const pendingVolumePkr = pending.reduce((acc, t) => acc + (t.currency === 'PKR' ? t.amount : t.amount * 278), 0);

    return {
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      uncertainCount: uncertain.length,
      totalVolumePkr,
      pendingVolumePkr
    };
  }, [transactions]);

  const handleCopyTid = (tid: string) => {
    navigator.clipboard.writeText(tid);
    setCopiedTid(true);
    setTimeout(() => setCopiedTid(false), 2000);
  };

  const handleApprove = async (tx: PaymentTransaction, customNote?: string) => {
    try {
      setIsProcessing(tx.id);
      const note = customNote || approvalNote.trim() || 'Verified and approved by admin';
      await onApproveTransaction(tx.id, note);
      if (selectedTx?.id === tx.id) {
        setSelectedTx(prev => prev ? { ...prev, status: 'Success', adminNote: note } : null);
      }
      setShowApproveBox(false);
      setApprovalNote('');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleConfirmReject = async (tx: PaymentTransaction) => {
    if (!rejectReason.trim()) return;
    try {
      setIsProcessing(tx.id);
      await onRejectTransaction(tx.id, rejectReason.trim());
      setShowRejectBox(false);
      setRejectReason('');
      if (selectedTx?.id === tx.id) {
        setSelectedTx(prev => prev ? { ...prev, status: 'Failed', rejectionReason: rejectReason.trim() } : null);
      }
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Receipt className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Payment Submissions & Deposit Verification Hub
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  پیمنٹ تصدیق مرکز
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Review candidate & employer manual deposit receipts, JazzCash / EasyPaisa / Bank slips, screenshot proofs, exact dates/times, and 1-click verify balances.
              </p>
            </div>
          </div>

          {/* Quick Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-3.5 text-center">
              <div className="text-[11px] font-bold text-amber-400">Pending Review</div>
              <div className="text-xl font-black text-white mt-0.5">{stats.pendingCount}</div>
              <div className="text-[9px] text-slate-400">PKR {stats.pendingVolumePkr.toLocaleString()}</div>
            </div>

            <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-3.5 text-center">
              <div className="text-[11px] font-bold text-emerald-400">Verified & Approved</div>
              <div className="text-xl font-black text-white mt-0.5">{stats.approvedCount}</div>
              <div className="text-[9px] text-slate-400">PKR {stats.totalVolumePkr.toLocaleString()}</div>
            </div>

            <div className="bg-slate-950/70 border border-purple-500/30 rounded-2xl p-3.5 text-center">
              <div className="text-[11px] font-bold text-purple-400">Uncertain State</div>
              <div className="text-xl font-black text-white mt-0.5">{stats.uncertainCount}</div>
              <div className="text-[9px] text-slate-400">Reconciliation</div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-center">
              <div className="text-[11px] font-bold text-rose-400">Rejected</div>
              <div className="text-xl font-black text-white mt-0.5">{stats.rejectedCount}</div>
              <div className="text-[9px] text-slate-400">Action Required</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by TID, Name, Email, Job..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-amber-500"
            >
              <option value="All">All Verification Statuses</option>
              <option value="Pending">⏳ Pending Verification Only ({stats.pendingCount})</option>
              <option value="Success">✅ Approved & Verified ({stats.approvedCount})</option>
              <option value="VerificationUncertain">⚠️ Verification Uncertain ({stats.uncertainCount})</option>
              <option value="Failed">❌ Rejected Submissions ({stats.rejectedCount})</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-amber-500"
            >
              <option value="All">All Payment Types</option>
              <option value="Wallet Deposit">Wallet Balance Deposit</option>
              <option value="Job Posting">Job Posting Fee</option>
              <option value="Advertisement">Ad Campaign Placement</option>
              <option value="Subscription">VIP Alert Subscription</option>
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-amber-500"
            >
              <option value="All">All Channels (JazzCash / EasyPaisa / Bank)</option>
              <option value="JazzCash">JazzCash Mobile Wallet</option>
              <option value="Easypaisa">Easypaisa Mobile Wallet</option>
              <option value="Bank Transfer">Meezan / Alfalah / HBL Wire</option>
              <option value="Credit Card">Debit / Credit Card (Stripe)</option>
              <option value="Wallet Balance">Internal Wallet Balance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table / List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Receipt className="w-12 h-12 mx-auto text-slate-600 mb-3 stroke-[1.5]" />
            <h4 className="text-white font-bold text-base">No payment submissions found</h4>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or verification status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="p-4">Timestamp / Ref</th>
                  <th className="p-4">Customer / User</th>
                  <th className="p-4">Type & Service</th>
                  <th className="p-4">Amount & Method</th>
                  <th className="p-4">TID / Proof Slip</th>
                  <th className="p-4">Verification Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTransactions.map((tx) => {
                  const isPending = tx.status === 'Pending';
                  const isApproved = tx.status === 'Success';
                  const isRejected = tx.status === 'Failed';
                  const isUncertain = (tx.status as string) === 'VerificationUncertain';

                  return (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isPending ? 'bg-amber-500/5' : isUncertain ? 'bg-purple-500/5' : ''
                      }`}
                    >
                      {/* Date / Time */}
                      <td className="p-4">
                        <div className="font-bold text-white flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tx.dateTime}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          ID: {tx.id.slice(0, 10)}...
                        </div>
                      </td>

                      {/* User / Sender Details */}
                      <td className="p-4">
                        <div className="font-black text-slate-200">{tx.userName || tx.senderName || 'Anonymous User'}</div>
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{tx.userEmail || 'No email attached'}</span>
                        </div>
                        {tx.senderPhoneOrAccount && (
                          <div className="text-[10px] font-mono text-emerald-400 mt-0.5 flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-emerald-500" />
                            <span>Acc: {tx.senderPhoneOrAccount}</span>
                          </div>
                        )}
                      </td>

                      {/* Service & Ref */}
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          (tx.type as any) === 'Wallet Deposit' 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : (tx.type as any) === 'Job Posting'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : (tx.type as any) === 'Advertisement'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {tx.type}
                        </span>
                        {tx.jobTitleRef && (
                          <div className="text-[11px] text-slate-300 font-semibold mt-1 max-w-[200px] truncate" title={tx.jobTitleRef}>
                            Ref: {tx.jobTitleRef}
                          </div>
                        )}
                      </td>

                      {/* Amount & Method */}
                      <td className="p-4">
                        <div className="text-sm font-black text-emerald-400">
                          {tx.currency} {tx.amount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-300 font-semibold flex items-center space-x-1 mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{tx.paymentMethod}</span>
                        </div>
                      </td>

                      {/* TID & Proof Screenshot Button */}
                      <td className="p-4">
                        {tx.transactionId ? (
                          <div className="flex items-center space-x-1">
                            <code className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {tx.transactionId}
                            </code>
                            <button
                              onClick={() => handleCopyTid(tx.transactionId!)}
                              title="Copy Transaction ID"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No TID provided</span>
                        )}

                        {tx.proofScreenshotUrl && (
                          <button
                            onClick={() => {
                              setSelectedTx(tx);
                              setZoomLevel(1);
                              setRotation(0);
                            }}
                            className="mt-1.5 inline-flex items-center space-x-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Proof Image</span>
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {isApproved && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approved</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>Pending Review</span>
                          </span>
                        )}
                        {isUncertain && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <AlertTriangle className="w-3 h-3 text-purple-400" />
                            <span>Verification Uncertain</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <XCircle className="w-3 h-3" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedTx(tx);
                              setZoomLevel(1);
                              setRotation(0);
                            }}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApprove(tx)}
                                disabled={isProcessing === tx.id}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-[11px] flex items-center space-x-1 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                                title="Approve Transaction"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isProcessing === tx.id ? '...' : 'Approve'}</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedTx(tx);
                                  setShowRejectBox(true);
                                }}
                                disabled={isProcessing === tx.id}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-50 text-rose-300 border border-rose-500/30 font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                                title="Reject with Reason"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL & SCREENSHOT PROOF MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Payment Submission Inspection</h4>
                  <p className="text-xs text-slate-400">TID: {selectedTx.transactionId || selectedTx.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTx(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Transaction Metadata */}
                <div className="space-y-4 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs">
                  <div className="text-xs font-black text-amber-400 uppercase tracking-wider">
                    Transaction Details (ٹرانزیکشن تفصیلات)
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Payment Amount</span>
                      <span className="text-base font-black text-emerald-400">
                        {selectedTx.currency} {selectedTx.amount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Current Status</span>
                      <span className={`font-black ${
                        selectedTx.status === 'Success' ? 'text-emerald-400' :
                        selectedTx.status === 'Pending' ? 'text-amber-400' :
                        (selectedTx.status as string) === 'VerificationUncertain' ? 'text-purple-400' : 'text-rose-400'
                      }`}>
                        {selectedTx.status}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Sender Name / Account</span>
                      <span className="text-white font-bold">{selectedTx.senderName || selectedTx.userName || 'N/A'}</span>
                      {selectedTx.senderPhoneOrAccount && (
                        <span className="text-emerald-400 font-mono text-[11px] block">{selectedTx.senderPhoneOrAccount}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Deposit Channel</span>
                      <span className="text-white font-semibold">{selectedTx.paymentMethod || 'N/A'}</span>
                    </div>
                    {selectedTx.depositBankOrWalletName && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Target Account / Bank</span>
                        <span className="text-slate-300">{selectedTx.depositBankOrWalletName}</span>
                      </div>
                    )}
                    {selectedTx.rejectionReason && (
                      <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-rose-300">
                        <span className="block text-[10px] font-black uppercase text-rose-400">Rejection Reason</span>
                        {selectedTx.rejectionReason}
                      </div>
                    )}
                    {selectedTx.adminNote && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-300">
                        <span className="block text-[10px] font-black uppercase text-emerald-400">Admin Note</span>
                        {selectedTx.adminNote}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Proof Screenshot Viewer */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[300px]">
                  <div className="absolute top-3 left-3 text-[11px] font-black text-slate-400 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Payment Receipt / Slip Proof</span>
                  </div>

                  {selectedTx.proofScreenshotUrl ? (
                    <div className="mt-8 flex flex-col items-center w-full">
                      <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900 max-h-[320px] flex items-center justify-center w-full">
                        <img 
                          src={selectedTx.proofScreenshotUrl} 
                          alt="Payment Receipt" 
                          style={{
                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transition: 'transform 0.2s ease'
                          }}
                          className="max-h-[300px] object-contain"
                        />
                      </div>

                      {/* Image Controls */}
                      <div className="flex items-center space-x-2 mt-3 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 shadow-lg">
                        <button
                          onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Zoom In"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRotation(prev => (prev + 90) % 360)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Rotate 90deg"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <a
                          href={selectedTx.proofScreenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors"
                          title="Open Original in New Tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 py-12">
                      <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-600 stroke-[1.5]" />
                      <p className="text-xs font-bold text-slate-400">No screenshot image attached</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Verification performed using Transaction ID (TID) reference.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Status: <span className="text-white font-bold">{selectedTx.status}</span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Close Inspection
                </button>

                {selectedTx.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => {
                        handleApprove(selectedTx);
                        setSelectedTx(null);
                      }}
                      disabled={isProcessing === selectedTx.id}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isProcessing === selectedTx.id ? 'Processing...' : 'Approve Payment'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {showRejectBox && selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-black text-rose-400 flex items-center space-x-2">
                <XCircle className="w-5 h-5" />
                <span>Reject Payment Submission</span>
              </h4>
              <button
                onClick={() => {
                  setShowRejectBox(false);
                  setRejectReason('');
                }}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Please provide a clear reason for rejecting transaction <code className="font-mono text-amber-300">{selectedTx.transactionId || selectedTx.id}</code>. This will be visible to the user.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid Transaction ID (TID), mismatched deposit amount, or unverified receipt slip..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 h-28 resize-none"
            />

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowRejectBox(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>

              <button
                onClick={() => handleConfirmReject(selectedTx)}
                disabled={!rejectReason.trim() || isProcessing === selectedTx.id}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 text-xs font-black shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                {isProcessing === selectedTx.id ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
