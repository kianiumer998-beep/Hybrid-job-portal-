export type JobType = 'Remote' | 'Hybrid' | 'On-site';
export type Region = 'Global' | 'US' | 'UK' | 'Pakistan';

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
  currency: 'PKR' | 'USD';
  type: 'Subscription' | 'Job Posting Fee';
  status: 'Success' | 'Pending' | 'Failed';
  paymentMethod: 'JazzCash' | 'Easypaisa' | 'Credit Card' | 'Bank Transfer';
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
  currency: 'PKR' | 'USD';
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
  activationDate?: string; // "YYYY-MM-DD HH:MM"
  expiryDate?: string;     // "YYYY-MM-DD HH:MM"
  renewalCount?: number;   // counter
  autoRenew: boolean;
  transactions?: PaymentTransaction[];
  customFieldsData?: Record<string, string>;
  appliedJobs?: JobApplication[];
  createdAt: string;
}

export type JobStatus = 'Approved' | 'Pending' | 'Rejected';

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
  currency: 'USD' | 'PKR' | 'GBP';
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead';
  department: string;
  tags: string[];
  description: string;
  requirements: string[];
  benefits: string[];
  postedAt: string;
  featured?: boolean;
  urgent?: boolean;
  applicationsCount: number;
  status?: JobStatus;
  rejectionReason?: string;
  submittedByUserId?: string;
  sourceUrl?: string;
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
