export type JobType = 'Remote' | 'Hybrid' | 'On-site';
export type Region = 'Global' | 'US' | 'UK' | 'Pakistan' | 'UAE' | 'Saudi Arabia' | 'Canada' | 'Europe' | 'Australia';
export type Currency = 'USD' | 'PKR' | 'GBP' | 'EUR' | 'CAD' | 'AUD' | 'AED' | 'SAR';

export interface AdminFeatureFlags {
  enableWebScraper: boolean;
  enableUniversalKeywordlessScraper: boolean;
  enableNewspaperClippings: boolean;
  enableScraperAutoApprove: boolean;
  enableGovtJobsPortal: boolean;
  enablePostingFeePaywall: boolean;
  enableCvBuilderPaywall: boolean;
  enableLiveSupportChat: boolean;
  deduplicationEnabled: boolean;
}

export interface PakistanLocation {
  province: string;
  cities: {
    name: string;
    districts: string[];
  }[];
}

export type UserRole = 'Job Seeker' | 'Employer/Job Poster';

export interface PaymentTransaction {
  id: string;
  dateTime: string; // "YYYY-MM-DD HH:MM"
  amount: number;
  currency: Currency;
  type: 'Subscription' | 'Job Posting Fee' | 'Ad Campaign Fee' | 'Wallet Deposit' | 'Refund';
  status: 'Success' | 'Pending' | 'Failed';
  paymentMethod: 'JazzCash' | 'Easypaisa' | 'Credit Card' | 'Bank Transfer' | 'Stripe' | 'PayPal' | 'Wallet Balance';
  jobTitleRef?: string;
}

export interface JobPostingFeeLog {
  id: string;
  dateTime: string;
  userId: string;
  userName: string;
  userEmail: string;
  jobTitle: string;
  amount: number;
  currency: Currency;
  paymentMethod: string;
  status: 'Paid' | 'Refunded';
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  appliedAt: string;
  status: 'Applied' | 'Under Review' | 'Shortlisted' | 'Rejected';
  paymentStatus?: 'Subscription Paid' | 'Free Tier' | 'Fee Paid';
  coverLetter?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  username?: string;
  password?: string;
  role: string; // Unified account
  companyName?: string;
  phone?: string;
  address?: string;
  bio?: string;
  plan: 'Free' | 'Premium';
  paymentStatus?: 'Paid' | 'Unpaid' | 'Overdue';
  membershipStatus?: 'Active' | 'Revoked' | 'Expired' | 'Unpaid';
  activationDate?: string; // "YYYY-MM-DD HH:MM"
  expiryDate?: string;     // "YYYY-MM-DD HH:MM"
  renewalCount?: number;   // counter
  autoRenew: boolean;
  transactions?: PaymentTransaction[];
  customFieldsData?: Record<string, string>;
  appliedJobs?: JobApplication[];
  walletBalance?: number; // In PKR
  createdAt: string;
}

export type JobStatus = 'Approved' | 'Pending' | 'Rejected' | 'Suspended' | 'Expired';

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  jobType: JobType;
  region: Region;
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  salary: string;
  salaryNumericMin?: number;
  currency: Currency;
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  department: string;
  tags: string[];
  description: string;
  requirements: string[];
  responsibilities?: string[];
  benefits: string[];
  postedAt: string;
  featured?: boolean;
  urgent?: boolean;
  isPinnedTop?: boolean; // Pinned at top of all jobs
  isFutureJob?: boolean; // Future job opportunity
  futureIntakeDate?: string; // Target start or batch intake date (e.g. '2026-10-01' or 'Fall 2026')
  priorityTier?: 'standard' | 'urgent' | 'featured_top' | 'vip_bundle';
  applicationsCount: number;
  status?: JobStatus;
  rejectionReason?: string;
  suspensionReason?: string;
  isSuspended?: boolean;
  submittedByUserId?: string;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Overdue' | 'Exempt';
  jobCategory?: 'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote' | string;
  sourceUrl?: string;
  scraperSourceId?: string;
  scraperSourceName?: string;
  scrapedSourceDomain?: string;
  scrapedAt?: string; // "YYYY-MM-DD HH:MM:SS"
  scrapedTime?: string; // "HH:MM AM/PM"
  applicationUrl?: string;
  contactEmailOrPhone?: string;
  deadlineDate?: string;

  // Scraper History & Ingestion Audit Extensions
  scraperBatchId?: string;
  scraperRunType?: 'Cron Scheduled' | 'Manual Trigger' | 'Deep Crawl' | 'API Sync';
  scrapedTimezone?: string; // e.g. 'UTC', 'PKT (UTC+5)', 'EST', 'GMT'
  scrapedRawSalary?: string;
  deduplicationScore?: number; // 0-100%
  reviewTimeline?: ScrapedJobAuditAction[];

  // Government Job Extensions
  isGovtJob?: boolean;
  govtDepartment?: string;
  govtScale?: string; // e.g., 'BPS-16', 'BPS-17', 'BPS-18', 'BPS-19', 'BPS-20+'
  govtCategory?: 'Federal' | 'Provincial' | 'Defense' | 'Healthcare' | 'Education' | 'Public Sector';

  // Newspaper Classified Ads Extensions
  isNewspaperAd?: boolean;
  newspaperName?: string; // e.g., 'Daily Jang', 'Dawn', 'The Express Tribune', 'The News', 'Nawa-i-Waqt', 'Gulf News'
  clippingImageUrl?: string;
  newspaperDate?: string;

  // PDF Consolidated Gazette Scraping Extensions (FPSC, WAPDA, PPSC, NTS)
  isPdfScraped?: boolean;
  pdfFileName?: string;
  pdfSourceUrl?: string;
  pdfCaseNumber?: string; // e.g. 'Case No. F.4-118/2026-R [8/2026]', 'WAPDA-RECRUIT-2026/04'
  pdfTotalVacanciesInCase?: number;
  domicileQuota?: string; // e.g. 'Punjab: 7 (Open: 6, Women: 1), Sindh (R): 2, KPK: 2, Balochistan: 1'
  challanFee?: string; // e.g. 'Rs. 300/- for BPS-16/17 (Payable at NBP)'
  ageRelaxationNote?: string; // e.g. '22-30 years plus 5 years general age relaxation'
  pdfParserEngine?: 'pdfplumber' | 'PyPDF2' | 'OCR-PyTesseract' | 'Camelot-Table-Extractor';

  // Hybrid Extraction & Duplicate Detection & Override Attributes
  extractionSourceType?: 'pdf_gazette' | 'web_html' | 'hybrid_feed';
  isDuplicate?: boolean;
  duplicateScore?: number;
  duplicateOfJobId?: string;
  duplicateOfJobTitle?: string;
  duplicateMatchedCompany?: string;
  isDuplicateOverride?: boolean;
  duplicateOverrideNote?: string;
  duplicateDetectedAt?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  senderRole: 'user' | 'admin';
  text: string;
  timestamp: string;
  jobTitleRef?: string;
}

export interface CustomFormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  options?: string[];
  required: boolean;
  active: boolean;
}

export interface JobFilters {
  searchQuery: string;
  jobType: string; // 'All' | JobType
  region: string; // 'All' | Region
  province: string;
  city: string;
  district: string;
  experienceLevel: string;
  salaryMin: number;
  sortBy: 'latest' | 'salary-high' | 'salary-low' | 'popular';
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: 'Basic' | 'Pro Alerts' | 'VIP Jobseeker';
  paymentMethod: 'Easypaisa' | 'JazzCash' | 'Bank Transfer' | 'Card';
  amountPaid: number;
  currency: 'PKR' | 'USD';
  status: 'Active' | 'Pending';
  subscribedAt: string;
  whatsappEnabled: boolean;
}

export interface CvData {
  photoBase64?: string;
  personalInfo: {
    fullName: string;
    jobTitle: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    linkedin: string;
    github: string;
    summary: string;
  };
  experience: {
    id: string;
    company: string;
    position: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    bullets: string[];
  }[];
  education: {
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    gpa?: string;
  }[];
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
  };
  certifications: {
    id: string;
    name: string;
    issuer: string;
    year: string;
  }[];
  templateStyle: 'modern' | 'executive' | 'tech' | 'classic';
  themeColor: string;
}

export const GOVT_DEPT_OPTIONS = [
  'Federal Public Service Commission (FPSC)',
  'Punjab Public Service Commission (PPSC)',
  'Sindh Public Service Commission (SPSC)',
  'Khyber Pakhtunkhwa Public Service Commission (KPPSC)',
  'Balochistan Public Service Commission (BPSC)',
  'Azad Jammu & Kashmir Public Service Commission (AJKPSC)',
  'Ministry of Federal Education & Professional Training',
  'Ministry of National Health Services, Regulations & Coordination',
  'Ministry of Finance, Revenue & Economic Affairs',
  'Ministry of Defense & Defense Production',
  'Ministry of Interior & Narcotics Control',
  'Ministry of Information Technology & Telecommunication',
  'Ministry of Foreign Affairs',
  'Ministry of Railways',
  'Federal Board of Revenue (FBR)',
  'National Database & Registration Authority (NADRA)',
  'Federal Investigation Agency (FIA)',
  'National Accountability Bureau (NAB)',
  'Water & Power Development Authority (WAPDA)',
  'Capital Development Authority (CDA)',
  'Lahore Development Authority (LDA) / KDA / FDA',
  'State Bank of Pakistan (SBP) / NBP',
  'Higher Education Commission (HEC)',
  'Pakistan Atomic Energy Commission (PAEC) / NESCOM',
  'National Testing Service (NTS) / PTS / OTS / CTS',
  'Other (Manual Entry)'
];

export const GOVT_SCALE_OPTIONS = [
  'BPS-01 to BPS-04 (Support Staff / Attendant)',
  'BPS-05 to BPS-08 (Junior Clerk / Driver / Technician)',
  'BPS-09 to BPS-11 (Senior Clerk / Steno-typist)',
  'BPS-12 to BPS-15 (Assistant / Supervisor / Sub-Inspector)',
  'BPS-16 (Gazetted Officer / Superintendent)',
  'BPS-17 (CSS Officer / Assistant Director / Lecturer / Medical Officer)',
  'BPS-18 (Deputy Director / Assistant Professor / Senior Medical Officer)',
  'BPS-19 (Director / Associate Professor / Chief Officer)',
  'BPS-20 (Senior Director / Professor / Joint Secretary)',
  'BPS-21 (Director General / Additional Secretary)',
  'BPS-22 (Federal Secretary / Chief Secretary)',
  'MP-I Scale (Management Position - Executive)',
  'MP-II Scale (Management Position - Senior)',
  'MP-III Scale (Management Position - Specialist)',
  'SPS Scale (Special Pay Scale - PAEC / NESCOM)',
  'PPS Scale (Project Pay Scale - Federal Projects)',
  'Contract / Lump Sum Fixed Pay',
  'Other (Manual Entry)'
];

export const GOVT_CADRE_OPTIONS = [
  'Federal Government Services (CSS / Federal Ministries)',
  'Provincial Government Services (PMS / PPSC / SPSC)',
  'Police, Law Enforcement & Intelligence (PSP / FIA / NAB)',
  'Judiciary & Legal Services (High Court / District Courts)',
  'Revenue, Customs & Taxation (FBR / Inland Revenue)',
  'Public Health, Hospitals & Medical Services',
  'Education, Schools, Colleges & Universities',
  'Defense, Military & Civil Armed Forces (Rangers / Frontier Constabulary)',
  'Engineering, Power, Energy & Works (WAPDA / NTDC / C&W)',
  'Aviation, Civil Aviation & Airports Authority (CAA / PIA)',
  'Railways, Highways & Transport (NHA / Pakistan Railways)',
  'Banking, Finance, Statutory & Autonomous Bodies (SBP / SECP)',
  'Municipal & Local Government Services',
  'Foreign Affairs, Diplomacy & International Relations',
  'Other (Manual Entry)'
];

export const NEWSPAPER_OPTIONS = [
  'Daily Jang (Classifieds)',
  'Dawn Newspaper',
  'The Express Tribune',
  'The News International',
  'Daily Nawa-i-Waqt',
  'Daily Dunya',
  'Daily Khabrain',
  'Daily Express',
  'Daily Mashriq',
  'Daily Aaj',
  'Gulf News Classifieds',
  'Khaleej Times',
  'Arab News',
  'Other (Manual Entry)'
];

export interface ScrapedJobAuditAction {
  id: string;
  timestamp: string; // "YYYY-MM-DD HH:mm:ss"
  relativeTime?: string;
  action: 'Scraped' | 'Auto-Approved' | 'Approved by Admin' | 'Rejected' | 'Modified & Approved' | 'Re-queued' | 'Suspended';
  performedBy: 'Cron Scraper Engine' | 'Admin User' | 'System Deduplicator' | 'AI Entity Extractor';
  actorName?: string;
  notes?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface ScrapedJobAuditEntry {
  id: string;
  jobId: string;
  batchId: string;
  jobTitle: string;
  company: string;
  scrapedAt: string; // "YYYY-MM-DD HH:mm:ss"
  scrapedTimezone: string;
  sourcePortalName: string;
  sourceUrl: string;
  sourceDomain: string;
  category: 'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote' | string;
  region: Region;
  country?: string;
  city?: string;
  currency: Currency;
  salaryText: string;
  status: 'Pending Review' | 'Approved Live' | 'Auto-Approved' | 'Rejected' | 'Suspended';
  rejectionReason?: string;
  deduplicationScore: number; // 0-100% uniqueness
  crawlLatencyMs: number;
  extractedTags: string[];
  requirementsCount: number;
  isGovtJob?: boolean;
  govtScale?: string;
  govtDepartment?: string;
  isNewspaperAd?: boolean;
  newspaperName?: string;
  clippingImageUrl?: string;
  isPdfScraped?: boolean;
  pdfFileName?: string;
  pdfCaseNumber?: string;
  pdfTotalVacanciesInCase?: number;
  domicileQuota?: string;
  challanFee?: string;
  ageRelaxationNote?: string;
  pdfParserEngine?: 'pdfplumber' | 'PyPDF2' | 'OCR-PyTesseract' | 'Camelot-Table-Extractor';
  extractionSourceType?: 'pdf_gazette' | 'web_html' | 'hybrid_feed';
  isDuplicate?: boolean;
  duplicateOfJobId?: string;
  duplicateOfJobTitle?: string;
  isDuplicateOverride?: boolean;
  duplicateOverrideNote?: string;
  reviewTimeline: ScrapedJobAuditAction[];
  snapshot: {
    description: string;
    requirements: string[];
    benefits: string[];
    applyUrl?: string;
    contactInfo?: string;
  };
}

export interface ConsolidatedPdfGazette {
  id: string;
  title: string;
  organization: string; // e.g. "Federal Public Service Commission (FPSC)", "WAPDA", "PPSC"
  pdfFileName: string;
  pdfUrl: string;
  fileSizeFormatted: string;
  totalPages: number;
  gazetteIssueNumber: string; // e.g. "Advt. No. 08/2026", "WAPDA/PR/2026/04"
  publicationDate: string;
  closingDeadline: string;
  rawTextSample: string;
  extractedVacancies: Job[];
}

export interface ScraperBatchRun {
  batchId: string;
  startTime: string; // "YYYY-MM-DD HH:mm:ss"
  endTime: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  region: Region;
  category: string;
  status: 'Completed' | 'Running' | 'Failed' | 'Partial';
  totalExtracted: number;
  approvedCount: number;
  pendingCount: number;
  duplicatesSkipped: number;
  rejectionCount: number;
  executionDurationMs: number;
  httpStatusCode: number;
  triggerType: 'Scheduled Cron' | 'Manual On-Demand' | 'Deep Crawl' | 'Webhook' | 'Batch Rescrape';
  logTrace: string[];
}

export interface JobPostingPricingConfig {
  standardFeePkr: number;       // Base fee for standard job posting (PKR)
  urgentFeePkr: number;         // Priority surcharge for Urgent Hiring badge & boost (PKR)
  featuredTopFeePkr: number;    // Priority surcharge for Featured & Pinned Top-of-List placement (PKR)
  futureJobFeePkr: number;      // Priority surcharge for Advance / Future Job Intake (PKR)
  vipBundleFeePkr: number;      // VIP All-in-One: Top Pinned + Urgent + Featured + Future Option (PKR)
  freePostingAllowed: boolean;  // If true and standardFee is 0, base posts are free
}

export const DEFAULT_JOB_POSTING_PRICING_CONFIG: JobPostingPricingConfig = {
  standardFeePkr: 1000,
  urgentFeePkr: 500,
  featuredTopFeePkr: 1500,
  futureJobFeePkr: 800,
  vipBundleFeePkr: 2500,
  freePostingAllowed: true
};


