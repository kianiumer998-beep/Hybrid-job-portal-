import React, { useState } from 'react';
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
  UserCheck
} from 'lucide-react';
import { EmployerKycRequest } from '../../types/adminSuite';
import { INITIAL_KYC_REQUESTS } from '../../data/mockAdminSuiteData';

interface AdminEmployerKycHubProps {
  kycRequests?: EmployerKycRequest[];
  onUpdateKycRequest?: (request: EmployerKycRequest) => void;
}

export const AdminEmployerKycHub: React.FC<AdminEmployerKycHubProps> = ({
  kycRequests = INITIAL_KYC_REQUESTS,
  onUpdateKycRequest
}) => {
  const [requests, setRequests] = useState<EmployerKycRequest[]>(kycRequests);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Verified' | 'Rejected'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKyc, setSelectedKyc] = useState<EmployerKycRequest | null>(null);

  const filtered = requests.filter((req) => {
    if (filterStatus !== 'All' && req.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        req.companyName.toLowerCase().includes(q) ||
        req.contactPerson.toLowerCase().includes(q) ||
        req.email.toLowerCase().includes(q) ||
        req.ntnOrTaxNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleApproveKyc = (req: EmployerKycRequest, badge: 'Standard Verified' | 'Top Employer' | 'Government Agency') => {
    const updated: EmployerKycRequest = {
      ...req,
      status: 'Verified',
      badgeLevel: badge,
      verifiedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      verifiedBy: 'Admin (Master)'
    };
    const updatedList = requests.map(r => r.id === req.id ? updated : r);
    setRequests(updatedList);
    if (onUpdateKycRequest) onUpdateKycRequest(updated);
    setSelectedKyc(null);
    alert(`✅ Employer "${req.companyName}" has been successfully VERIFIED with ${badge} status!`);
  };

  const handleRejectKyc = (req: EmployerKycRequest, reason: string) => {
    const updated: EmployerKycRequest = {
      ...req,
      status: 'Rejected',
      rejectionReason: reason
    };
    const updatedList = requests.map(r => r.id === req.id ? updated : r);
    setRequests(updatedList);
    if (onUpdateKycRequest) onUpdateKycRequest(updated);
    setSelectedKyc(null);
    alert(`⛔ KYC Request for "${req.companyName}" rejected. Reason logged.`);
  };

  return (
    <div className="space-y-6 text-white">
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
                    {req.companyName.charAt(0)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-black text-base text-white">{req.companyName}</h3>
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
                    Contact: <span className="text-slate-200 font-semibold">{req.contactPerson}</span> • {req.email} • {req.phone}
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
                <span className="text-amber-400 font-bold">{req.ntnOrTaxNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">SECP Registration</span>
                <span className="text-white">{req.secpRegistrationNumber || 'Commercial Entity'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Official Website</span>
                <a
                  href={req.companyWebsite}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline flex items-center space-x-1"
                >
                  <span className="line-clamp-1">{req.companyWebsite.replace('https://', '')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Submitted At</span>
                <span className="text-slate-300">{req.submittedAt}</span>
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
                <h3 className="text-lg font-black text-white mt-0.5">{selectedKyc.companyName}</h3>
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
                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="font-bold text-white">SECP_Incorporation_&_NTN_Certificate.pdf</div>
                      <div className="text-[10px] text-slate-500">Official Government PDF Document</div>
                    </div>
                  </div>
                  <button
                    onClick={() => alert(`Opening verified document: ${selectedKyc.officialDocUrl}`)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-lg border border-slate-700"
                  >
                    View Document →
                  </button>
                </div>
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
