import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  FileText,
  ExternalLink,
  Search,
  Award,
  Filter,
  UserCheck,
  Loader2
} from 'lucide-react';
import { EmployerKycRequest } from '../../types/adminSuite';
import { api } from '../../services/api';

interface AdminEmployerKycHubProps {
  // We will load from API instead of prop
}

const isSafeUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:') || lower.startsWith('javascript:')) {
    return false;
  }
  if (trimmed.startsWith('//') || trimmed.startsWith('\\') || trimmed.startsWith('/\\') || trimmed.startsWith('///')) {
    return false;
  }

  if (lower.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  if (trimmed.startsWith('/')) {
    if (trimmed.length > 1 && (trimmed[1] === '/' || trimmed[1] === '\\')) {
      return false;
    }
    if (trimmed.includes('\\')) {
      return false;
    }
    return true;
  }

  return false;
};

export const safeKycText = (value?: unknown): string => {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

export const getKycCompanyInitial = (companyName?: unknown): string => {
  if (typeof companyName !== 'string') return 'C';
  const trimmed = companyName.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'C';
};

export const filterEmployerKycRequests = (
  requests: EmployerKycRequest[] | undefined | null,
  filterStatus: 'All' | 'Pending' | 'Verified' | 'Rejected',
  searchQuery?: string | null
): EmployerKycRequest[] => {
  const safeRequests = Array.isArray(requests)
    ? requests.filter((req): req is EmployerKycRequest => Boolean(req))
    : [];
  const q = safeKycText(searchQuery);
  return safeRequests.filter((req) => {
    if (filterStatus !== 'All' && req.status !== filterStatus) return false;
    if (q) {
      return (
        safeKycText(req.companyName).includes(q) ||
        safeKycText(req.contactPerson).includes(q) ||
        safeKycText(req.email).includes(q) ||
        safeKycText(req.ntnOrTaxNumber).includes(q)
      );
    }
    return true;
  });
};

export const AdminEmployerKycHub: React.FC<AdminEmployerKycHubProps> = () => {
  const [requests, setRequests] = useState<EmployerKycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Verified' | 'Rejected'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKyc, setSelectedKyc] = useState<EmployerKycRequest | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Check for legacy migration
        const legacy = localStorage.getItem('career_pak_kyc_requests');
        if (legacy) {
          try {
            const parsed = JSON.parse(legacy);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const res = await api.kyc.importLegacy(parsed);
              if (res.success && res.invalid === 0) {
                localStorage.removeItem('career_pak_kyc_requests');
              } else if (res.invalid > 0) {
                setError(`Some legacy records (${res.invalid}) were invalid and could not be automatically migrated. Local data has been preserved for manual review.`);
              } else {
                setError('Failed to migrate legacy records.');
              }
            }
          } catch (migErr: any) {
            setError('Error processing legacy KYC requests during migration.');
          }
        }
        
        const res = await api.kyc.getAll();
        if (res.success && Array.isArray(res.requests)) {
          setRequests(res.requests);
        } else {
          setError(res?.message || 'Failed to load requests');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load requests');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = filterEmployerKycRequests(requests, filterStatus, searchQuery);

  const handleApproveKyc = async (req: EmployerKycRequest, badge: 'Standard Verified' | 'Top Employer' | 'Government Agency') => {
    try {
      const res = await api.kyc.updateRequest(req.id, {
        status: 'Verified',
        badgeLevel: badge
      });
      if (res.success && res.request) {
        setRequests(requests.map(r => r.id === req.id ? res.request : r));
        setSelectedKyc(null);
        alert(`✅ Employer "${req.companyName || 'Employer'}" has been successfully VERIFIED with ${badge} status!`);
      } else {
        alert('Failed to approve: ' + (res?.message || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Failed to approve: ' + err.message);
    }
  };

  const handleRejectKyc = async (req: EmployerKycRequest, reason: string) => {
    try {
      const res = await api.kyc.updateRequest(req.id, {
        status: 'Rejected',
        rejectionReason: reason
      });
      if (res.success && res.request) {
        setRequests(requests.map(r => r.id === req.id ? res.request : r));
        setSelectedKyc(null);
        alert(`⛔ KYC Request for "${req.companyName || 'Employer'}" rejected. Reason logged.`);
      } else {
        alert('Failed to reject: ' + (res?.message || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Failed to reject: ' + err.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-20 text-white"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;

  return (
    <div className="space-y-6 text-white">
      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold ml-4">Dismiss</button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Enterprise KYC & Business Identity Verification</span>
          </div>
          <h2 className="text-xl font-black text-white">Employer Legitimacy & Blue Badge Verification Queue</h2>
          <p className="text-xs text-slate-400 mt-1">
            Review NTN, SECP Registration Certificates, Chamber of Commerce credentials, and official corporate domains.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
          {(['All', 'Pending', 'Verified', 'Rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterStatus === st
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st} {st === 'Pending' && `(${requests.filter(r => r.status === 'Pending').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH AND KPI BAR */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, NTN, contact person..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs font-bold">
          <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-300">
            Total Requests: <span className="text-white font-mono">{requests.length}</span>
          </span>
          <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-emerald-400">
            Verified Badges: <span className="font-mono">{requests.filter(r => r.status === 'Verified').length}</span>
          </span>
        </div>
      </div>

      {/* REQUESTS LIST */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((req) => (
          <div
            key={req.id}
            className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-4"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex items-start space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 flex items-center justify-center">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-base text-cyan-400">
                    {getKycCompanyInitial(req.companyName)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-black text-base text-white">{req.companyName || 'Unnamed Company'}</h3>
                    {req.status === 'Verified' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        <span>{req.badgeLevel}</span>
                      </span>
                    )}
                    {req.status === 'Pending' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Awaiting Verification</span>
                      </span>
                    )}
                    {req.status === 'Rejected' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>Rejected</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-0.5">
                    Contact: <span className="text-slate-200 font-semibold">{req.contactPerson || 'N/A'}</span> • {req.email || 'No email'} • {req.phone || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedKyc(req)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
                >
                  Review Docs & Audit →
                </button>

                {req.status === 'Pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApproveKyc(req, 'Top Employer')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer"
                    >
                      ✓ Approve Badge
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reason = prompt('Enter rejection reason:');
                        if (reason) handleRejectKyc(req, reason);
                      }}
                      className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl border border-rose-500/30 cursor-pointer"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Verification Metadata Tags */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">NTN / Tax ID</span>
                <span className="text-amber-400 font-bold">{req.ntnOrTaxNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">SECP Registration</span>
                <span className="text-white">{req.secpRegistrationNumber || 'Commercial Entity'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Official Website</span>
                {isSafeUrl(req.companyWebsite) ? (
                  <a
                    href={req.companyWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <span className="line-clamp-1">{req.companyWebsite.replace('https://', '').replace('http://', '')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400 font-sans italic">Not provided</span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Submitted At</span>
                <span className="text-slate-300">{req.submittedAt || 'N/A'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DETAILED KYC MODAL INSPECTOR */}
      {selectedKyc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 text-white shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">SECP / NTN Audit Inspection</span>
                <h3 className="text-lg font-black text-white mt-0.5">{selectedKyc.companyName || 'Unnamed Company'}</h3>
              </div>
              <button
                onClick={() => setSelectedKyc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase">Attached Verification Documents</span>
                {selectedKyc.officialDocUrl && isSafeUrl(selectedKyc.officialDocUrl) ? (
                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                      <div className="overflow-hidden">
                        <div className="font-bold text-white truncate max-w-xs">{selectedKyc.officialDocUrl}</div>
                        <div className="text-[10px] text-slate-500">Official Verification Document</div>
                      </div>
                    </div>
                    <a
                      href={selectedKyc.officialDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-lg border border-slate-700 inline-flex items-center space-x-1 shrink-0"
                    >
                      <span>View Document</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60 text-slate-400 text-xs italic">
                    No verification document uploaded
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleApproveKyc(selectedKyc, 'Top Employer')}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer text-xs"
                >
                  ✓ Grant Top Employer Verified Badge
                </button>

                <button
                  type="button"
                  onClick={() => handleApproveKyc(selectedKyc, 'Standard Verified')}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer text-xs"
                >
                  Grant Standard Verified Badge
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const reason = prompt('Reason for rejection:');
                    if (reason) handleRejectKyc(selectedKyc, reason);
                  }}
                  className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold rounded-xl border border-rose-500/30 cursor-pointer text-xs"
                >
                  Reject Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
