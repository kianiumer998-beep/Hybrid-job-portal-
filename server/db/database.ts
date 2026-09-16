import fs from 'fs';
import path from 'path';
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

export function safeReadJson<T>(filename: string, fallback: T): T {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    safeWriteJson(filename, fallback);
    return fallback;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (!raw || !raw.trim()) {
        if (attempt < 3) {
          continue;
        }
        return fallback;
      }
      return JSON.parse(raw);
    } catch (err) {
      if (attempt < 3) {
        continue;
      }
      console.error(`[DB Error] Failed reading ${filename} after ${attempt + 1} attempts:`, err);
      return fallback;
    }
  }
  return fallback;
}

export function safeWriteJson<T>(filename: string, data: T): void {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, filename);
  const tempPath = `${filePath}.tmp.${Date.now()}_${process.pid}_${Math.random().toString(36).substring(2, 9)}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`[DB Error] Failed atomic rename for ${filename}, attempting direct write:`, err);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (directErr) {
      console.error(`[DB Error] Direct write fallback also failed for ${filename}:`, directErr);
    }
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
    // SHA256 of 'admin123'
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // sha256 of admin123
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
    const list = safeReadJson<any[]>('jobs.json', []);
    // Ensure all jobs have slugs and array fields
    return (list || []).filter(Boolean).map((j) => {
      if (!j.slug) {
        j.slug = generateJobSlug(j.title, j.city, j.id);
      }
      if (!Array.isArray(j.tags)) {
        j.tags = typeof j.tags === 'string' ? j.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      }
      if (!Array.isArray(j.requirements)) {
        j.requirements = typeof j.requirements === 'string' ? j.requirements.split('\n').map((s: string) => s.trim()).filter(Boolean) : [];
      }
      if (!Array.isArray(j.benefits)) {
        j.benefits = typeof j.benefits === 'string' ? j.benefits.split('\n').map((s: string) => s.trim()).filter(Boolean) : [];
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
    const existingIdx = job.id ? jobs.findIndex((j) => j.id === job.id) : -1;
    if (existingIdx !== -1) {
      jobs[existingIdx] = {
        ...jobs[existingIdx],
        ...job,
        status: job.status || 'Approved',
        updatedAt: new Date().toISOString()
      };
      this.saveJobs(jobs);
      return jobs[existingIdx];
    }

    const newJob = {
      ...job,
      id: job.id || `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      slug: job.slug || generateJobSlug(job.title, job.city, job.id),
      postedAt: job.postedAt || 'Just now',
      status: job.status || 'Approved',
      applicationsCount: job.applicationsCount || 0,
      createdAt: job.createdAt || new Date().toISOString()
    };
    jobs.unshift(newJob);
    this.saveJobs(jobs);
    return newJob;
  }

  static addJobsBatch(newJobs: any[], autoApprove: boolean = true): { inserted: number; updated: number; total: number } {
    if (!Array.isArray(newJobs) || newJobs.length === 0) {
      return { inserted: 0, updated: 0, total: this.getJobs().length };
    }

    const jobs = this.getJobs();
    const indexMap = new Map<string, number>();
    jobs.forEach((j, idx) => {
      if (j.id) indexMap.set(j.id, idx);
    });

    let inserted = 0;
    let updated = 0;
    const toPrepend: any[] = [];

    for (const item of newJobs) {
      if (!item || !item.title) continue;

      const targetId = item.id;
      if (targetId && indexMap.has(targetId)) {
        const existingIdx = indexMap.get(targetId)!;
        jobs[existingIdx] = {
          ...jobs[existingIdx],
          ...item,
          status: autoApprove ? 'Approved' : (item.status || 'Approved'),
          updatedAt: new Date().toISOString()
        };
        updated++;
      } else {
        const freshJob = {
          ...item,
          id: targetId || `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          slug: item.slug || generateJobSlug(item.title, item.city, targetId),
          postedAt: item.postedAt || 'Just now',
          status: autoApprove ? 'Approved' : (item.status || 'Approved'),
          applicationsCount: item.applicationsCount || 0,
          createdAt: item.createdAt || new Date().toISOString()
        };
        toPrepend.push(freshJob);
        indexMap.set(freshJob.id, -1);
        inserted++;
      }
    }

    const combined = [...toPrepend, ...jobs];
    this.saveJobs(combined);
    return { inserted, updated, total: combined.length };
  }

  static addPendingJobsBatch(newPending: any[]): { inserted: number; updated: number; total: number } {
    if (!Array.isArray(newPending) || newPending.length === 0) {
      return { inserted: 0, updated: 0, total: this.getPendingJobs().length };
    }

    const pending = this.getPendingJobs();
    const indexMap = new Map<string, number>();
    pending.forEach((p, idx) => {
      if (p.id) indexMap.set(p.id, idx);
    });

    let inserted = 0;
    let updated = 0;
    const toPrepend: any[] = [];

    for (const item of newPending) {
      if (!item || !item.title) continue;

      const targetId = item.id;
      if (targetId && indexMap.has(targetId)) {
        const existingIdx = indexMap.get(targetId)!;
        pending[existingIdx] = {
          ...pending[existingIdx],
          ...item,
          status: 'Pending',
          updatedAt: new Date().toISOString()
        };
        updated++;
      } else {
        const freshJob = {
          ...item,
          id: targetId || `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          slug: item.slug || generateJobSlug(item.title, item.city, targetId),
          status: 'Pending',
          postedAt: item.postedAt || 'Just now',
          createdAt: item.createdAt || new Date().toISOString()
        };
        toPrepend.push(freshJob);
        indexMap.set(freshJob.id, -1);
        inserted++;
      }
    }

    const combined = [...toPrepend, ...pending];
    this.savePendingJobs(combined);
    return { inserted, updated, total: combined.length };
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
    let deleted = filtered.length !== jobs.length;
    if (deleted) {
      this.saveJobs(filtered);
    }
    // Also remove from pending if exists
    const pending = this.getPendingJobs();
    const filteredPending = pending.filter((p) => p.id !== id);
    if (filteredPending.length !== pending.length) {
      this.savePendingJobs(filteredPending);
      deleted = true;
    }
    return deleted;
  }

  // --- PENDING JOBS ---
  static getPendingJobs(): any[] {
    const list = safeReadJson<any[]>('pending_jobs.json', []);
    return (list || []).filter(Boolean).map((j) => {
      if (!Array.isArray(j.tags)) {
        j.tags = typeof j.tags === 'string' ? j.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      }
      if (!Array.isArray(j.requirements)) {
        j.requirements = typeof j.requirements === 'string' ? j.requirements.split('\n').map((s: string) => s.trim()).filter(Boolean) : [];
      }
      if (!Array.isArray(j.benefits)) {
        j.benefits = typeof j.benefits === 'string' ? j.benefits.split('\n').map((s: string) => s.trim()).filter(Boolean) : [];
      }
      return j;
    });
  }

  static savePendingJobs(jobs: any[]): void {
    safeWriteJson('pending_jobs.json', jobs);
  }

  static addPendingJob(job: any): any {
    const pending = this.getPendingJobs();
    const existingIdx = job.id ? pending.findIndex((j) => j.id === job.id) : -1;
    if (existingIdx !== -1) {
      pending[existingIdx] = {
        ...pending[existingIdx],
        ...job,
        status: 'Pending',
        updatedAt: new Date().toISOString()
      };
      this.savePendingJobs(pending);
      return pending[existingIdx];
    }

    const newJob = {
      ...job,
      id: job.id || `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      slug: job.slug || generateJobSlug(job.title, job.city, job.id),
      status: 'Pending',
      postedAt: job.postedAt || 'Just now',
      createdAt: job.createdAt || new Date().toISOString()
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
    const raw = safeReadJson<any[]>('scraper_sources.json', ALL_VERIFIED_SCRAPER_PORTALS);
    return (raw || []).map(s => ({
      ...s,
      url: s.url || s.portalUrl || s.pdfUrl || '',
      portalUrl: s.portalUrl || s.url || ''
    }));
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

  // --- UNIVERSAL CASES & SUBMISSIONS ---
  static getCases(): any[] {
    return safeReadJson<any[]>('cases.json', [
      {
        id: 'case-demo-1',
        caseNumber: 'CASE-2026-0001',
        type: 'deposit',
        referenceId: 'tx-demo-1',
        title: 'Initial Wallet Deposit Proof',
        userId: 'user-demo-qwer-unified',
        userName: 'Qwer Member',
        userEmail: 'qwer@jobportal.com',
        status: 'approved',
        priority: 'medium',
        timeline: [
          {
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            actor: 'Qwer Member',
            role: 'Member',
            action: 'Case Submitted',
            note: 'JazzCash receipt proof submitted.'
          },
          {
            timestamp: new Date().toISOString(),
            actor: 'Super Administrator',
            role: 'Super Admin',
            action: 'Case Approved',
            note: 'Transaction verified and credited to user wallet.'
          }
        ],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'case-demo-2',
        caseNumber: 'CASE-2026-0002',
        type: 'job_submission',
        referenceId: 'job-1',
        title: 'Senior React & Node.js Engineer Vacancy Review',
        userId: 'user-demo-qwer-unified',
        userName: 'Qwer Member',
        userEmail: 'qwer@jobportal.com',
        status: 'approved',
        priority: 'high',
        timeline: [
          {
            timestamp: new Date().toISOString(),
            actor: 'System',
            role: 'System',
            action: 'Case Created',
            note: 'Direct employer vacancy review case opened.'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);
  }

  static saveCases(cases: any[]): void {
    safeWriteJson('cases.json', cases);
  }

  static getCaseById(id: string): any | null {
    const list = this.getCases();
    return list.find(c => c.id === id || c.caseNumber === id) || null;
  }

  static addCase(caseData: any): any {
    const cases = this.getCases();
    const caseNumber = caseData.caseNumber || `CASE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCase = {
      ...caseData,
      id: caseData.id || `case-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      caseNumber,
      status: caseData.status || 'pending',
      priority: caseData.priority || 'medium',
      timeline: caseData.timeline || [
        {
          timestamp: new Date().toISOString(),
          actor: caseData.userName || 'User',
          role: 'Member',
          action: 'Case Created',
          note: caseData.title || 'Case submitted for review.'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    cases.unshift(newCase);
    this.saveCases(cases);
    return newCase;
  }

  static updateCase(id: string, updates: any): any | null {
    const cases = this.getCases();
    const idx = cases.findIndex(c => c.id === id || c.caseNumber === id);
    if (idx === -1) return null;
    
    const existing = cases[idx];
    const newTimeline = Array.isArray(updates.timeline)
      ? updates.timeline
      : (updates.newTimelineEvent
          ? [updates.newTimelineEvent, ...(existing.timeline || [])]
          : existing.timeline);

    cases[idx] = {
      ...existing,
      ...updates,
      timeline: newTimeline,
      updatedAt: new Date().toISOString()
    };
    delete cases[idx].newTimelineEvent;
    this.saveCases(cases);
    return cases[idx];
  }

  // --- SUPPORT TICKETS ---
  static getSupportTickets(): any[] {
    return safeReadJson<any[]>('support_tickets.json', [
      {
        id: 'ticket-demo-1',
        ticketNumber: 'TICK-1001',
        userId: 'user-demo-1',
        userName: 'Ali Raza',
        userEmail: 'ali.raza@example.com',
        subject: 'Inquiry regarding payment verification status',
        category: 'Billing',
        status: 'open',
        priority: 'medium',
        messages: [
          {
            id: 'msg-1',
            senderId: 'user-demo-1',
            senderName: 'Ali Raza',
            senderRole: 'Job Seeker',
            message: 'Hello, I submitted my Easypaisa deposit receipt for Pro subscription. When will it be activated?',
            timestamp: new Date(Date.now() - 3600000).toISOString()
          }
        ],
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString()
      }
    ]);
  }

  static saveSupportTickets(tickets: any[]): void {
    safeWriteJson('support_tickets.json', tickets);
  }

  static addSupportTicket(ticket: any): any {
    const list = this.getSupportTickets();
    const ticketNumber = ticket.ticketNumber || `TICK-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket = {
      ...ticket,
      id: ticket.id || `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ticketNumber,
      status: ticket.status || 'open',
      priority: ticket.priority || 'medium',
      messages: ticket.messages || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.unshift(newTicket);
    this.saveSupportTickets(list);
    return newTicket;
  }

  static updateSupportTicket(id: string, updates: any): any | null {
    const list = this.getSupportTickets();
    const idx = list.findIndex(t => t.id === id || t.ticketNumber === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveSupportTickets(list);
    return list[idx];
  }

  // --- SAVED JOBS ---
  static getSavedJobs(userId?: string): any[] {
    const all = safeReadJson<any[]>('saved_jobs.json', []);
    return userId ? all.filter(s => s.userId === userId) : all;
  }

  static saveSavedJobs(list: any[]): void {
    safeWriteJson('saved_jobs.json', list);
  }

  static toggleSavedJob(userId: string, job: any): { saved: boolean; count: number } {
    let list = safeReadJson<any[]>('saved_jobs.json', []);
    const existingIdx = list.findIndex(s => s.userId === userId && s.jobId === job.id);
    let saved = false;
    if (existingIdx !== -1) {
      list.splice(existingIdx, 1);
      saved = false;
    } else {
      list.unshift({
        id: `saved-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId,
        jobId: job.id,
        job,
        savedAt: new Date().toISOString()
      });
      saved = true;
    }
    this.saveSavedJobs(list);
    return { saved, count: list.filter(s => s.userId === userId).length };
  }

  // --- JOB ALERTS ---
  static getJobAlerts(userId?: string): any[] {
    const all = safeReadJson<any[]>('job_alerts.json', []);
    return userId ? all.filter(a => a.userId === userId) : all;
  }

  static saveJobAlerts(alerts: any[]): void {
    safeWriteJson('job_alerts.json', alerts);
  }

  static addJobAlert(alert: any): any {
    const list = safeReadJson<any[]>('job_alerts.json', []);
    const newAlert = {
      ...alert,
      id: alert.id || `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      active: alert.active !== false
    };
    list.unshift(newAlert);
    this.saveJobAlerts(list);
    return newAlert;
  }

  static deleteJobAlert(id: string, userId?: string): boolean {
    const list = safeReadJson<any[]>('job_alerts.json', []);
    const filtered = list.filter(a => a.id !== id && (!userId || a.userId === userId));
    const deleted = filtered.length !== list.length;
    if (deleted) this.saveJobAlerts(filtered);
    return deleted;
  }

  // --- USER DOCUMENTS ---
  static getUserDocuments(userId: string): any[] {
    const all = safeReadJson<any[]>('user_documents.json', []);
    return all.filter(d => d.userId === userId);
  }

  static saveUserDocuments(docs: any[]): void {
    safeWriteJson('user_documents.json', docs);
  }

  static addUserDocument(doc: any): any {
    const list = safeReadJson<any[]>('user_documents.json', []);
    const newDoc = {
      ...doc,
      id: doc.id || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      uploadedAt: new Date().toISOString()
    };
    list.unshift(newDoc);
    this.saveUserDocuments(list);
    return newDoc;
  }

  static deleteUserDocument(id: string, userId: string): boolean {
    const list = safeReadJson<any[]>('user_documents.json', []);
    const filtered = list.filter(d => !(d.id === id && d.userId === userId));
    const deleted = filtered.length !== list.length;
    if (deleted) this.saveUserDocuments(filtered);
    return deleted;
  }
}
