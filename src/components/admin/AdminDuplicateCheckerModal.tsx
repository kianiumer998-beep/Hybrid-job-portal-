import React, { useState } from 'react';
import { Copy, Trash2, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, X, Sparkles, Filter, Layers, ExternalLink } from 'lucide-react';
import { Job, Subscriber, UserAccount, JobPostingFeeLog } from '../../types/job';

export interface DuplicateCluster<T> {
  matchKey: string;
  reason: string;
  items: T[];
}

interface AdminDuplicateCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'jobs' | 'pending' | 'subscribers' | 'users' | 'fee-logs';
  jobClusters?: DuplicateCluster<Job>[];
  subscriberClusters?: DuplicateCluster<Subscriber>[];
  userClusters?: DuplicateCluster<UserAccount>[];
  feeLogClusters?: DuplicateCluster<JobPostingFeeLog>[];
  onResolveJobDuplicates?: (keepJobId: string, deleteJobIds: string[]) => void;
  onResolveSubscriberDuplicates?: (keepSubId: string, deleteSubIds: string[]) => void;
  onResolveUserDuplicates?: (keepUserId: string, deleteUserIds: string[]) => void;
  onBulkSelectDuplicateIds?: (ids: string[]) => void;
}

export const AdminDuplicateCheckerModal: React.FC<AdminDuplicateCheckerModalProps> = ({
  isOpen,
  onClose,
  entityType,
  jobClusters = [],
  subscriberClusters = [],
  userClusters = [],
  feeLogClusters = [],
  onResolveJobDuplicates,
  onResolveSubscriberDuplicates,
  onResolveUserDuplicates,
  onBulkSelectDuplicateIds
}) => {
  if (!isOpen) return null;

  const totalClusters =
    entityType === 'jobs' || entityType === 'pending'
      ? jobClusters.length
      : entityType === 'subscribers'
      ? subscriberClusters.length
      : entityType === 'users'
      ? userClusters.length
      : feeLogClusters.length;

  const totalDuplicateItems =
    entityType === 'jobs' || entityType === 'pending'
      ? jobClusters.reduce((acc, c) => acc + (c.items.length - 1), 0)
      : entityType === 'subscribers'
      ? subscriberClusters.reduce((acc, c) => acc + (c.items.length - 1), 0)
      : entityType === 'users'
      ? userClusters.reduce((acc, c) => acc + (c.items.length - 1), 0)
      : feeLogClusters.reduce((acc, c) => acc + (c.items.length - 1), 0);

  const handleSelectAllDuplicatesForBulk = () => {
    let duplicateIds: string[] = [];

    if (entityType === 'jobs' || entityType === 'pending') {
      jobClusters.forEach(c => {
        // Keep first, select the rest
        const dupes = c.items.slice(1).map(i => i.id);
        duplicateIds.push(...dupes);
      });
    } else if (entityType === 'subscribers') {
      subscriberClusters.forEach(c => {
        const dupes = c.items.slice(1).map(i => i.id);
        duplicateIds.push(...dupes);
      });
    } else if (entityType === 'users') {
      userClusters.forEach(c => {
        const dupes = c.items.slice(1).map(i => i.id);
        duplicateIds.push(...dupes);
      });
    }

    if (onBulkSelectDuplicateIds && duplicateIds.length > 0) {
      onBulkSelectDuplicateIds(duplicateIds);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-white animate-in fade-in zoom-in duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-white">
                  Duplicate Records Detection & Conflict Resolver
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white uppercase">
                  {totalClusters} Duplicate Clusters
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Identified {totalDuplicateItems} redundant entries matching by title, company, case number, or identity data.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTROLS BANNER */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-300">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Review candidate duplicate clusters below. You can resolve individually or select all for bulk action.</span>
          </div>

          {totalDuplicateItems > 0 && onBulkSelectDuplicateIds && (
            <button
              type="button"
              onClick={handleSelectAllDuplicatesForBulk}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-xl shadow-lg shadow-rose-500/20 cursor-pointer flex items-center space-x-1.5 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Select All {totalDuplicateItems} Duplicates in Table</span>
            </button>
          )}
        </div>

        {/* CLUSTERS CONTENT */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-xs">
          {totalClusters === 0 ? (
            <div className="p-12 text-center bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-black text-white">Clean Database — No Duplicates Detected!</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Every record in this dataset has unique identifying signatures (titles, case numbers, phone numbers, and references).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* JOBS / PENDING CLUSTERS */}
              {(entityType === 'jobs' || entityType === 'pending') &&
                jobClusters.map((cluster, cIndex) => (
                  <div
                    key={cluster.matchKey + cIndex}
                    className="p-5 bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-2xl space-y-3 transition-all shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase border border-amber-500/30">
                          {cluster.reason}
                        </span>
                        <strong className="text-white text-sm">{cluster.matchKey}</strong>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {cluster.items.length} Duplicate Versions
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {cluster.items.map((item, iIdx) => (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-xl border space-y-2 flex flex-col justify-between ${
                            iIdx === 0
                              ? 'bg-emerald-950/20 border-emerald-500/40'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                iIdx === 0
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {iIdx === 0 ? 'Primary / Oldest' : `Duplicate #${iIdx}`}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Posted: {item.postedAt || 'Recent'}
                              </span>
                            </div>

                            <h5 className="font-bold text-white text-xs">{item.title}</h5>
                            <p className="text-[11px] text-slate-400">
                              {item.company} • {item.salary} • {item.city || item.region}
                            </p>
                            {item.pdfCaseNumber && (
                              <p className="text-[10px] font-mono text-amber-300">
                                Ref: {item.pdfCaseNumber}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                            <span className="text-[10px] font-mono text-slate-500">ID: {item.id}</span>
                            {onResolveJobDuplicates && (
                              <button
                                type="button"
                                onClick={() => {
                                  const others = cluster.items.filter(it => it.id !== item.id).map(it => it.id);
                                  onResolveJobDuplicates(item.id, others);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-[10px] font-bold border border-indigo-500/30 cursor-pointer"
                              >
                                Keep This, Remove Others
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {/* SUBSCRIBERS CLUSTERS */}
              {entityType === 'subscribers' &&
                subscriberClusters.map((cluster, cIndex) => (
                  <div
                    key={cluster.matchKey + cIndex}
                    className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30">
                          {cluster.reason}
                        </span>
                        <strong className="text-white text-sm">{cluster.matchKey}</strong>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{cluster.items.length} Entries</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {cluster.items.map((sub, sIdx) => (
                        <div key={sub.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-[11px]">
                              <strong className="text-white">{sub.name}</strong>
                              <span className="text-emerald-400 font-bold">PKR {sub.amountPaid}</span>
                            </div>
                            <div className="text-slate-400 font-mono text-[11px]">{sub.phone} • {sub.email}</div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                            <span className="text-[10px] text-slate-500">{sub.subscribedAt}</span>
                            {onResolveSubscriberDuplicates && (
                              <button
                                type="button"
                                onClick={() => {
                                  const others = cluster.items.filter(it => it.id !== sub.id).map(it => it.id);
                                  onResolveSubscriberDuplicates(sub.id, others);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white text-[10px] font-bold border border-emerald-500/30 cursor-pointer"
                              >
                                Keep This Record
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {/* USER CLUSTERS */}
              {entityType === 'users' &&
                userClusters.map((cluster, cIndex) => (
                  <div
                    key={cluster.matchKey + cIndex}
                    className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-amber-400 font-bold text-xs">{cluster.reason}: {cluster.matchKey}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{cluster.items.length} Accounts</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {cluster.items.map((u) => (
                        <div key={u.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                          <strong className="text-white">{u.name}</strong>
                          <div className="text-slate-400 text-[11px]">{u.email} • {u.role}</div>
                          <div className="text-[10px] text-slate-500">Plan: {u.plan} • Status: {u.paymentStatus}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Done & Close Resolver
          </button>
        </div>
      </div>
    </div>
  );
};
