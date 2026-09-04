import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { Filters } from './components/Filters';
import { JobListings } from './components/JobListings';
import { JobDetailModal } from './components/JobDetailModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { CvBuilder } from './components/CvBuilder';
import { CvPaywallModal } from './components/CvPaywallModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { UserDashboard } from './components/UserDashboard';
import { Footer } from './components/Footer';
import { CountrySelectionModal } from './components/CountrySelectionModal';
import { LegalDisclaimerModal } from './components/LegalDisclaimerModal';
import { WhatsAppStickyButton, WhatsAppSupportConfig, DEFAULT_WHATSAPP_CONFIG } from './components/WhatsAppStickyButton';
import { INITIAL_PAYMENT_TRANSACTIONS } from './data/mockTransactions';

import { TopBannerAd } from './components/ads/TopBannerAd';
import { PopupAdModal } from './components/ads/PopupAdModal';
import { ToastNotificationAd } from './components/ads/ToastNotificationAd';
import { AdNotificationDrawer } from './components/ads/AdNotificationDrawer';
import { 
  Advertisement, 
  INITIAL_ADVERTISEMENTS, 
  AdPricingConfig, 
  DEFAULT_AD_PRICING_CONFIG,
  CampaignCustomizationConfig,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG
} from './types/ad';

import { 
  Job, 
  JobFilters, 
  Subscriber, 
  UserAccount, 
  ChatMessage, 
  CustomFormField, 
  JobPostingFeeLog, 
  PaymentTransaction, 
  JobApplication,
  JobPostingPricingConfig,
  DEFAULT_JOB_POSTING_PRICING_CONFIG
} from './types/job';
import { INITIAL_JOBS } from './data/mockJobs';
import { Bell, Sparkles, CheckCircle2, Shield, Search, AlertTriangle, Info, CheckCircle, ArrowRight, X, Layers, Globe, MapPin, Zap } from 'lucide-react';
import { SiteSeoConfig } from './types/adminSuite';
import { INITIAL_SITE_SEO_CONFIG } from './data/mockAdminSuiteData';
import { 
  LandingPageConfig, 
  DEFAULT_LANDING_PAGE_CONFIG, 
  CountryOption, 
  SUPPORTED_COUNTRIES 
} from './types/landing';
import { safeLocalStorageSet, safeLocalStorageGet } from './utils/safeStorage';

export default function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'jobs' | 'cv' | 'alerts' | 'dashboard'>('jobs');
  const [showAdminView, setShowAdminView] = useState<boolean>(false);
  const [dismissAnnouncement, setDismissAnnouncement] = useState<boolean>(false);

  // User Country Selection State (Pop-up on entry if not set)
  const [userSelectedCountry, setUserSelectedCountry] = useState<CountryOption | null>(() => {
    try {
      const saved = localStorage.getItem('hybrid_user_country_preference');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [showCountryModal, setShowCountryModal] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('hybrid_user_country_preference');
      return !saved; // If no preference saved, open on first visit
    } catch {
      return true;
    }
  });

  // Dynamic Landing Page Builder Configuration State
  const [landingConfig, setLandingConfig] = useState<LandingPageConfig>(() => {
    try {
      const saved = localStorage.getItem('hybrid_landing_page_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_LANDING_PAGE_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem('hybrid_landing_page_config', JSON.stringify(landingConfig));
    } catch (e) {}
  }, [landingConfig]);

  // Global SEO & Announcement State (Synchronized with Admin Suite)
  const [siteSeoConfig, setSiteSeoConfig] = useState<SiteSeoConfig>(() => {
    try {
      const saved = localStorage.getItem('career_pak_seo_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_SITE_SEO_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_seo_config', JSON.stringify(siteSeoConfig));
      if (siteSeoConfig.siteTitle) {
        document.title = siteSeoConfig.siteTitle;
      }
    } catch (e) {}
  }, [siteSeoConfig]);

  // Advertisements State
  const [advertisements, setAdvertisements] = useState<Advertisement[]>(() => {
    const saved = localStorage.getItem('hybrid_portal_ads');
    return saved ? JSON.parse(saved) : INITIAL_ADVERTISEMENTS;
  });

  useEffect(() => {
    localStorage.setItem('hybrid_portal_ads', JSON.stringify(advertisements));
  }, [advertisements]);

  // Pricing Matrix Configuration State
  const [pricingConfig, setPricingConfig] = useState<AdPricingConfig>(() => {
    const saved = localStorage.getItem('hybrid_ad_pricing_config');
    return saved ? JSON.parse(saved) : DEFAULT_AD_PRICING_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('hybrid_ad_pricing_config', JSON.stringify(pricingConfig));
  }, [pricingConfig]);

  // Campaign Customization & Portal Page Scheduling State
  const [campaignConfig, setCampaignConfig] = useState<CampaignCustomizationConfig>(() => {
    const saved = localStorage.getItem('hybrid_campaign_customization_config');
    return saved ? JSON.parse(saved) : DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('hybrid_campaign_customization_config', JSON.stringify(campaignConfig));
  }, [campaignConfig]);

  const [isAdDrawerOpen, setIsAdDrawerOpen] = useState<boolean>(false);

  const handleAdClick = (ad: Advertisement) => {
    setAdvertisements((prev) =>
      prev.map((a) => (a.id === ad.id ? { ...a, clicks: (a.clicks || 0) + 1 } : a))
    );
  };

  const handleAddAd = (newAd: Advertisement) => {
    setAdvertisements((prev) => [newAd, ...prev]);
  };

  const handleUpdateAd = (updatedAd: Advertisement) => {
    setAdvertisements((prev) =>
      prev.map((a) => (a.id === updatedAd.id ? updatedAd : a))
    );
  };

  const handleDeleteAd = (adId: string) => {
    setAdvertisements((prev) => prev.filter((a) => a.id !== adId));
  };

  const handleResetAdMetrics = (adId?: string) => {
    if (adId) {
      setAdvertisements((prev) =>
        prev.map((a) => (a.id === adId ? { ...a, impressions: 0, clicks: 0 } : a))
      );
    } else {
      setAdvertisements((prev) =>
        prev.map((a) => ({ ...a, impressions: 0, clicks: 0 }))
      );
    }
  };

  // Registered Current User State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('hybrid_current_user');
    if (saved) {
      try {
        const u: UserAccount = JSON.parse(saved);
        if (u && u.walletBalance === undefined) {
          u.walletBalance = 25000;
        }
        return u;
      } catch {
        return null;
      }
    }
    return null;
  });

  // User Accounts Directory State
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('hybrid_users_directory');
    const defaultList: UserAccount[] = [
      {
        id: 'user-demo-qwer-unified',
        name: 'Qwer Member',
        email: 'qwer@jobportal.com',
        username: 'qwer',
        password: '123456',
        role: 'Unified Member',
        companyName: 'Qwer Solutions',
        phone: '+92 300 1234567',
        plan: 'Premium',
        walletBalance: 25000,
        activationDate: '2026-07-25 09:00',
        expiryDate: '2026-08-24 09:00',
        renewalCount: 2,
        autoRenew: true,
        transactions: [
          {
            id: 'tx-demo-1',
            dateTime: '2026-07-25 09:00',
            amount: 300,
            currency: 'PKR',
            type: 'Subscription',
            status: 'Success',
            paymentMethod: 'JazzCash'
          },
          {
            id: 'tx-demo-2',
            dateTime: '2026-07-25 09:30',
            amount: 1000,
            currency: 'PKR',
            type: 'Job Posting Fee',
            status: 'Success',
            paymentMethod: 'Easypaisa',
            jobTitleRef: 'Remote Senior React Developer'
          }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-demo-1',
        name: 'Ali Raza',
        email: 'ali.raza@example.com',
        role: 'Unified Member',
        phone: '+92 300 1122334',
        plan: 'Premium',
        walletBalance: 15000,
        activationDate: '2026-07-20 14:00',
        expiryDate: '2026-08-19 14:00',
        renewalCount: 1,
        autoRenew: true,
        transactions: [
          {
            id: 'tx-ali-1',
            dateTime: '2026-07-20 14:00',
            amount: 300,
            currency: 'PKR',
            type: 'Subscription',
            status: 'Success',
            paymentMethod: 'JazzCash'
          }
        ],
        createdAt: new Date().toISOString()
      }
    ];

    if (!saved) return defaultList;

    try {
      const parsed: UserAccount[] = JSON.parse(saved);
      if (!Array.isArray(parsed)) return defaultList;

      const userMap = new Map<string, UserAccount>();
      defaultList.forEach(u => userMap.set(u.id, u));
      parsed.forEach(u => {
        if (u && u.id) {
          const existing = userMap.get(u.id);
          const combined = existing ? { ...existing, ...u } : u;
          if (combined.walletBalance === undefined) {
            combined.walletBalance = 25000;
          }
          userMap.set(u.id, combined);
        }
      });
      return Array.from(userMap.values());
    } catch {
      return defaultList;
    }
  });

  // Per-Job Posting Fee Configuration & Log Sheet
  const [jobPostingFeePkr, setJobPostingFeePkr] = useState<number>(() => {
    const saved = localStorage.getItem('hybrid_job_posting_fee');
    return saved ? Number(saved) : 1000;
  });

  const [jobPostingFeeLogs, setJobPostingFeeLogs] = useState<JobPostingFeeLog[]>(() => {
    const saved = localStorage.getItem('hybrid_job_fee_logs');
    return saved ? JSON.parse(saved) : [
      {
        id: 'log-demo-1',
        jobTitle: 'Senior Python & Django Developer',
        userId: 'user-demo-1',
        userName: 'Ali Raza',
        userEmail: 'ali.raza@example.com',
        amount: 1000,
        currency: 'PKR',
        paymentMethod: 'JazzCash',
        dateTime: '2026-07-25 10:15',
        status: 'Paid'
      }
    ];
  });

  // Persistent WhatsApp Support Configuration State
  const [whatsAppSupportConfig, setWhatsAppSupportConfig] = useState<WhatsAppSupportConfig>(() => {
    try {
      const saved = localStorage.getItem('hybrid_whatsapp_support_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      phoneNumber: '923001234567',
      agentName: 'Ayesha (Lead Career Advisor)',
      defaultMessage: 'Hello! I need assistance with job applications on CareerPak...',
      supportHoursText: 'Online • 9:00 AM - 9:00 PM PKT',
      enabled: true,
      position: 'bottom-right'
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('hybrid_whatsapp_support_config', JSON.stringify(whatsAppSupportConfig));
    } catch (e) {}
  }, [whatsAppSupportConfig]);

  // Payment Verification Transactions State
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('hybrid_payment_transactions');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_PAYMENT_TRANSACTIONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('hybrid_payment_transactions', JSON.stringify(paymentTransactions));
    } catch (e) {}
  }, [paymentTransactions]);

  const handleApprovePaymentTransaction = (txId: string, note?: string) => {
    setPaymentTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        return {
          ...t,
          status: 'Success' as const,
          verifiedAt: new Date().toISOString(),
          adminNote: note
        };
      }
      return t;
    }));
  };

  const handleRejectPaymentTransaction = (txId: string, reason: string) => {
    setPaymentTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        return {
          ...t,
          status: 'Failed' as const,
          rejectionReason: reason
        };
      }
      return t;
    }));
  };

  // Helper to deduplicate jobs by unique ID
  const deduplicateJobsById = (jobList: Job[]): Job[] => {
    const seen = new Set<string>();
    const unique: Job[] = [];
    jobList.forEach((j) => {
      if (j && j.id) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          unique.push(j);
        }
      }
    });
    return unique;
  };

  // Approved Live Jobs
  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('hybrid_jobs_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateJobsById(parsed);
        }
      } catch {
        // Fallback to initial
      }
    }
    return INITIAL_JOBS;
  });

  // Pending Jobs Queue for Admin Verification
  const [pendingJobs, setPendingJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('hybrid_pending_jobs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateJobsById(parsed);
        }
      } catch {
        // Fallback to initial
      }
    }
    return [
      {
        id: 'job-pending-sc1-1',
        title: 'Senior Full Stack React & Node.js Engineer',
        company: 'DevSinc Pakistan',
        jobType: 'Hybrid',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Lahore',
        district: 'Gulberg',
        salary: 'PKR 350,000 - PKR 480,000 / month',
        currency: 'PKR',
        experienceLevel: 'Senior',
        department: 'Software Engineering',
        tags: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Tailwind CSS'],
        description: 'Seeking a seasoned Full Stack Engineer to lead web platform architecture using React 18, Node.js microservices, and modern cloud deployment pipelines.',
        requirements: ['4+ years hands-on React and Node.js', 'Experience with PostgreSQL & Redis', 'Agile squad leadership'],
        benefits: ['Medical Insurance for Family', 'Annual Performance Bonus', 'Hybrid Flexibility'],
        postedAt: '1 hour ago',
        applicationsCount: 0,
        status: 'Pending',
        sourceUrl: 'https://www.rozee.pk/category/information-technology-jobs',
        scraperSourceId: 'sc-1',
        scraperSourceName: 'Rozee.pk Pakistan Tech Jobs'
      },
      {
        id: 'job-pending-sc1-2',
        title: 'MERN Stack Lead Architect',
        company: 'NetSol Technologies',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Lahore',
        district: 'Model Town',
        salary: 'PKR 420,000 - PKR 550,000 / month',
        currency: 'PKR',
        experienceLevel: 'Lead',
        department: 'Product Architecture',
        tags: ['MongoDB', 'Express', 'React', 'Node', 'Docker'],
        description: 'Seeking an experienced Lead Architect for our enterprise asset finance SaaS platform. You will direct technical strategy, system resilience, and database scaling.',
        requirements: ['6+ years MERN stack architecture', 'Docker & Kubernetes orchestration'],
        benefits: ['In-house Gym & Meals', 'Provident Fund', 'Annual Trips'],
        postedAt: '2 hours ago',
        applicationsCount: 0,
        status: 'Pending',
        sourceUrl: 'https://www.rozee.pk/category/information-technology-jobs',
        scraperSourceId: 'sc-1',
        scraperSourceName: 'Rozee.pk Pakistan Tech Jobs'
      },
      {
        id: 'job-pending-sc2-1',
        title: 'Assistant Director IT (BPS-17)',
        company: 'Federal Public Service Commission (FPSC)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Islamabad Capital Territory',
        city: 'Islamabad',
        salary: 'PKR 110,000 - PKR 160,000 / month (BPS-17 Pay Scale)',
        currency: 'PKR',
        experienceLevel: 'Mid',
        department: 'National IT Wing',
        tags: ['Govt Job', 'FPSC', 'BPS-17', 'Federal Govt', 'Public Sector'],
        description: 'Official Federal Public Service Commission recruitment for Assistant Director IT. Responsible for network infrastructure, cybersecurity governance, and database management across federal ministries.',
        requirements: ['Master or BS in Computer Science (HEC Recognized)', 'Age Limit: 22 - 30 years (+5 years general relaxation)', 'Domicile: Punjab / Sindh / KPK'],
        benefits: ['Govt Accommodation / House Rent Allowance', 'Pension Scheme & EOBI', 'Medical Grade 1 Facilities'],
        postedAt: '3 hours ago',
        applicationsCount: 0,
        status: 'Pending',
        sourceUrl: 'https://fpsc.gov.pk/jobs/announcements',
        scraperSourceId: 'sc-2',
        scraperSourceName: 'FPSC & PPSC Federal Govt Jobs Scraper',
        isGovtJob: true,
        govtDepartment: 'Federal Public Service Commission',
        govtScale: 'BPS-17',
        govtCategory: 'Federal'
      },
      {
        id: 'job-pending-sc3-1',
        title: 'Urgent Computer Operator & Web Assistant',
        company: 'Metro Trading Corp',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Rawalpindi',
        district: 'Saddar',
        salary: 'PKR 75,000 - PKR 105,000 / month',
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'Data Management & IT',
        tags: ['Newspaper Classified', 'Daily Jang', 'Data Entry', 'MS Office'],
        description: 'Urgent requirement for Computer Operator & Web Assistant in Rawalpindi Saddar. Key duties include database record-keeping, web catalog updates, and office administration.',
        requirements: ['Typing speed 40+ WPM', 'Basic HTML/WordPress editing', 'Intermediate or Bachelor degree'],
        benefits: ['Daily Lunch Allowance', 'Overtime Compensation'],
        postedAt: 'Yesterday',
        applicationsCount: 0,
        status: 'Pending',
        sourceUrl: 'https://e.jang.com.pk/classifieds',
        scraperSourceId: 'sc-3',
        scraperSourceName: 'Daily Jang Newspaper Classified Ads',
        isNewspaperAd: true,
        newspaperName: 'Daily Jang'
      },
      {
        id: 'job-pending-sc4-1',
        title: 'Senior AI & LLM Engineer (USD Remote)',
        company: 'Anthropic Ecosystem Partner',
        jobType: 'Remote',
        region: 'Global',
        salary: '$120,000 - $160,000 / year (USD)',
        currency: 'USD',
        experienceLevel: 'Senior',
        department: 'AI Research & Deployment',
        tags: ['AI Engineer', 'Python', 'LLM', 'Remote', 'PyTorch'],
        description: 'We are seeking an AI & LLM Engineer to build agentic workflows, fine-tune open-weights models, and optimize retrieval-augmented generation pipelines across distributed systems.',
        requirements: ['4+ years Python, PyTorch / LangChain / LlamaIndex', 'Production experience with vector DBs (Pinecone, Qdrant)'],
        benefits: ['100% Worldwide Remote', 'Equipment Allowance $3,000', 'Unlimited PTO'],
        postedAt: '4 hours ago',
        applicationsCount: 0,
        status: 'Pending',
        sourceUrl: 'https://www.linkedin.com/jobs/search?keywords=remote+developer',
        scraperSourceId: 'sc-4',
        scraperSourceName: 'LinkedIn Global Remote Developer Feed'
      },
      {
        id: 'job-pending-sc5-1',
        title: 'Senior Cloud Solutions Architect (Dubai / Remote)',
        company: 'Emirates NBD Tech',
        jobType: 'Remote',
        region: 'UAE',
        city: 'Dubai',
        salary: 'AED 24,000 - AED 32,000 / month',
        currency: 'AED',
        experienceLevel: 'Lead',
        department: 'Enterprise Cloud Architecture',
        tags: ['Cloud Architecture', 'AWS', 'Kubernetes', 'Microservices', 'DevOps'],
        description: 'Seeking an experienced Cloud Solutions Architect to drive enterprise AWS & Azure hybrid cloud infrastructure, container orchestration, and high-availability systems.',
        requirements: ['7+ years Cloud Infrastructure leadership', 'AWS Certified Solutions Architect Professional'],
        benefits: ['Tax-free UAE Salary', 'Annual Flight Tickets to Home Country', 'Health Coverage'],
        postedAt: '5 hours ago',
        applicationsCount: 0,
        status: 'Pending',
        sourceUrl: 'https://www.gulftalent.com/uae/jobs/technology',
        scraperSourceId: 'sc-5',
        scraperSourceName: 'GulfTalent UAE & Saudi Opportunities'
      }
    ];
  });

  // Chat Messages State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('hybrid_chat_messages');
    return saved ? JSON.parse(saved) : [
      {
        id: 'msg-1',
        userId: 'user-demo-1',
        userName: 'Ali Raza',
        senderRole: 'admin',
        text: 'Welcome to HybridJobs.pk! Feel free to ask if you have any questions about remote job applications.',
        timestamp: '10:00 AM'
      }
    ];
  });

  // Admin Custom Registration Form Fields
  const [customFormFields, setCustomFormFields] = useState<CustomFormField[]>(() => {
    const saved = localStorage.getItem('hybrid_custom_form_fields');
    return saved ? JSON.parse(saved) : [
      {
        id: 'cf-cnic',
        label: 'CNIC / Passport Number',
        type: 'text',
        required: true,
        active: true
      },
      {
        id: 'cf-exp',
        label: 'Years of Professional Experience',
        type: 'select',
        options: ['Fresh Graduate', '1-3 Years', '3-5 Years', '5+ Years'],
        required: false,
        active: true
      }
    ];
  });

  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('hybrid_saved_job_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    const saved = localStorage.getItem('hybrid_subscribers_list');
    return saved ? JSON.parse(saved) : [
      {
        id: 'sub-1',
        name: 'Usman Chaudhry',
        phone: '+92 300 9876543',
        email: 'usman.c@example.com',
        plan: 'Pro Alerts',
        paymentMethod: 'JazzCash',
        amountPaid: 300,
        currency: 'PKR',
        status: 'Active',
        subscribedAt: new Date().toISOString(),
        whatsappEnabled: true
      }
    ];
  });

  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    return localStorage.getItem('hybrid_user_is_subscribed') === 'true';
  });

  const [monthlyFeePkr, setMonthlyFeePkr] = useState<number>(() => {
    const saved = localStorage.getItem('hybrid_monthly_fee');
    return saved ? Number(saved) : 300;
  });

  // Job Posting & Priority Placement Pricing Configuration State
  const [jobPostingPricing, setJobPostingPricing] = useState<JobPostingPricingConfig>(() => {
    try {
      const saved = localStorage.getItem('hybrid_job_posting_pricing');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_JOB_POSTING_PRICING_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem('hybrid_job_posting_pricing', JSON.stringify(jobPostingPricing));
    } catch (e) {}
  }, [jobPostingPricing]);

  // All Job Applications Log State
  const [allApplications, setAllApplications] = useState<JobApplication[]>(() => {
    const saved = localStorage.getItem('hybrid_all_applications');
    return saved ? JSON.parse(saved) : [
      {
        id: 'app-1',
        jobId: 'job-1',
        jobTitle: 'Senior Full Stack React Native Engineer',
        companyName: 'DevSinc Lahore',
        applicantId: 'usr-demo-1',
        applicantName: 'Qwer Test User',
        applicantEmail: 'qwer@example.com',
        appliedAt: '2026-07-25 10:15',
        status: 'Under Review',
        paymentStatus: 'Subscription Paid'
      }
    ];
  });

  // Modal States
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState<boolean>(false);
  const [selectedJobTitleForSub, setSelectedJobTitleForSub] = useState<string>('');
  const [cvPaywallOpen, setCvPaywallOpen] = useState<boolean>(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [legalModalOpen, setLegalModalOpen] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<'disclaimer' | 'privacy' | 'terms' | 'contact'>('disclaimer');
  const [userDashboardInitialTab, setUserDashboardInitialTab] = useState<'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat'>('overview');

  const handlePostJobClick = () => {
    setUserDashboardInitialTab('post-job');
    if (currentUser) {
      setActiveTab('dashboard');
    } else {
      setAuthModalOpen(true);
    }
  };

  // Filters & Pagination State
  const [filters, setFilters] = useState<JobFilters>(() => {
    try {
      const savedCountry = localStorage.getItem('hybrid_user_country_preference');
      if (savedCountry) {
        const c: CountryOption = JSON.parse(savedCountry);
        return {
          searchQuery: '',
          jobType: 'All',
          region: c.code === 'GL' ? 'All' : (c.region || c.name),
          province: '',
          city: '',
          district: '',
          experienceLevel: 'All',
          salaryMin: 0,
          sortBy: 'latest'
        };
      }
    } catch (e) {}
    return {
      searchQuery: '',
      jobType: 'All',
      region: 'All',
      province: '',
      city: '',
      district: '',
      experienceLevel: 'All',
      salaryMin: 0,
      sortBy: 'latest'
    };
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [postsPerPage, setPostsPerPage] = useState<number>(10);

  const handleSelectCountry = (country: CountryOption) => {
    setUserSelectedCountry(country);
    try {
      localStorage.setItem('hybrid_user_country_preference', JSON.stringify(country));
    } catch (e) {}
    setShowCountryModal(false);

    const targetRegion = country.code === 'GL' ? 'All' : (country.region || country.name);
    setFilters(prev => ({
      ...prev,
      region: targetRegion,
      province: '',
      city: '',
      district: '',
      sortBy: 'latest'
    }));
    setCurrentPage(1);
  };

  const handleFiltersChange = (newFilters: JobFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      jobType: 'All',
      region: userSelectedCountry ? (userSelectedCountry.code === 'GL' ? 'All' : (userSelectedCountry.region || userSelectedCountry.name)) : 'All',
      province: '',
      city: '',
      district: '',
      experienceLevel: 'All',
      salaryMin: 0,
      sortBy: 'latest'
    });
    setCurrentPage(1);
  };

  const handlePostsPerPageChange = (newSize: number) => {
    setPostsPerPage(newSize);
    setCurrentPage(1);
  };

  // LocalStorage Persist Effects - Fully guarded with safeLocalStorageSet to prevent QuotaExceeded crashes
  useEffect(() => {
    safeLocalStorageSet('hybrid_current_user', currentUser);
  }, [currentUser]);

  useEffect(() => {
    safeLocalStorageSet('hybrid_users_directory', users);
  }, [users]);

  useEffect(() => {
    // Keep most recent 150 jobs in storage to ensure plenty of quota headroom
    const toSave = jobs.length > 150 ? jobs.slice(0, 150) : jobs;
    safeLocalStorageSet('hybrid_jobs_list', toSave);
  }, [jobs]);

  useEffect(() => {
    const toSave = pendingJobs.length > 150 ? pendingJobs.slice(0, 150) : pendingJobs;
    safeLocalStorageSet('hybrid_pending_jobs', toSave);
  }, [pendingJobs]);

  useEffect(() => {
    safeLocalStorageSet('hybrid_chat_messages', chatMessages.slice(-50));
  }, [chatMessages]);

  useEffect(() => {
    safeLocalStorageSet('hybrid_custom_form_fields', customFormFields);
  }, [customFormFields]);

  useEffect(() => {
    safeLocalStorageSet('hybrid_saved_job_ids', savedJobIds);
  }, [savedJobIds]);

  useEffect(() => {
    safeLocalStorageSet('hybrid_subscribers_list', subscribers.slice(0, 100));
  }, [subscribers]);

  useEffect(() => {
    safeLocalStorageSet('hybrid_user_is_subscribed', isSubscribed ? 'true' : 'false');
  }, [isSubscribed]);

  useEffect(() => {
    safeLocalStorageSet('hybrid_monthly_fee', monthlyFeePkr.toString());
  }, [monthlyFeePkr]);

  useEffect(() => {
    safeLocalStorageSet('hybrid_all_applications', allApplications.slice(0, 100));
  }, [allApplications]);

  // Filtering & Sorting
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesCompany = job.company.toLowerCase().includes(q);
        const matchesTags = job.tags.some((t) => t.toLowerCase().includes(q));
        const matchesLocation = (job.city && job.city.toLowerCase().includes(q)) ||
                                (job.district && job.district.toLowerCase().includes(q)) ||
                                (job.province && job.province.toLowerCase().includes(q));

        if (!matchesTitle && !matchesCompany && !matchesTags && !matchesLocation) {
          return false;
        }
      }

      if (filters.jobType !== 'All' && job.jobType !== filters.jobType) return false;
      if (filters.region !== 'All' && job.region !== filters.region) return false;

      if (filters.region === 'Pakistan') {
        if (filters.province && job.province !== filters.province) return false;
        if (filters.city && job.city !== filters.city) return false;
        if (filters.district && job.district !== filters.district) return false;
      }

      if (filters.experienceLevel !== 'All' && job.experienceLevel !== filters.experienceLevel) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // 1. Primary Ranking: Top Pinned / VIP Bundle / Featured Top / Urgent / Future Opportunity
      const getPriorityRank = (job: Job): number => {
        let rank = 0;
        if (job.isPinnedTop) rank += 1000;
        if (job.priorityTier === 'vip_bundle') rank += 800;
        if (job.priorityTier === 'featured_top') rank += 600;
        if (job.featured) rank += 400;
        if (job.priorityTier === 'urgent') rank += 300;
        if (job.urgent) rank += 200;
        if (job.isFutureJob) rank += 100;
        return rank;
      };

      const rankA = getPriorityRank(a);
      const rankB = getPriorityRank(b);

      if (rankA !== rankB) {
        return rankB - rankA; // Higher priority pinned items appear at the very top
      }

      // 2. Secondary Sorting within the same priority tier
      if (filters.sortBy === 'salary-high') return (b.salaryNumericMin || 0) - (a.salaryNumericMin || 0);
      if (filters.sortBy === 'salary-low') return (a.salaryNumericMin || 0) - (b.salaryNumericMin || 0);
      if (filters.sortBy === 'popular') return b.applicationsCount - a.applicationsCount;
      return 0;
    });
  }, [jobs, filters]);

  // Profile & Password Handlers
  const handleUpdateProfile = (updatedUser: UserAccount) => {
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleChangePassword = (currentPass: string, newPass: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.password && currentUser.password !== currentPass) {
      return false;
    }
    const updatedUser = { ...currentUser, password: newPass };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    return true;
  };

  const handleAdminUpdateUserPassword = (userId: string, newPass: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPass } : u));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, password: newPass } : null);
    }
    alert(`Password for user updated successfully to "${newPass}".`);
  };

  // Handlers
  const handleToggleSaveJob = (jobId: string) => {
    setSavedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleApplyClick = (job: Job) => {
    if (!isSubscribed) {
      setSelectedJobTitleForSub(job.title);
      setSubscriptionModalOpen(true);
    } else {
      const newApp: JobApplication = {
        id: 'app-' + Date.now(),
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.company,
        applicantId: currentUser ? currentUser.id : 'usr-demo-1',
        applicantName: currentUser ? currentUser.name : 'Guest Candidate',
        applicantEmail: currentUser ? currentUser.email : 'guest@example.com',
        appliedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'Under Review',
        paymentStatus: 'Subscription Paid'
      };

      setAllApplications(prev => [newApp, ...prev]);

      if (currentUser) {
        const updatedUser: UserAccount = {
          ...currentUser,
          appliedJobs: [...(currentUser.appliedJobs || []), newApp]
        };
        handleUpdateProfile(updatedUser);
      }

      alert(`Application Submitted! Your candidate profile has been sent to ${job.company} HR.`);
    }
  };

  const handleSubscribeSuccess = (newSub: Subscriber) => {
    setSubscribers((prev) => [newSub, ...prev]);
    setIsSubscribed(true);
    setSubscriptionModalOpen(false);

    if (currentUser) {
      setCurrentUser({ ...currentUser, plan: 'Premium', autoRenew: true });
    }
  };

  // User Auth Login Success
  const handleLoginSuccess = (account: UserAccount) => {
    setCurrentUser(account);
    setActiveTab('dashboard');
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === account.id || u.email === account.email);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = account;
        return copy;
      }
      return [account, ...prev];
    });
  };

  // Auto-Renew Toggle Switch Handler for Current User
  const handleToggleAutoRenew = () => {
    if (!currentUser) return;
    const updated = { ...currentUser, autoRenew: !currentUser.autoRenew };
    setCurrentUser(updated);
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
  };

  useEffect(() => {
    localStorage.setItem('hybrid_job_posting_fee', jobPostingFeePkr.toString());
  }, [jobPostingFeePkr]);

  useEffect(() => {
    localStorage.setItem('hybrid_job_fee_logs', JSON.stringify(jobPostingFeeLogs));
  }, [jobPostingFeeLogs]);

  // Handlers for Admin Subscription Controls
  const handleUpdateUserExpiry = (userId: string, newExpiryDate: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, expiryDate: newExpiryDate } : u));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, expiryDate: newExpiryDate } : null);
    }
  };

  const handleToggleUserPlan = (userId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextPlan = u.plan === 'Premium' ? 'Free' : 'Premium';
        return { ...u, plan: nextPlan };
      }
      return u;
    }));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, plan: prev.plan === 'Premium' ? 'Free' : 'Premium' } : null);
    }
  };

  // Admin Ends Unpaid Membership
  const handleEndUserMembership = (userId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          plan: 'Free',
          membershipStatus: 'Revoked',
          paymentStatus: 'Unpaid',
          autoRenew: false,
          expiryDate: '2020-01-01 00:00'
        };
      }
      return u;
    }));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => prev ? {
        ...prev,
        plan: 'Free',
        membershipStatus: 'Revoked',
        paymentStatus: 'Unpaid',
        autoRenew: false,
        expiryDate: '2020-01-01 00:00'
      } : null);
    }
    alert('User premium membership has been terminated/revoked due to unpaid status.');
  };

  // Admin Deactivates all jobs posted by a specific user
  const handleDeactivateUserJobs = (userId: string) => {
    const user = users.find(u => u.id === userId);
    const userCompanyName = user?.name?.toLowerCase();
    const userEmail = user?.email?.toLowerCase();

    setJobs(prev => prev.map(j => {
      const match = j.submittedByUserId === userId || 
                    (userCompanyName && j.company?.toLowerCase() === userCompanyName) ||
                    (userEmail && j.company?.toLowerCase() === userEmail);
      if (match) {
        return { ...j, status: 'Suspended', isSuspended: true, rejectionReason: 'Suspended: Unpaid Employer Account' };
      }
      return j;
    }));

    setPendingJobs(prev => prev.map(j => {
      const match = j.submittedByUserId === userId || 
                    (userCompanyName && j.company?.toLowerCase() === userCompanyName) ||
                    (userEmail && j.company?.toLowerCase() === userEmail);
      if (match) {
        return { ...j, status: 'Rejected', isSuspended: true, rejectionReason: 'Suspended: Unpaid Employer Account' };
      }
      return j;
    }));

    alert(`All posted jobs for user "${user?.name || userId}" have been suspended/deactivated.`);
  };

  // Admin Ends Both Membership and Deactivates Jobs
  const handleEndUserMembershipAndJobs = (userId: string) => {
    handleEndUserMembership(userId);
    handleDeactivateUserJobs(userId);
    alert('Terminated membership and deactivated all associated job postings.');
  };

  // Admin Suspends an individual Job
  const handleSuspendJob = (jobId: string, reason?: string) => {
    const suspendReason = reason || 'Suspended by Admin (Unpaid Employer / Terms Violation)';
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'Suspended', isSuspended: true, rejectionReason: suspendReason } : j));
    setPendingJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'Rejected', isSuspended: true, rejectionReason: suspendReason } : j));
    alert(`Job has been suspended.`);
  };

  // Bulk End All Unpaid Memberships & Deactivate Jobs
  const handleBulkEndUnpaidMemberships = () => {
    const unpaidUserIds = users.filter(u => u.paymentStatus === 'Unpaid' || u.membershipStatus === 'Revoked' || (u.expiryDate && new Date(u.expiryDate).getTime() < Date.now())).map(u => u.id);
    
    if (unpaidUserIds.length === 0) {
      alert('All users currently have active, valid paid memberships.');
      return;
    }

    setUsers(prev => prev.map(u => {
      if (unpaidUserIds.includes(u.id)) {
        return {
          ...u,
          plan: 'Free',
          membershipStatus: 'Revoked',
          paymentStatus: 'Unpaid',
          autoRenew: false,
          expiryDate: '2020-01-01 00:00'
        };
      }
      return u;
    }));

    setJobs(prev => prev.map(j => {
      if (j.submittedByUserId && unpaidUserIds.includes(j.submittedByUserId)) {
        return { ...j, status: 'Suspended', isSuspended: true, rejectionReason: 'Bulk Action: Suspended due to unpaid employer membership' };
      }
      return j;
    }));

    alert(`Enforced unpaid policy on ${unpaidUserIds.length} user account(s) and suspended their active jobs.`);
  };

  // User submits job for admin verification with optional Fee Payment
  const handleSubmitJobForApproval = (newJob: Job, feePayment?: { amount: number; paymentMethod: string }) => {
    setPendingJobs(prev => [newJob, ...prev.filter(j => j.id !== newJob.id)]);

    if (feePayment && currentUser) {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      
      const newLog: JobPostingFeeLog = {
        id: 'log-' + Date.now(),
        jobTitle: newJob.title,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        amount: feePayment.amount,
        currency: 'PKR',
        paymentMethod: feePayment.paymentMethod,
        dateTime: nowStr,
        status: 'Paid'
      };

      setJobPostingFeeLogs(prev => [newLog, ...prev]);

      const newTx: PaymentTransaction = {
        id: 'tx-job-fee-' + Date.now(),
        dateTime: nowStr,
        amount: feePayment.amount,
        currency: 'PKR',
        type: 'Job Posting Fee',
        status: 'Success',
        paymentMethod: (feePayment.paymentMethod as 'JazzCash' | 'Easypaisa' | 'Credit Card' | 'Bank Transfer') || 'JazzCash',
        jobTitleRef: newJob.title
      };

      const updatedUser: UserAccount = {
        ...currentUser,
        transactions: [newTx, ...(currentUser.transactions || [])]
      };

      setCurrentUser(updatedUser);
      setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    }
  };

  // User Manual Subscription Renewal (+30 Days)
  const handleRenewSubscription = () => {
    if (!currentUser) return;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const currentExp = currentUser.expiryDate || '2026-08-24 09:00';
    const parts = currentExp.split(' ');
    const dateParts = parts[0].split('-');
    const d = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
    d.setDate(d.getDate() + 30);
    const newExp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${parts[1] || '09:00'}`;

    const newTx: PaymentTransaction = {
      id: 'tx-renew-' + Date.now(),
      dateTime: nowStr,
      amount: monthlyFeePkr,
      currency: 'PKR',
      type: 'Subscription',
      status: 'Success',
      paymentMethod: 'JazzCash'
    };

    const updatedUser: UserAccount = {
      ...currentUser,
      plan: 'Premium',
      expiryDate: newExp,
      renewalCount: (currentUser.renewalCount || 1) + 1,
      transactions: [newTx, ...(currentUser.transactions || [])]
    };

    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    alert(`Subscription renewed successfully! New Expiry Date: ${newExp}`);
  };

  // Admin Approves Job
  const handleApproveJob = (jobId: string) => {
    const jobToApprove = pendingJobs.find(j => j.id === jobId);
    if (jobToApprove) {
      const approvedJob: Job = { ...jobToApprove, status: 'Approved' };
      setJobs(prev => [approvedJob, ...prev.filter(j => j.id !== jobId)]);
      setPendingJobs(prev => prev.filter(j => j.id !== jobId));
      alert(`Job "${approvedJob.title}" is now LIVE on the public portal!`);
    }
  };

  // Admin Rejects Job with Custom Reason
  const handleRejectJob = (jobId: string, reason: string) => {
    const rejectedJob = pendingJobs.find(j => j.id === jobId);
    if (rejectedJob) {
      const updatedJob: Job = { ...rejectedJob, status: 'Rejected', rejectionReason: reason };
      setJobs(prev => [updatedJob, ...prev.filter(j => j.id !== jobId)]);
      setPendingJobs(prev => prev.filter(j => j.id !== jobId));

      // Push notification message into user's chat thread
      if (rejectedJob.submittedByUserId) {
        const chatMsg: ChatMessage = {
          id: 'msg-' + Date.now(),
          userId: rejectedJob.submittedByUserId,
          userName: 'User',
          senderRole: 'admin',
          text: `Update regarding your job "${rejectedJob.title}": Rejected. Reason: ${reason}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, chatMsg]);
      }

      alert(`Job rejected. Reason notification sent to user chat.`);
    }
  };

  // Two-way User Chat Message sending
  const handleUserSendMessage = (text: string) => {
    if (!currentUser) return;
    const msg: ChatMessage = {
      id: 'msg-' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      senderRole: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, msg]);
  };

  // Admin Chat Reply
  const handleAdminSendMessage = (userId: string, userName: string, text: string) => {
    const msg: ChatMessage = {
      id: 'msg-' + Date.now(),
      userId,
      userName,
      senderRole: 'admin',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, msg]);
  };

  // Custom Form Fields Handlers
  const handleAddCustomField = (field: CustomFormField) => {
    setCustomFormFields(prev => [...prev, field]);
  };

  const handleToggleCustomField = (fieldId: string) => {
    setCustomFormFields(prev =>
      prev.map(f => f.id === fieldId ? { ...f, active: !f.active } : f)
    );
  };

  const handleDeleteCustomField = (fieldId: string) => {
    setCustomFormFields(prev => prev.filter(f => f.id !== fieldId));
  };

  // Self-Serve Ad Campaign Submissions & Wallet Management
  const handleSubmitCampaign = (newAd: Advertisement, cost: number) => {
    if (!currentUser) return;
    
    // Add ad to advertisements with pending_approval status
    const campaignWithUser: Advertisement = {
      ...newAd,
      id: newAd.id || 'ad-camp-' + Date.now(),
      status: 'pending_approval',
      submittedByUserId: currentUser.id,
      submittedByUserName: currentUser.name,
      submittedByUserEmail: currentUser.email,
      campaignCostPkr: cost
    };

    setAdvertisements(prev => [campaignWithUser, ...prev]);

    // Deduct from wallet balance
    const currentBalance = currentUser.walletBalance ?? 25000;
    const newBalance = Math.max(0, currentBalance - cost);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newTx: PaymentTransaction = {
      id: 'tx-ad-camp-' + Date.now(),
      dateTime: nowStr,
      amount: cost,
      currency: 'PKR',
      type: 'Ad Campaign Fee',
      status: 'Success',
      paymentMethod: 'Wallet Balance',
      jobTitleRef: `Campaign: ${newAd.title}`
    };

    const updatedUser: UserAccount = {
      ...currentUser,
      walletBalance: newBalance,
      transactions: [newTx, ...(currentUser.transactions || [])]
    };

    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));

    // Send confirmation message to user chat
    const confirmMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      userId: currentUser.id,
      userName: 'Portal Admin',
      senderRole: 'admin',
      text: `Your campaign "${newAd.title}" has been submitted for admin approval! Fee deducted: PKR ${cost.toLocaleString()}. Remaining wallet balance: PKR ${newBalance.toLocaleString()}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, confirmMsg]);
  };

  // Deposit funds into user wallet
  const handleDepositFunds = (amount: number, paymentMethod: string) => {
    if (!currentUser) return;

    const currentBalance = currentUser.walletBalance ?? 0;
    const newBalance = currentBalance + amount;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newTx: PaymentTransaction = {
      id: 'tx-dep-' + Date.now(),
      dateTime: nowStr,
      amount: amount,
      currency: 'PKR',
      type: 'Wallet Deposit',
      status: 'Success',
      paymentMethod: (paymentMethod as 'JazzCash' | 'Easypaisa' | 'Credit Card' | 'Bank Transfer') || 'JazzCash'
    };

    const updatedUser: UserAccount = {
      ...currentUser,
      walletBalance: newBalance,
      transactions: [newTx, ...(currentUser.transactions || [])]
    };

    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));

    alert(`Successfully deposited PKR ${amount.toLocaleString()} via ${paymentMethod}! New Wallet Balance: PKR ${newBalance.toLocaleString()}`);
  };

  // Admin Approves Ad Campaign
  const handleApproveAd = (adId: string) => {
    const adToApprove = advertisements.find(a => a.id === adId);
    if (!adToApprove) return;

    const now = new Date();
    const startDateStr = now.toISOString().slice(0, 10);
    const endDate = new Date(now);
    if (adToApprove.durationUnit === 'hours') {
      endDate.setHours(endDate.getHours() + (adToApprove.durationValue || 24));
    } else if (adToApprove.durationUnit === 'weeks') {
      endDate.setDate(endDate.getDate() + (adToApprove.durationValue || 1) * 7);
    } else if (adToApprove.durationUnit === 'months') {
      endDate.setMonth(endDate.getMonth() + (adToApprove.durationValue || 1));
    } else {
      // days
      endDate.setDate(endDate.getDate() + (adToApprove.durationValue || 1));
    }

    const updatedAd: Advertisement = {
      ...adToApprove,
      status: 'active',
      scheduledStartAt: adToApprove.scheduledStartAt || startDateStr,
      scheduledEndAt: adToApprove.scheduledEndAt || endDate.toISOString().slice(0, 10),
      rejectionReason: undefined
    };

    setAdvertisements(prev => prev.map(a => a.id === adId ? updatedAd : a));

    if (adToApprove.submittedByUserId) {
      const msg: ChatMessage = {
        id: 'msg-' + Date.now(),
        userId: adToApprove.submittedByUserId,
        userName: 'Portal Admin',
        senderRole: 'admin',
        text: `🎉 Good news! Your campaign "${adToApprove.title}" has been APPROVED by the portal admin and is now LIVE on the platform!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, msg]);
    }

    alert(`Campaign "${adToApprove.title}" has been approved and activated!`);
  };

  // Admin Rejects Ad Campaign with Reason & Full Wallet Refund
  const handleRejectAd = (adId: string, reason: string) => {
    const adToReject = advertisements.find(a => a.id === adId);
    if (!adToReject) return;

    const updatedAd: Advertisement = {
      ...adToReject,
      status: 'rejected',
      rejectionReason: reason
    };

    setAdvertisements(prev => prev.map(a => a.id === adId ? updatedAd : a));

    // Refund wallet balance if user submitted it and paid
    if (adToReject.submittedByUserId && adToReject.campaignCostPkr && adToReject.campaignCostPkr > 0) {
      const refundAmount = adToReject.campaignCostPkr;
      const targetUserId = adToReject.submittedByUserId;
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

      const refundTx: PaymentTransaction = {
        id: 'tx-refund-' + Date.now(),
        dateTime: nowStr,
        amount: refundAmount,
        currency: 'PKR',
        type: 'Refund',
        status: 'Success',
        paymentMethod: 'Wallet Balance',
        jobTitleRef: `Refund for Rejected Campaign: ${adToReject.title}`
      };

      setUsers(prev => prev.map(u => {
        if (u.id === targetUserId) {
          const currentBal = u.walletBalance ?? 0;
          return {
            ...u,
            walletBalance: currentBal + refundAmount,
            transactions: [refundTx, ...(u.transactions || [])]
          };
        }
        return u;
      }));

      if (currentUser && currentUser.id === targetUserId) {
        const currentBal = currentUser.walletBalance ?? 0;
        setCurrentUser(prev => prev ? {
          ...prev,
          walletBalance: currentBal + refundAmount,
          transactions: [refundTx, ...(prev.transactions || [])]
        } : null);
      }

      // Notify in user's chat thread
      const msg: ChatMessage = {
        id: 'msg-' + Date.now(),
        userId: targetUserId,
        userName: 'Portal Admin',
        senderRole: 'admin',
        text: `⚠️ Campaign Update: Your campaign "${adToReject.title}" was not approved. Reason: ${reason}. A 100% refund of PKR ${refundAmount.toLocaleString()} has been credited back to your wallet balance.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, msg]);
    }

    alert(`Campaign rejected. Reason and full refund of PKR ${adToReject.campaignCostPkr?.toLocaleString() || 0} processed to user.`);
  };

  const userJobs = useMemo(() => {
    if (!currentUser) return [];
    return jobs.filter(j => j.submittedByUserId === currentUser.id);
  }, [jobs, currentUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Dynamic Global Admin Announcement Banner */}
      {siteSeoConfig.announcementBanner?.enabled && !dismissAnnouncement && (
        <div
          id="global-admin-announcement"
          className={`relative px-4 py-2 text-xs font-semibold flex items-center justify-between transition-all border-b shadow-sm ${
            siteSeoConfig.announcementBanner.bannerType === 'urgent'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800/80'
              : siteSeoConfig.announcementBanner.bannerType === 'warning'
              ? 'bg-amber-950/90 text-amber-200 border-amber-800/80'
              : siteSeoConfig.announcementBanner.bannerType === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/80'
              : 'bg-indigo-950/90 text-indigo-200 border-indigo-800/80'
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2 text-center flex-1">
            {siteSeoConfig.announcementBanner.bannerType === 'urgent' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
            {siteSeoConfig.announcementBanner.bannerType === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            {siteSeoConfig.announcementBanner.bannerType === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            {siteSeoConfig.announcementBanner.bannerType === 'info' && <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
            <span>{siteSeoConfig.announcementBanner.text}</span>
            {siteSeoConfig.announcementBanner.linkText && (
              <a
                href={siteSeoConfig.announcementBanner.linkUrl || '#'}
                onClick={(e) => {
                  if (siteSeoConfig.announcementBanner.linkUrl?.startsWith('#')) {
                    e.preventDefault();
                    setActiveTab('jobs');
                    document.getElementById('jobs-section')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center space-x-1 underline font-bold ml-2 hover:opacity-80"
              >
                <span>{siteSeoConfig.announcementBanner.linkText}</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            )}
          </div>
          <button
            onClick={() => setDismissAnnouncement(true)}
            className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
            title="Dismiss Announcement"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Sticky Announcement / Banner Ad */}
      <TopBannerAd
        ads={advertisements}
        currentPage={activeTab}
        onAdClick={handleAdClick}
        onNavigateTab={setActiveTab}
      />

      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setShowAdminView(false);
        }}
        isSubscribed={isSubscribed}
        onOpenSubscriptionModal={() => {
          setSelectedJobTitleForSub('');
          setSubscriptionModalOpen(true);
        }}
        savedJobsCount={savedJobIds.length}
        currentUser={currentUser}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        onToggleAdminView={() => setShowAdminView(!showAdminView)}
        showAdminView={showAdminView}
        activeAdsCount={advertisements.filter((a) => a.status === 'active').length}
        onOpenAdDrawer={() => setIsAdDrawerOpen(true)}
        selectedCountryName={userSelectedCountry?.name || 'All Countries'}
        selectedCountryFlag={userSelectedCountry?.flag || '🌐'}
        onOpenCountryModal={() => setShowCountryModal(true)}
      />

      {/* Main View Area */}
      <main className="flex-1">
        
        {/* SECRET ADMIN DASHBOARD VIEW */}
        {showAdminView && isAdminLoggedIn ? (
          <AdminDashboard
            jobs={jobs.filter(j => j.status !== 'Pending')}
            pendingJobs={pendingJobs}
            subscribers={subscribers}
            users={users}
            chatMessages={chatMessages}
            customFormFields={customFormFields}
            jobPostingFeePkr={jobPostingFeePkr}
            jobPostingFeeLogs={jobPostingFeeLogs}
            allApplications={allApplications}
            onChangeJobPostingFee={setJobPostingFeePkr}
            onUpdateUserExpiry={handleUpdateUserExpiry}
            onToggleUserPlan={handleToggleUserPlan}
            onUpdateUserPassword={handleAdminUpdateUserPassword}
            onApproveJob={handleApproveJob}
            onRejectJob={handleRejectJob}
            onAddJob={(newJob) => setJobs(prev => [newJob, ...prev.filter(j => j.id !== newJob.id)])}
            onAddPendingJob={(newJob) => setPendingJobs(prev => [newJob, ...prev.filter(j => j.id !== newJob.id)])}
            onBulkAddJobs={(newJobs) => {
              setJobs(prev => {
                const existing = new Set(prev.map(j => j.id));
                const uniqueNew = newJobs.filter(j => !existing.has(j.id));
                return [...uniqueNew, ...prev];
              });
            }}
            onBulkAddPendingJobs={(newJobs) => {
              setPendingJobs(prev => {
                const existing = new Set(prev.map(j => j.id));
                const uniqueNew = newJobs.filter(j => !existing.has(j.id));
                return [...uniqueNew, ...prev];
              });
            }}
            onDeleteJob={(jobId) => setJobs(prev => prev.filter(j => j.id !== jobId))}
            onSendMessageToUser={handleAdminSendMessage}
            onAddCustomField={handleAddCustomField}
            onToggleCustomField={handleToggleCustomField}
            onDeleteCustomField={handleDeleteCustomField}
            onEndUserMembership={handleEndUserMembership}
            onDeactivateUserJobs={handleDeactivateUserJobs}
            onEndUserMembershipAndJobs={handleEndUserMembershipAndJobs}
            onSuspendJob={handleSuspendJob}
            onBulkEndUnpaidMemberships={handleBulkEndUnpaidMemberships}
            onUpdateJob={(updatedJob) => setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j))}
            onBulkDeleteJobs={(jobIds) => setJobs(prev => prev.filter(j => !jobIds.includes(j.id)))}
            onBulkUpdateJobs={(updatedList) => {
              const map = new Map(updatedList.map(u => [u.id, u]));
              setJobs(prev => prev.map(j => map.get(j.id) || j));
            }}
            onBulkApprovePendingJobs={(jobIds) => {
              const toApprove = pendingJobs.filter(j => jobIds.includes(j.id)).map(j => ({ ...j, status: 'Approved' as const }));
              setPendingJobs(prev => prev.filter(j => !jobIds.includes(j.id)));
              setJobs(prev => [...toApprove, ...prev]);
            }}
            onBulkRejectPendingJobs={(jobIds) => {
              setPendingJobs(prev => prev.filter(j => !jobIds.includes(j.id)));
            }}
            onAddSubscriber={(newSub) => setSubscribers(prev => [newSub, ...prev.filter(s => s.id !== newSub.id)])}
            onUpdateSubscriber={(updatedSub) => setSubscribers(prev => prev.map(s => s.id === updatedSub.id ? updatedSub : s))}
            onDeleteSubscriber={(subId) => setSubscribers(prev => prev.filter(s => s.id !== subId))}
            onBulkDeleteSubscribers={(subIds) => setSubscribers(prev => prev.filter(s => !subIds.includes(s.id)))}
            onUpdateUser={(updatedUser) => setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u))}
            onBulkDeleteUsers={(userIds) => setUsers(prev => prev.filter(u => !userIds.includes(u.id)))}
            onDeleteFeeLog={(logId) => setJobPostingFeeLogs(prev => prev.filter(l => l.id !== logId))}
            onBulkDeleteFeeLogs={(logIds) => setJobPostingFeeLogs(prev => prev.filter(l => !logIds.includes(l.id)))}
            monthlyFeePkr={monthlyFeePkr}
            onChangeMonthlyFee={setMonthlyFeePkr}
            onExitAdmin={() => setShowAdminView(false)}
            ads={advertisements}
            onAddAd={handleAddAd}
            onUpdateAd={handleUpdateAd}
            onDeleteAd={handleDeleteAd}
            onResetAdMetrics={handleResetAdMetrics}
            pricingConfig={pricingConfig}
            onUpdatePricingConfig={setPricingConfig}
            campaignConfig={campaignConfig}
            onUpdateCampaignConfig={setCampaignConfig}
            onApproveAd={handleApproveAd}
            onRejectAd={handleRejectAd}
            jobPostingPricing={jobPostingPricing}
            onChangeJobPostingPricing={setJobPostingPricing}
            landingConfig={landingConfig}
            onUpdateLandingConfig={setLandingConfig}
            whatsAppSupportConfig={whatsAppSupportConfig}
            onUpdateWhatsAppConfig={setWhatsAppSupportConfig}
            paymentTransactions={paymentTransactions}
            onApprovePaymentTransaction={handleApprovePaymentTransaction}
            onRejectPaymentTransaction={handleRejectPaymentTransaction}
          />
        ) : (
          <>
            {/* JOBS PORTAL TAB (Dynamic Landing Page Sections Sequenced by Admin) */}
            {activeTab === 'jobs' && (
              <div className="space-y-6">
                {(landingConfig.sections || [])
                  .filter((sec) => sec.isEnabled)
                  .sort((a, b) => a.order - b.order)
                  .map((section) => {
                    if (section.id === 'hero') {
                      return (
                        <HeroSection
                          key="section-hero"
                          heroConfig={landingConfig.hero}
                          totalJobsCount={jobs.length}
                          onExploreClick={() => {
                            const el = document.getElementById('jobs-section');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          onCvClick={() => setActiveTab('cv')}
                          onPostJobClick={handlePostJobClick}
                        />
                      );
                    }

                    if (section.id === 'promo-banners') {
                      const activeBanners = (campaignConfig.promoBanners || []).filter(b => b.isEnabled);
                      if (activeBanners.length === 0) return null;
                      return (
                        <div key="section-promo" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
                          {activeBanners.map((banner) => (
                            <div
                              key={banner.id}
                              className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-r ${banner.bgGradient || 'from-amber-600 via-rose-600 to-indigo-700'} text-white shadow-xl shadow-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/20`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/30 text-white">
                                    {banner.badgeText || '🔥 SPECIAL OFFER'}
                                  </span>
                                  <span className="text-xs font-black font-mono bg-white/20 px-2 py-0.5 rounded text-white">
                                    {banner.discountPercent}% OFF
                                  </span>
                                  {banner.promoCode && (
                                    <span className="text-xs font-mono font-bold bg-black/40 px-2 py-0.5 rounded border border-white/20">
                                      Use Code: {banner.promoCode}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm sm:text-base font-black tracking-tight">{banner.title}</h4>
                                <p className="text-xs text-white/90 max-w-2xl">{banner.description}</p>
                              </div>

                              <button
                                onClick={() => {
                                  if (currentUser) {
                                    setActiveTab('dashboard');
                                  } else {
                                    setAuthModalOpen(true);
                                  }
                                }}
                                className="px-5 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
                              >
                                {banner.ctaText || 'Book Discount Ad'} →
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    if (section.id === 'top-sponsor-ads') {
                      return null; // TopBannerAd renders sticky at top
                    }

                    if (section.id === 'quick-stats') {
                      return (
                        <div key="section-stats" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                            <div className="p-3 text-center">
                              <div className="text-xl sm:text-2xl font-black text-amber-400">{jobs.length}+</div>
                              <div className="text-[11px] text-slate-400 font-semibold">{landingConfig.hero.statBadge1Text || 'Active Verified Vacancies'}</div>
                            </div>
                            <div className="p-3 text-center">
                              <div className="text-xl sm:text-2xl font-black text-emerald-400">100% Free</div>
                              <div className="text-[11px] text-slate-400 font-semibold">{landingConfig.hero.statBadge2Text || 'Automated ATS Resume'}</div>
                            </div>
                            <div className="p-3 text-center">
                              <div className="text-xl sm:text-2xl font-black text-indigo-400">36+ Districts</div>
                              <div className="text-[11px] text-slate-400 font-semibold">{landingConfig.hero.statBadge3Text || 'Punjab, Sindh, KPK & Global'}</div>
                            </div>
                            <div className="p-3 text-center">
                              <div className="text-xl sm:text-2xl font-black text-teal-400">Instant</div>
                              <div className="text-[11px] text-slate-400 font-semibold">{landingConfig.hero.statBadge4Text || 'WhatsApp & Email Alerts'}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (section.id === 'custom-announcements') {
                      const activeCards = (landingConfig.customCards || []).filter(c => c.isEnabled);
                      if (activeCards.length === 0) return null;
                      return (
                        <div key="section-cards" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeCards.sort((a, b) => a.order - b.order).map((card) => (
                              <div
                                key={card.id}
                                className={`p-6 rounded-2xl bg-gradient-to-r ${card.bgGradient || 'from-slate-900 to-indigo-950'} border border-white/10 text-white flex flex-col justify-between space-y-4 shadow-xl`}
                              >
                                <div className="space-y-2">
                                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-black/40 text-amber-300 border border-white/20 inline-block">
                                    {card.badge}
                                  </span>
                                  <h4 className="text-lg font-black">{card.title}</h4>
                                  <p className="text-xs text-slate-300 leading-relaxed">{card.description}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    if (card.buttonUrl?.startsWith('#')) {
                                      const tab = card.buttonUrl.replace('#', '') as any;
                                      if (['jobs', 'cv', 'alerts', 'dashboard'].includes(tab)) {
                                        setActiveTab(tab);
                                      } else {
                                        const el = document.getElementById(tab);
                                        el?.scrollIntoView({ behavior: 'smooth' });
                                      }
                                    }
                                  }}
                                  className="self-start px-4 py-2 rounded-xl bg-white text-slate-950 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer shadow-md"
                                >
                                  {card.buttonText} →
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (section.id === 'jobs-feed') {
                      return (
                        <div key="section-jobs-feed" id="jobs-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                          
                          {/* Active Country Filter Notification Badge */}
                          {userSelectedCountry && userSelectedCountry.code !== 'GL' && (
                            <div className="p-3 bg-gradient-to-r from-slate-900 to-slate-800 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center space-x-2.5">
                                <span className="text-xl">{userSelectedCountry.flag}</span>
                                <div>
                                  <span className="font-bold text-white">
                                    Showing Jobs for {userSelectedCountry.name} ({userSelectedCountry.nameUrdu})
                                  </span>
                                  <p className="text-[11px] text-slate-400">
                                    Sorted by recently updated & priority verified listings.
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => setShowCountryModal(true)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[11px] border border-amber-500/20 transition-all cursor-pointer shrink-0"
                              >
                                Change Country
                              </button>
                            </div>
                          )}

                          {/* Filters Bar */}
                          <Filters
                            filters={filters}
                            onChange={handleFiltersChange}
                            onReset={handleResetFilters}
                            totalResults={filteredJobs.length}
                            postsPerPage={postsPerPage}
                            onPostsPerPageChange={handlePostsPerPageChange}
                          />

                          {/* Job Cards Grid with Pagination and Inline Ads */}
                          <JobListings
                            jobs={filteredJobs}
                            savedJobIds={savedJobIds}
                            onToggleSaveJob={handleToggleSaveJob}
                            onSelectJob={(job) => setSelectedJob(job)}
                            onApplyClick={handleApplyClick}
                            isSubscribed={isSubscribed}
                            currentPage={currentPage}
                            postsPerPage={postsPerPage}
                            onPageChange={setCurrentPage}
                            onPostsPerPageChange={handlePostsPerPageChange}
                            ads={advertisements}
                            feedInlineSettings={campaignConfig.feedInlineSettings}
                            onAdClick={handleAdClick}
                            onNavigateTab={setActiveTab}
                          />
                        </div>
                      );
                    }

                    return null;
                  })}
              </div>
            )}

            {/* REGISTERED USER DASHBOARD TAB */}
            {activeTab === 'dashboard' && currentUser && (
              <UserDashboard
                currentUser={currentUser}
                userJobs={userJobs}
                chatMessages={chatMessages}
                jobPostingFeePkr={jobPostingFeePkr}
                userApplications={allApplications}
                allJobs={jobs}
                savedJobIds={savedJobIds}
                onSelectJob={(job) => setSelectedJob(job)}
                onApplyJob={handleApplyClick}
                onToggleSaveJob={handleToggleSaveJob}
                initialTab={userDashboardInitialTab}
                userAds={advertisements.filter(a => a.submittedByUserId === currentUser.id)}
                allAds={advertisements}
                pricingConfig={pricingConfig}
                campaignConfig={campaignConfig}
                jobPostingPricing={jobPostingPricing}
                onSubmitCampaign={handleSubmitCampaign}
                onDepositFunds={handleDepositFunds}
                onDeleteAd={handleDeleteAd}
                onDuplicateAd={handleAddAd}
                onToggleAutoRenew={handleToggleAutoRenew}
                onRenewSubscription={handleRenewSubscription}
                onSubmitJobForApproval={handleSubmitJobForApproval}
                onSendMessageToAdmin={handleUserSendMessage}
                onUpdateProfile={handleUpdateProfile}
                onChangePassword={handleChangePassword}
                onLogout={() => {
                  setCurrentUser(null);
                  setActiveTab('jobs');
                }}
                onOpenSubscriptionModal={() => setSubscriptionModalOpen(true)}
              />
            )}

            {/* AUTOMATED CV BUILDER TAB */}
            {activeTab === 'cv' && (
              <CvBuilder
                isSubscribed={isSubscribed}
                onOpenPaywall={() => setCvPaywallOpen(true)}
              />
            )}

            {/* WHATSAPP ALERTS TAB */}
            {activeTab === 'alerts' && (
              <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/30">
                  <Bell className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-white">
                  Get Daily Hybrid & Remote Job Opening Stream on WhatsApp
                </h2>
                <p className="text-slate-300 max-w-xl mx-auto text-sm leading-relaxed">
                  Subscribe to our verified daily job broadcast stream matching your specific province, city, and skill set.
                </p>

                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl max-w-lg mx-auto text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-base">Pro WhatsApp Alerts Package</span>
                    <span className="text-xl font-black text-emerald-400">PKR {monthlyFeePkr} <span className="text-xs font-normal text-slate-500">/ mo</span></span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Instant WhatsApp alerts as soon as new jobs are published</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Direct 1-Click Apply button for all global & Pakistan positions</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Free un-watermarked ATS Resume Export</span>
                    </li>
                  </ul>

                  <button
                    onClick={() => {
                      setSelectedJobTitleForSub('');
                      setSubscriptionModalOpen(true);
                    }}
                    className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl"
                  >
                    {isSubscribed ? 'Subscription Active (Pro User)' : `Activate Pro Alerts (PKR ${monthlyFeePkr})`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* Footer with Secret 5-Click Admin Panel Trigger and Legal Links */}
      <Footer
        onTriggerAdminClickTrick={() => setAdminLoginOpen(true)}
        onOpenSubscriptionModal={() => {
          setSelectedJobTitleForSub('');
          setSubscriptionModalOpen(true);
        }}
        onOpenLegalModal={(tab) => {
          setLegalModalTab(tab);
          setLegalModalOpen(true);
        }}
      />

      {/* Floating Sticky WhatsApp Quick-Action Button */}
      <WhatsAppStickyButton
        config={whatsAppSupportConfig}
        onOpenLegalModal={() => {
          setLegalModalTab('contact');
          setLegalModalOpen(true);
        }}
      />

      {/* MODALS */}
      <LegalDisclaimerModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        customFormFields={customFormFields}
        existingUsers={users}
      />

      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={handleApplyClick}
        isSaved={selectedJob ? savedJobIds.includes(selectedJob.id) : false}
        onToggleSave={handleToggleSaveJob}
      />

      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onSubscribeSuccess={handleSubscribeSuccess}
        initialSelectedJobTitle={selectedJobTitleForSub}
      />

      <CvPaywallModal
        isOpen={cvPaywallOpen}
        onClose={() => setCvPaywallOpen(false)}
        onUnlock={() => {
          setIsSubscribed(true);
          setCvPaywallOpen(false);
        }}
      />

      <AdminLoginModal
        isOpen={adminLoginOpen}
        onClose={() => setAdminLoginOpen(false)}
        onLoginSuccess={() => {
          setIsAdminLoggedIn(true);
          setShowAdminView(true);
        }}
      />

      {/* Country Selection Modal (Urdu/English First-Time & Switcher) */}
      <CountrySelectionModal
        isOpen={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        onSelectCountry={handleSelectCountry}
        currentSelectedCode={userSelectedCountry?.code}
        isInitialRequired={!userSelectedCountry}
      />

      {/* Pop-up Lightbox Advertisement Modal (Displays after country selection) */}
      {!showCountryModal && (
        <PopupAdModal
          ads={advertisements}
          currentPage={activeTab}
          popupSettings={campaignConfig.popupSettings}
          onAdClick={handleAdClick}
          onNavigateTab={setActiveTab}
        />
      )}

      {/* Floating Bottom-Right Toast Notification Ad */}
      <ToastNotificationAd
        ads={advertisements}
        currentPage={activeTab}
        onAdClick={handleAdClick}
        onNavigateTab={setActiveTab}
      />

      {/* Slide-out Notifications / Announcements Drawer */}
      <AdNotificationDrawer
        isOpen={isAdDrawerOpen}
        onClose={() => setIsAdDrawerOpen(false)}
        ads={advertisements}
        onAdClick={handleAdClick}
        onNavigateTab={setActiveTab}
      />

      {/* Persistent Floating WhatsApp Support & Alerts Button */}
      <WhatsAppStickyButton
        config={whatsAppSupportConfig}
        onOpenLegalModal={() => setLegalModalOpen(true)}
      />

    </div>
  );
}
