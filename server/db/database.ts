import fs from 'fs';
import path from 'path';
import { INITIAL_JOBS } from '../../src/data/mockJobs';
import { INITIAL_PAYMENT_TRANSACTIONS } from '../../src/data/mockTransactions';
import { INITIAL_ADVERTISEMENTS, DEFAULT_AD_PRICING_CONFIG } from '../../src/types/ad';
import { DEFAULT_JOB_POSTING_PRICING_CONFIG } from '../../src/types/job';
import { INITIAL_SITE_SEO_CONFIG } from '../../src/data/mockAdminSuiteData';
import { ALL_VERIFIED_SCRAPER_PORTALS } from '../../src/data/allScraperPortals';

const DATA_DIR = path.resolve(process.cwd(), 'data');

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeReadJson<T>(filename: string, fallback: T): T {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    safeWriteJson(filename, fallback);
    return fallback;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[DB Error] Failed reading ${filename}:`, err);
    return fallback;
  }
}

function safeWriteJson<T>(filename: string, data: T): void {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`[DB Error] Failed writing ${filename}:`, err);
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
}

export function generateJobSlug(title: string, city?: string, id?: string): string {
  const cleanTitle = (title || 'job')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const cleanCity = city
    ? city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    : '';
  const cleanId = id ? id.replace(/[^a-z0-9]+/gi, '').slice(-8) : Math.random().toString(36).substring(2, 8);
  
  if (cleanCity) {
    return `${cleanTitle}-${cleanCity}-${cleanId}`;
  }
  return `${cleanTitle}-${cleanId}`;
}

// Initial Data Seeders
const DEFAULT_USERS = [
  {
    id: 'user-demo-admin-1',
    name: 'Super Administrator',
    email: 'admin@jobportal.com',
    username: 'admin',
    // SHA256 / scrypt will verify 'admin123'
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // sha256 of admin123
    salt: 'dev-salt',
    role: 'Super Admin',
    permissions: ['all'],
    plan: 'Premium',
    walletBalance: 100000,
    membershipStatus: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-demo-qwer-unified',
    name: 'Qwer Member',
    email: 'qwer@jobportal.com',
    username: 'qwer',
    passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', // sha256 of 123456
    salt: 'dev-salt',
    role: 'Unified Member',
    companyName: 'Qwer Solutions',
    phone: '+92 300 1234567',
    plan: 'Premium',
    walletBalance: 25000,
    membershipStatus: 'Active',
    activationDate: '2026-07-25 09:00',
    expiryDate: '2026-08-24 09:00',
    renewalCount: 2,
    autoRenew: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-demo-1',
    name: 'Ali Raza',
    email: 'ali.raza@example.com',
    username: 'aliraza',
    passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    salt: 'dev-salt',
    role: 'Job Seeker',
    phone: '+92 300 1122334',
    plan: 'Premium',
    walletBalance: 15000,
    membershipStatus: 'Active',
    activationDate: '2026-07-20 14:00',
    expiryDate: '2026-08-19 14:00',
    autoRenew: true,
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_APPLY_SETTINGS = {
  enableApplyButton: true,
  applyButtonText: 'Apply Now',
  applicationModalTitle: 'Submit Job Application',
  applicationInstructions: 'Complete the verified application details below. The hiring employer or department will review your credentials directly.',
  successMessage: 'Your application has been received successfully and forwarded to the hiring team!',
  loginRequiredMessage: 'Please sign in or register a free candidate account to track this application in your dashboard.',
  confirmationMessage: 'Are you sure you want to submit your verified application for this vacancy?',
  requireCv: true,
  requireCoverLetter: false,
  requirePhone: true,
  requireEmail: true,
  allowExternalApplication: true,
  externalApplicationWarning: 'Notice: You will be redirected to the official department/portal hiring page to submit your application directly.',
  expiredJobMessage: 'This employment opportunity has passed its application deadline and is no longer accepting new submissions.',
  customQuestions: [
    {
      id: 'q-notice',
      question: 'What is your current notice period or earliest available joining date?',
      type: 'select',
      options: ['Immediate', '15 Days', '30 Days', '60 Days', 'Negotiable'],
      required: true
    },
    {
      id: 'q-salary-exp',
      question: 'What is your expected monthly salary / remuneration (in PKR or USD)?',
      type: 'text',
      required: false
    }
  ]
};

const DEFAULT_COMPREHENSIVE_PRICING = {
  jobPosting: {
    standardFeePkr: 1000,
    urgentFeePkr: 500,
    featuredTopFeePkr: 1500,
    futureJobFeePkr: 800,
    vipBundleFeePkr: 2500,
    freePostingAllowed: true,
    enableStandard: true,
    enableUrgent: true,
    enableFeaturedTop: true,
    enableFutureJob: true,
    enableVipBundle: true,
    standardDurationDays: 30,
    urgentDurationDays: 15,
    featuredTopDurationDays: 30,
    futureJobDurationDays: 60,
    vipBundleDurationDays: 45
  },
  advertisements: {
    bannerPerDayPkr: 1500,
    topBannerPerDayPkr: 3000,
    popupPerDayPkr: 4500,
    feedAdPerDayPkr: 2000,
    featuredEmployerPerMonthPkr: 25000,
    allowDiscounts: true,
    defaultDiscountPercent: 10,
    minCampaignDurationDays: 3,
    maxCampaignDurationDays: 90
  },
  subscriptions: {
    freeTierPrice: 0,
    proMonthlyPkr: 1200,
    vipMonthlyPkr: 3000,
    govtAlertsWeeklyPkr: 400
  },
  cvBuilder: {
    standardPdfExportPkr: 0,
    premiumAiOptimizerPkr: 500,
    unlimitedTemplatesPkr: 1000
  }
};

export class Database {
  // --- JOBS ---
  static getJobs(): any[] {
    const list = safeReadJson<any[]>('jobs.json', INITIAL_JOBS);
    // Ensure all jobs have slugs
    return list.map((j) => {
      if (!j.slug) {
        j.slug = generateJobSlug(j.title, j.city, j.id);
      }
      return j;
    });
  }

  static saveJobs(jobs: any[]): void {
    safeWriteJson('jobs.json', jobs);
  }

  static getJobById(id: string): any | null {
    const jobs = this.getJobs();
    return jobs.find((j) => j.id === id) || null;
  }

  static getJobBySlug(slug: string): any | null {
    const jobs = this.getJobs();
    return jobs.find((j) => j.slug === slug || j.id === slug) || null;
  }

  static addJob(job: any): any {
    const jobs = this.getJobs();
    const newJob = {
      ...job,
      id: job.id || `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      slug: job.slug || generateJobSlug(job.title, job.city, job.id),
      postedAt: job.postedAt || 'Just now',
      status: job.status || 'Approved',
      applicationsCount: job.applicationsCount || 0,
      createdAt: new Date().toISOString()
    };
    jobs.unshift(newJob);
    this.saveJobs(jobs);
    return newJob;
  }

  static updateJob(id: string, updates: any): any | null {
    const jobs = this.getJobs();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) return null;
    jobs[idx] = { ...jobs[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveJobs(jobs);
    return jobs[idx];
  }

  static deleteJob(id: string): boolean {
    const jobs = this.getJobs();
    const filtered = jobs.filter((j) => j.id !== id);
    if (filtered.length === jobs.length) return false;
    this.saveJobs(filtered);
    return true;
  }

  // --- PENDING JOBS ---
  static getPendingJobs(): any[] {
    return safeReadJson<any[]>('pending_jobs.json', []);
  }

  static savePendingJobs(jobs: any[]): void {
    safeWriteJson('pending_jobs.json', jobs);
  }

  static addPendingJob(job: any): any {
    const pending = this.getPendingJobs();
    const newJob = {
      ...job,
      id: job.id || `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      slug: job.slug || generateJobSlug(job.title, job.city, job.id),
      status: 'Pending',
      postedAt: job.postedAt || 'Just now',
      createdAt: new Date().toISOString()
    };
    pending.unshift(newJob);
    this.savePendingJobs(pending);
    return newJob;
  }

  static approvePendingJob(id: string): any | null {
    const pending = this.getPendingJobs();
    const jobToApprove = pending.find((j) => j.id === id);
    if (!jobToApprove) return null;

    const remainingPending = pending.filter((j) => j.id !== id);
    this.savePendingJobs(remainingPending);

    jobToApprove.status = 'Approved';
    jobToApprove.verifiedDate = new Date().toISOString();
    return this.addJob(jobToApprove);
  }

  static rejectPendingJob(id: string, reason?: string): boolean {
    const pending = this.getPendingJobs();
    const idx = pending.findIndex((j) => j.id === id);
    if (idx === -1) return false;
    pending[idx].status = 'Rejected';
    pending[idx].rejectionReason = reason || 'Rejected by administrator';
    this.savePendingJobs(pending);
    return true;
  }

  // --- USERS ---
  static getUsers(): any[] {
    return safeReadJson<any[]>('users.json', DEFAULT_USERS);
  }

  static saveUsers(users: any[]): void {
    safeWriteJson('users.json', users);
  }

  static getUserById(id: string): any | null {
    const users = this.getUsers();
    return users.find((u) => u.id === id) || null;
  }

  static getUserByEmail(email: string): any | null {
    const users = this.getUsers();
    return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  static addUser(user: any): any {
    const users = this.getUsers();
    const newUser = {
      ...user,
      id: user.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    users.unshift(newUser);
    this.saveUsers(users);
    return newUser;
  }

  static updateUser(id: string, updates: any): any | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveUsers(users);
    return users[idx];
  }

  static deleteUser(id: string): boolean {
    const users = this.getUsers();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) return false;
    this.saveUsers(filtered);
    return true;
  }

  // --- APPLICATIONS ---
  static getApplications(): any[] {
    return safeReadJson<any[]>('applications.json', [
      {
        id: 'app-demo-1',
        jobId: 'job-1',
        jobTitle: 'Senior React & Node.js Engineer',
        companyName: 'Vercel Remote Tech',
        applicantId: 'user-demo-1',
        applicantName: 'Ali Raza',
        applicantEmail: 'ali.raza@example.com',
        applicantPhone: '+92 300 1122334',
        appliedAt: new Date().toISOString(),
        status: 'Applied',
        paymentStatus: 'Subscription Paid',
        coverLetter: 'I have 5 years experience with React, TypeScript and Node.js microservices.',
        answers: {
          'q-notice': '15 Days',
          'q-salary-exp': 'PKR 450,000 / month'
        }
      }
    ]);
  }

  static saveApplications(apps: any[]): void {
    safeWriteJson('applications.json', apps);
  }

  static addApplication(app: any): any {
    const apps = this.getApplications();
    const newApp = {
      ...app,
      id: app.id || `app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      appliedAt: new Date().toISOString(),
      status: app.status || 'Applied'
    };
    apps.unshift(newApp);
    this.saveApplications(apps);

    // Increment application count on the job
    const job = this.getJobById(app.jobId);
    if (job) {
      this.updateJob(job.id, { applicationsCount: (job.applicationsCount || 0) + 1 });
    }
    return newApp;
  }

  // --- TRANSACTIONS ---
  static getTransactions(): any[] {
    return safeReadJson<any[]>('transactions.json', INITIAL_PAYMENT_TRANSACTIONS);
  }

  static saveTransactions(txs: any[]): void {
    safeWriteJson('transactions.json', txs);
  }

  static addTransaction(tx: any): any {
    const txs = this.getTransactions();
    const newTx = {
      ...tx,
      id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      dateTime: tx.dateTime || new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    txs.unshift(newTx);
    this.saveTransactions(txs);
    return newTx;
  }

  // --- ADVERTISEMENTS ---
  static getAds(): any[] {
    return safeReadJson<any[]>('ads.json', INITIAL_ADVERTISEMENTS);
  }

  static saveAds(ads: any[]): void {
    safeWriteJson('ads.json', ads);
  }

  // --- PRICING ---
  static getPricing(): any {
    return safeReadJson<any>('pricing_config.json', DEFAULT_COMPREHENSIVE_PRICING);
  }

  static savePricing(pricing: any): void {
    safeWriteJson('pricing_config.json', pricing);
  }

  // --- APPLY SETTINGS ---
  static getApplySettings(): any {
    return safeReadJson<any>('apply_settings.json', DEFAULT_APPLY_SETTINGS);
  }

  static saveApplySettings(settings: any): void {
    safeWriteJson('apply_settings.json', settings);
  }

  // --- SCRAPER SOURCES & RUNS ---
  static getScraperSources(): any[] {
    return safeReadJson<any[]>('scraper_sources.json', ALL_VERIFIED_SCRAPER_PORTALS);
  }

  static saveScraperSources(sources: any[]): void {
    safeWriteJson('scraper_sources.json', sources);
  }

  static getScraperRuns(): any[] {
    return safeReadJson<any[]>('scraper_runs.json', []);
  }

  static addScraperRun(run: any): any {
    const runs = this.getScraperRuns();
    const newRun = {
      ...run,
      id: run.id || `run-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    runs.unshift(newRun);
    safeWriteJson('scraper_runs.json', runs);
    return newRun;
  }

  // --- AUDIT LOGS ---
  static getAuditLogs(): any[] {
    return safeReadJson<any[]>('audit_logs.json', [
      {
        id: 'audit-init-1',
        timestamp: new Date().toISOString(),
        user: 'System Admin',
        role: 'Super Admin',
        action: 'System Bootstrapped',
        target: 'Hybrid Job Portal Database Engine',
        status: 'Success'
      }
    ]);
  }

  static addAuditLog(entry: any): void {
    const logs = this.getAuditLogs();
    logs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry
    });
    // Keep max 500 logs in memory/disk
    if (logs.length > 500) logs.length = 500;
    safeWriteJson('audit_logs.json', logs);
  }

  // --- SEO CONFIG ---
  static getSeoConfig(): any {
    return safeReadJson<any>('seo_config.json', INITIAL_SITE_SEO_CONFIG);
  }

  static saveSeoConfig(config: any): void {
    safeWriteJson('seo_config.json', config);
  }
}
