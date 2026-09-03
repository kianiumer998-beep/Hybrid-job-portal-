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
  onApproveTransaction: (transactionId: string, note?: string) => void;
  onRejectTransaction: (transactionId: string, reason: string) => void;
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
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Success' | 'Failed'>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [methodFilter, setMethodFilter] = useState<string>('All');

  // Selected Transaction for Detail / Screenshot Modal
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
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
      if (statusFilter !== 'All' && tx.status !== statusFilter) return false;

      // Type
      if (typeFilter !== 'All' && tx.type !== typeFilter) return false;

      // Method
      if (methodFilter !== 'All' && tx.paymentMethod !== methodFilter) return false;

      return true;
    });
  }, [transactions, searchQuery, statusFilter, typeFilter, methodFilter]);

  // Summary Metrics
  const stats = useMemo(() => {
    const pending = transactions.filter(t => t.status === 'Pending');
    const approved = transactions.filter(t => t.status === 'Success');
    const rejected = transactions.filter(t => t.status === 'Failed');
    const totalVolumePkr = approved.reduce((acc, t) => acc + (t.currency === 'PKR' ? t.amount : t.amount * 278), 0);
    const pendingVolumePkr = pending.reduce((acc, t) => acc + (t.currency === 'PKR' ? t.amount : t.amount * 278), 0);

    return {
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      totalVolumePkr,
      pendingVolumePkr
    };
  }, [transactions]);

  const handleCopyTid = (tid: string) => {
    navigator.clipboard.writeText(tid);
    setCopiedTid(true);
    setTimeout(() => setCopiedTid(false), 2000);
  };

  const handleApprove = (tx: PaymentTransaction) => {
    onApproveTransaction(tx.id, 'Verified and approved by admin');
    if (selectedTx?.id === tx.id) {
      setSelectedTx(prev => prev ? { ...prev, status: 'Success' } : null);
    }
  };

  const handleConfirmReject = (tx: PaymentTransaction) => {
    if (!rejectReason.trim()) return;
    onRejectTransaction(tx.id, rejectReason);
    setShowRejectBox(false);
    setRejectReason('');
    if (selectedTx?.id === tx.id) {
      setSelectedTx(prev => prev ? { ...prev, status: 'Failed', rejectionReason: rejectReason } : null);
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-center col-span-2 sm:col-span-1">
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
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-amber-500"
            >
              <option value="All">All Verification Statuses</option>
              <option value="Pending">⏳ Pending Verification Only ({stats.pendingCount})</option>
              <option value="Success">✅ Approved & Verified ({stats.approvedCount})</option>
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
              <option value="Job Posting Fee">Job Posting Fee</option>
              <option value="Ad Campaign Fee">Ad Campaign Placement</option>
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
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black text-slate-200 uppercase tracking-wider">
              Submitted Payments & Deposit Proofs
            </span>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {filteredTransactions.length} records
            </span>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Receipt className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
            <div className="text-sm font-bold text-slate-400">No payment submissions found matching filters</div>
            <p className="text-xs text-slate-500">Try adjusting your search criteria or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4">Submission / Date</th>
                  <th className="p-4">User / Sender</th>
                  <th className="p-4">Service & Reference</th>
                  <th className="p-4">Amount & Method</th>
                  <th className="p-4">TID / Slip</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTransactions.map((tx) => {
                  const isPending = tx.status === 'Pending';
                  const isApproved = tx.status === 'Success';
                  const isRejected = tx.status === 'Failed';

                  return (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isPending ? 'bg-amber-500/5' : ''
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
                          tx.type === 'Wallet Deposit' 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : tx.type === 'Job Posting Fee'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : tx.type === 'Ad Campaign Fee'
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
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center space-x-1 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                                title="Approve & Credit Balance"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedTx(tx);
                                  setShowRejectBox(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
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
                      <span className="text-slate-500 block text-[10px]">Status</span>
                      <span className={`font-black ${
                        selectedTx.status === 'Success' ? 'text-emerald-400' : selectedTx.status === 'Pending' ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {selectedTx.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Payment Channel</span>
                      <span className="font-bold text-white">{selectedTx.paymentMethod}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Submission Time</span>
                      <span className="font-bold text-white">{selectedTx.dateTime}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Sender Name / Phone</span>
                      <span className="font-bold text-white">
                        {selectedTx.senderName || selectedTx.userName || 'N/A'} {selectedTx.senderPhoneOrAccount ? `(${selectedTx.senderPhoneOrAccount})` : ''}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">User Account Email</span>
                      <span className="font-bold text-slate-300">{selectedTx.userEmail || 'N/A'}</span>
                    </div>
                  </div>

                  {selectedTx.transactionId && (
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-bold mb-1">Official Bank/Wallet TID / Reference No.</div>
                      <div className="flex items-center justify-between">
                        <code className="text-xs font-mono font-black text-amber-300">{selectedTx.transactionId}</code>
                        <button
                          onClick={() => handleCopyTid(selectedTx.transactionId!)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 flex items-center space-x-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedTid ? 'Copied!' : 'Copy TID'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedTx.proofNote && (
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold mb-1">User Note:</span>
                      <p className="text-xs text-slate-300 italic">"{selectedTx.proofNote}"</p>
                    </div>
                  )}

                  {selectedTx.rejectionReason && (
                    <div className="bg-rose-950/40 p-3 rounded-xl border border-rose-500/30 text-rose-300">
                      <span className="text-[10px] font-bold block mb-1">Rejection Reason:</span>
                      <p className="text-xs">{selectedTx.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {/* Right: Screenshot Viewer / Proof */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-200 uppercase tracking-wider">
                      Payment Screenshot Proof (رسید کی تصویر)
                    </span>
                    {selectedTx.proofScreenshotUrl && (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.2))}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.2))}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Zoom In"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRotation(prev => (prev + 90) % 360)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Rotate"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedTx.proofScreenshotUrl ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-center min-h-[260px] max-h-[360px] overflow-auto relative">
                      <img
                        src={selectedTx.proofScreenshotUrl}
                        alt="Payment Receipt Proof"
                        className="rounded-xl shadow-lg transition-transform duration-200 max-w-full"
                        style={{
                          transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-950 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500 space-y-2">
                      <FileText className="w-10 h-10 mx-auto text-slate-600" />
                      <div className="text-xs font-bold text-slate-400">No screenshot image attached</div>
                      <p className="text-[11px] text-slate-500">
                        Payment was submitted via automated direct channel or manual TID reference.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Input Box if triggered */}
              {showRejectBox && (
                <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 space-y-3 animate-in fade-in">
                  <div className="text-xs font-black text-rose-300">Enter Rejection Reason for Candidate / Employer:</div>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Transaction ID was not found in bank statement, or amount is insufficient."
                    className="w-full bg-slate-950 border border-rose-500/30 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
                  />
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => setShowRejectBox(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleConfirmReject(selectedTx)}
                      disabled={!rejectReason.trim()}
                      className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-xs font-black"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                Review carefully before approving financial transactions.
              </span>

              <div className="flex items-center space-x-3">
                {selectedTx.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => setShowRejectBox(true)}
                      className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Submission</span>
                    </button>

                    <button
                      onClick={() => handleApprove(selectedTx)}
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shadow-xl shadow-emerald-500/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Credit Balance</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
