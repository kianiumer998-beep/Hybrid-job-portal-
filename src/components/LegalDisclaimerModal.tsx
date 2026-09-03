import React, { useState } from 'react';
import { 
  ShieldAlert, 
  FileText, 
  Lock, 
  Mail, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Send, 
  Building2, 
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';

interface LegalDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'disclaimer' | 'privacy' | 'terms' | 'contact';
}

export const LegalDisclaimerModal: React.FC<LegalDisclaimerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'disclaimer'
}) => {
  const [activeTab, setActiveTab] = useState<'disclaimer' | 'privacy' | 'terms' | 'contact'>(initialTab);

  // Contact / Inquiry Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCategory, setContactCategory] = useState<'General Inquiry' | 'Report Fake Job' | 'Fraud / Scam Alert' | 'Employer Verification' | 'Billing / Refund'>('General Inquiry');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmitInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    setIsSubmitted(true);
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        id="legal-disclaimer-modal"
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 max-h-[92vh] flex flex-col my-auto"
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-white">Legal, Trust & Compliance Center</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified Standards
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Independent Listings Disclaimer, Privacy Policy, Terms & Official Support
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1.5 px-6 py-3 bg-slate-950/90 border-b border-slate-800 overflow-x-auto text-xs font-bold scrollbar-none">
          <button
            onClick={() => { setActiveTab('disclaimer'); setIsSubmitted(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'disclaimer'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Independent Listings Disclaimer</span>
          </button>

          <button
            onClick={() => { setActiveTab('privacy'); setIsSubmitted(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'bg-indigo-500 text-white font-black shadow-md shadow-indigo-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Privacy Policy (GDPR / ISO)</span>
          </button>

          <button
            onClick={() => { setActiveTab('terms'); setIsSubmitted(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'terms'
                ? 'bg-purple-500 text-white font-black shadow-md shadow-purple-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Terms of Service</span>
          </button>

          <button
            onClick={() => { setActiveTab('contact'); setIsSubmitted(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'contact'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Contact Us & Fraud Desk</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300 text-xs leading-relaxed scrollbar-thin">
          
          {/* TAB 1: INDEPENDENT LISTINGS DISCLAIMER */}
          {activeTab === 'disclaimer' && (
            <div className="space-y-5">
              
              {/* Highlight Box with Exact Mandated Disclaimer */}
              <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-200 space-y-3 shadow-lg">
                <div className="flex items-center space-x-2 text-amber-400 font-black text-sm uppercase tracking-wide">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Official Independent Listings & Non-Affiliation Notice</span>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed text-amber-100/95">
                  <strong>Please Note:</strong> All jobs and advertisements listed on this platform are independent of the websites and should be pursued at your own risk. We are not responsible for any investments or applications made. While our customers post these jobs and advertisements, and we strive to ensure their validity, we cannot guarantee 100% accuracy. These listings have no direct affiliation with the websites mentioned.
                </p>
                <div className="text-[11px] text-amber-300/80 font-urdu pt-2 border-t border-amber-500/20">
                  <strong>اہم تنبیہ:</strong> اس پلیٹ فارم پر موجود تمام نوکریاں اور اشتہارات آزادانہ طور پر پوسٹ کیے گئے ہیں۔ کسی بھی ملازمت پر اپلائی کرنا یا مالی لین دین آپ کے اپنے رسک پر ہے۔ ہم 100٪ درستگی کی ضمانت نہیں دے سکتے۔
                </div>
              </div>

              {/* Legal Clauses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="text-white font-bold text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Third-Party Employer Independence</span>
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Job postings, sponsor campaigns, newspaper clippings, and gazette extracts are aggregated or submitted by third-party recruiters, employers, and authorized advertisers. We act purely as a technology discovery and career aggregation platform.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="text-white font-bold text-xs flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>No Financial Liability or Investment Risk</span>
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Users are strictly advised never to make financial deposits, payments, or investments to any employer promising jobs or visas. We are not liable for any financial losses or contractual disputes arising between applicants and employers.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="text-white font-bold text-xs flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span>No Direct Corporate or Government Affiliation</span>
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Trademarks, corporate logos, and department names (such as FPSC, PPSC, WAPDA, or private firms) belong to their respective owners. Their display does not imply endorsement, sponsorship, or official affiliation.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="text-white font-bold text-xs flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Content Moderation & Due Diligence</span>
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Our team conducts automated AI entity analysis, deduplication checks, and editorial reviews to ensure quality. However, candidates must independently verify company credentials before signing employment contracts.
                  </p>
                </div>

              </div>

              {/* Action Banner */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Found a suspicious posting or scam? Report it immediately to our fraud desk.</span>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('contact');
                    setContactCategory('Report Fake Job');
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold whitespace-nowrap cursor-pointer transition-all"
                >
                  Report Suspicious Listing →
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 flex items-center space-x-3">
                <Lock className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-white text-xs">Global Privacy & Candidate Data Protection</h4>
                  <p className="text-[11px] text-indigo-200">Compliant with international GDPR, ISO/IEC 27001 data principles, and local electronic transaction laws.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-white">1. Information We Collect</h4>
                <p className="text-slate-400">
                  We collect account registration data (name, email, phone number, role), CV builder information (education, work experience, uploaded resumes), and aggregated analytics (search keywords, region preferences, ad interactions).
                </p>

                <h4 className="text-sm font-black text-white">2. How Your Data is Used</h4>
                <p className="text-slate-400">
                  Your information is utilized solely to provide verified job discovery, generate customized ATS resumes, deliver instant WhatsApp and email job alerts, and protect user accounts from unauthorized access.
                </p>

                <h4 className="text-sm font-black text-white">3. Third-Party Sharing & Resumes</h4>
                <p className="text-slate-400">
                  We never sell your personal data to third-party telemarketers. When you submit an application to a verified job opening, your contact details and resume are securely transmitted to the relevant hiring recruiter.
                </p>

                <h4 className="text-sm font-black text-white">4. Cookies & Device Storage</h4>
                <p className="text-slate-400">
                  We use secure browser cookies and local storage tokens to remember your login session, country preference, saved bookmarks, and custom filters.
                </p>

                <h4 className="text-sm font-black text-white">5. Data Deletion & Right to be Forgotten</h4>
                <p className="text-slate-400">
                  You retain full ownership of your data. You may request permanent deletion of your profile, CVs, and application history at any time through our contact desk.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-200 flex items-center space-x-3">
                <FileText className="w-5 h-5 text-purple-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-white text-xs">Standard Terms of Use & Subscription Agreement</h4>
                  <p className="text-[11px] text-purple-200">Last updated: August 2026. Governs all job applicants, employers, and advertisers.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-white">1. Candidate Code of Conduct</h4>
                <p className="text-slate-400">
                  Job seekers agree to provide truthful qualifications, genuine employment history, and authentic contact information. Submitting fraudulent credentials or spam applications will result in permanent account suspension.
                </p>

                <h4 className="text-sm font-black text-white">2. Employer Job Posting Standards</h4>
                <p className="text-slate-400">
                  Employers posting verified openings agree that listings must represent actual vacancies. Postings containing misleading compensation, multi-level marketing (MLM) schemes, or requests for upfront registration fees will be rejected without refund.
                </p>

                <h4 className="text-sm font-black text-white">3. Advertisement Campaigns & Placements</h4>
                <p className="text-slate-400">
                  Sponsor banners, top header notices, and lightbox popups undergo editorial review. Placements run for the designated contracted duration. Self-serve wallet balances are refundable within 7 business days upon verified request.
                </p>

                <h4 className="text-sm font-black text-white">4. Intellectual Property</h4>
                <p className="text-slate-400">
                  All software code, user interface designs, ATS resume layouts, and logo assets are protected under copyright laws.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: CONTACT US & FRAUD REPORTING DESK */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1 text-center">
                  <Mail className="w-5 h-5 text-emerald-400 mx-auto" />
                  <div className="text-xs font-bold text-white">Official Support Email</div>
                  <div className="text-[11px] text-slate-400 font-mono">support@hybridjobs.pk</div>
                  <div className="text-[10px] text-emerald-400 font-semibold">Avg reply: &lt; 2 Hours</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1 text-center">
                  <Phone className="w-5 h-5 text-indigo-400 mx-auto" />
                  <div className="text-xs font-bold text-white">Helpline & WhatsApp</div>
                  <div className="text-[11px] text-slate-400 font-mono">+92 (300) 123-4567</div>
                  <div className="text-[10px] text-indigo-400 font-semibold">9:00 AM - 9:00 PM PKT</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1 text-center">
                  <ShieldAlert className="w-5 h-5 text-rose-400 mx-auto" />
                  <div className="text-xs font-bold text-white">Trust & Fraud Escalation</div>
                  <div className="text-[11px] text-slate-400 font-mono">compliance@hybridjobs.pk</div>
                  <div className="text-[10px] text-rose-400 font-semibold">Priority Triage Desk</div>
                </div>

              </div>

              {/* Inquiry & Report Form */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white flex items-center space-x-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>Send Message or Submit Safety Report</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Ticket ID will be generated</span>
                </div>

                {isSubmitted ? (
                  <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h5 className="text-sm font-black text-white">Ticket Submitted Successfully!</h5>
                    <p className="text-xs text-slate-300 max-w-md mx-auto">
                      Thank you for contacting our trust and safety department. Ticket reference <strong>#HJ-2026-{Math.floor(100000 + Math.random() * 900000)}</strong> has been opened. Our compliance team will review your inquiry within 24 hours.
                    </p>
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="mt-3 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all cursor-pointer"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitInquiry} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Your Full Name *</label>
                        <input
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="e.g. Usman Tariq"
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Your Email Address *</label>
                        <input
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="e.g. usman@example.com"
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Inquiry Category *</label>
                        <select
                          value={contactCategory}
                          onChange={(e) => setContactCategory(e.target.value as any)}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="General Inquiry">General Inquiry & Help</option>
                          <option value="Report Fake Job">Report Fake or Suspicious Job Listing</option>
                          <option value="Fraud / Scam Alert">Fraud, Scam or Fee Request Alert</option>
                          <option value="Employer Verification">Employer / KYC Verification Assistance</option>
                          <option value="Billing / Refund">Billing, Invoice or Wallet Inquiry</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Subject / Job Title Ref</label>
                        <input
                          type="text"
                          value={contactSubject}
                          onChange={(e) => setContactSubject(e.target.value)}
                          placeholder="e.g. Inquiry regarding Software Engineer post"
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Message Details & Explanation *</label>
                      <textarea
                        required
                        rows={4}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Please describe your question, issue, or provide details of the suspicious listing (URLs, employer names, or screenshot details)..."
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95 flex items-center space-x-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Ticket</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>HybridJobs.pk operates under international trust and cybersecurity guidelines.</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>

      </div>
    </div>
  );
};
