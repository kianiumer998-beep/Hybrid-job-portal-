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

import { Job, JobFilters, Subscriber, UserAccount, ChatMessage, CustomFormField, JobPostingFeeLog, PaymentTransaction, JobApplication } from './types/job';
import { INITIAL_JOBS } from './data/mockJobs';
import { Bell, Sparkles, CheckCircle2, Shield, Search } from 'lucide-react';

export default function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'jobs' | 'cv' | 'alerts' | 'dashboard'>('jobs');
  const [showAdminView, setShowAdminView] = useState<boolean>(false);

  // Registered Current User State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('hybrid_current_user');
    return saved ? JSON.parse(saved) : null;
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

    const parsed: UserAccount[] = JSON.parse(saved);
    const hasQwer = parsed.some(u => u.username === 'qwer');
    if (!hasQwer) {
      return [...defaultList, ...parsed];
    }
    return parsed;
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

  // Approved Live Jobs
  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('hybrid_jobs_list');
    return saved ? JSON.parse(saved) : INITIAL_JOBS;
  });

  // Pending Jobs Queue for Admin Verification
  const [pendingJobs, setPendingJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('hybrid_pending_jobs');
    return saved ? JSON.parse(saved) : [
      {
        id: 'job-pending-1',
        title: 'Senior Python & Django Developer',
        company: 'Systems Ltd',
        jobType: 'Remote',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Lahore',
        district: 'Gulberg',
        salary: 'PKR 300,000 - PKR 450,000 / month',
        currency: 'PKR',
        experienceLevel: 'Senior',
        department: 'Engineering',
        tags: ['Python', 'Django', 'PostgreSQL'],
        description: 'Building RESTful microservices for healthcare clients in USA.',
        requirements: ['4+ years Python experience', 'Strong SQL skills'],
        benefits: ['Health Insurance', 'USD Pegged Bonus'],
        postedAt: '10 mins ago',
        applicationsCount: 0,
        status: 'Pending',
        submittedByUserId: 'user-demo-2'
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
  const [userDashboardInitialTab, setUserDashboardInitialTab] = useState<'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat'>('overview');

  const handlePostJobClick = () => {
    setUserDashboardInitialTab('post-job');
    if (currentUser) {
      setActiveTab('dashboard');
    } else {
      setAuthModalOpen(true);
    }
  };

  // Filters State
  const [filters, setFilters] = useState<JobFilters>({
    searchQuery: '',
    jobType: 'All',
    region: 'All',
    province: '',
    city: '',
    district: '',
    experienceLevel: 'All',
    salaryMin: 0,
    sortBy: 'latest'
  });

  // LocalStorage Persist Effects
  useEffect(() => {
    localStorage.setItem('hybrid_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('hybrid_users_directory', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('hybrid_jobs_list', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('hybrid_pending_jobs', JSON.stringify(pendingJobs));
  }, [pendingJobs]);

  useEffect(() => {
    localStorage.setItem('hybrid_chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('hybrid_custom_form_fields', JSON.stringify(customFormFields));
  }, [customFormFields]);

  useEffect(() => {
    localStorage.setItem('hybrid_saved_job_ids', JSON.stringify(savedJobIds));
  }, [savedJobIds]);

  useEffect(() => {
    localStorage.setItem('hybrid_subscribers_list', JSON.stringify(subscribers));
  }, [subscribers]);

  useEffect(() => {
    localStorage.setItem('hybrid_user_is_subscribed', isSubscribed ? 'true' : 'false');
  }, [isSubscribed]);

  useEffect(() => {
    localStorage.setItem('hybrid_monthly_fee', monthlyFeePkr.toString());
  }, [monthlyFeePkr]);

  useEffect(() => {
    localStorage.setItem('hybrid_all_applications', JSON.stringify(allApplications));
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

  // User submits job for admin verification with optional Fee Payment
  const handleSubmitJobForApproval = (newJob: Job, feePayment?: { amount: number; paymentMethod: string }) => {
    setPendingJobs(prev => [newJob, ...prev]);

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
      setJobs(prev => [approvedJob, ...prev]);
      setPendingJobs(prev => prev.filter(j => j.id !== jobId));
      alert(`Job "${approvedJob.title}" is now LIVE on the public portal!`);
    }
  };

  // Admin Rejects Job with Custom Reason
  const handleRejectJob = (jobId: string, reason: string) => {
    const rejectedJob = pendingJobs.find(j => j.id === jobId);
    if (rejectedJob) {
      const updatedJob: Job = { ...rejectedJob, status: 'Rejected', rejectionReason: reason };
      setJobs(prev => [updatedJob, ...prev]);
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

  const userJobs = useMemo(() => {
    if (!currentUser) return [];
    return jobs.filter(j => j.submittedByUserId === currentUser.id);
  }, [jobs, currentUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      
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
            onAddJob={(newJob) => setJobs(prev => [newJob, ...prev])}
            onDeleteJob={(jobId) => setJobs(prev => prev.filter(j => j.id !== jobId))}
            onSendMessageToUser={handleAdminSendMessage}
            onAddCustomField={handleAddCustomField}
            onToggleCustomField={handleToggleCustomField}
            onDeleteCustomField={handleDeleteCustomField}
            monthlyFeePkr={monthlyFeePkr}
            onChangeMonthlyFee={setMonthlyFeePkr}
            onExitAdmin={() => setShowAdminView(false)}
          />
        ) : (
          <>
            {/* JOBS PORTAL TAB */}
            {activeTab === 'jobs' && (
              <>
                <HeroSection
                  totalJobsCount={jobs.length}
                  onExploreClick={() => {
                    const el = document.getElementById('jobs-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  onCvClick={() => setActiveTab('cv')}
                  onPostJobClick={handlePostJobClick}
                />

                <div id="jobs-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  
                  {/* Filters Bar */}
                  <Filters
                    filters={filters}
                    onChange={setFilters}
                    onReset={() =>
                      setFilters({
                        searchQuery: '',
                        jobType: 'All',
                        region: 'All',
                        province: '',
                        city: '',
                        district: '',
                        experienceLevel: 'All',
                        salaryMin: 0,
                        sortBy: 'latest'
                      })
                    }
                    totalResults={filteredJobs.length}
                  />

                  {/* Job Cards Grid */}
                  <JobListings
                    jobs={filteredJobs}
                    savedJobIds={savedJobIds}
                    onToggleSaveJob={handleToggleSaveJob}
                    onSelectJob={(job) => setSelectedJob(job)}
                    onApplyClick={handleApplyClick}
                    isSubscribed={isSubscribed}
                  />

                </div>
              </>
            )}

            {/* REGISTERED USER DASHBOARD TAB */}
            {activeTab === 'dashboard' && currentUser && (
              <UserDashboard
                currentUser={currentUser}
                userJobs={userJobs}
                chatMessages={chatMessages}
                jobPostingFeePkr={jobPostingFeePkr}
                userApplications={allApplications}
                initialTab={userDashboardInitialTab}
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

      {/* Footer with Secret 5-Click Admin Panel Trigger */}
      <Footer
        onTriggerAdminClickTrick={() => setAdminLoginOpen(true)}
        onOpenSubscriptionModal={() => {
          setSelectedJobTitleForSub('');
          setSubscriptionModalOpen(true);
        }}
      />

      {/* MODALS */}
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

    </div>
  );
}
