import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  FolderArchive,
  ShieldAlert,
  Lock,
  X
} from 'lucide-react';
import {
  Job,
  JobAttachment,
  JobPostingFeeLog,
  JobPostingPricingConfig,
  PaymentTransaction,
  ScrapedJobAuditEntry,
  ScraperBatchRun,
  Subscriber,
  UserAccount,
  CustomFormField,
  AdminFeatureFlags
} from '../../types/job';
import { AdPricingConfig } from '../../types/ad';
import { LandingPageConfig } from '../../types/landing';
import type { WhatsAppSupportConfig } from '../WhatsAppStickyButton';
import {
  BACKUP_SNAPSHOT_SCHEMA_VERSION,
  SiteSeoConfig,
  SnapshotAdminConfig,
  SnapshotManifest,
  SystemSnapshotPayload
} from '../../types/adminSuite';
import { isNonJobRecord, isNeedsReviewRecord } from '../../utils/jobValidation';

export interface BulkJobImportRecordError {
  index: number;
  title?: string;
  message: string;
  type?: 'duplicate' | 'error';
  confidence?: number;
  duplicateCategory?: string;
  matchedJobId?: string;
  matchedJobTitle?: string;
}

export interface BulkJobImportResult {
  success?: boolean;
  message?: string;
  processed: number;
  requestedCount: number;
  importedCount: number;
  failedCount: number;
  skippedDuplicateCount?: number;
  errors: BulkJobImportRecordError[];
  partialSuccess: boolean;
}

export interface AdminDataBackupHubProps {
  jobs?: Job[];
  pendingJobs?: Job[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  feeLogs?: JobPostingFeeLog[];
  paymentTransactions?: PaymentTransaction[];
  ads?: any[];
  auditLogs?: ScrapedJobAuditEntry[];
  batchRuns?: ScraperBatchRun[];
  customFormFields?: CustomFormField[];
  featureFlags?: AdminFeatureFlags;
  jobPostingPricing?: JobPostingPricingConfig;
  adPricingConfig?: AdPricingConfig;
  landingConfig?: LandingPageConfig;
  seoConfig?: SiteSeoConfig;
  whatsAppSupportConfig?: WhatsAppSupportConfig;
  onRestoreSnapshot?: (snapshot: SystemSnapshotPayload) => void;
  onImportBulkJobs?: (importedJobs: Job[]) => Promise<BulkJobImportResult | void> | BulkJobImportResult | void;
}

export interface BackupImportProcessResult {
  status: 'success' | 'rejected' | 'error';
  kind: 'job-array' | 'full-snapshot' | 'invalid';
  message: string;
  requestedCount?: number;
  processed?: number;
  importedCount: number;
  failedCount?: number;
  skippedDuplicateCount?: number;
  jobs?: Job[];
  errors?: BulkJobImportRecordError[];
}

const MAX_BULK_IMPORT_RECORDS = 500;
const OPTIONAL_IMPORT_STRING_ARRAY_FIELDS = [
  'tags',
  'requirements',
  'benefits',
  'responsibilities',
  'responsibilitiesList',
  'advertisedPositions',
  'relatedSourceUrls',
  'duplicateTags'
] as const;

const REQUIRED_ATTACHMENT_STRING_FIELDS: Array<keyof Pick<JobAttachment, 'id' | 'name' | 'fileUrl' | 'fileType' | 'uploadedAt'>> = [
  'id',
  'name',
  'fileUrl',
  'fileType',
  'uploadedAt'
];

function validateFrontendImportAttachment(
  att: unknown,
  recordIndex: number,
  attIndex: number,
  recordTitle?: string
): BulkJobImportRecordError | null {
  if (
    att === null ||
    typeof att !== 'object' ||
    Array.isArray(att) ||
    Object.prototype.toString.call(att) !== '[object Object]'
  ) {
    return {
      index: recordIndex,
      title: recordTitle,
      type: 'error',
      message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] must be a plain object.`
    };
  }

  const obj = att as Record<string, unknown>;
  for (const field of REQUIRED_ATTACHMENT_STRING_FIELDS) {
    const val = obj[field];
    if (typeof val !== 'string' || !val.trim()) {
      return {
        index: recordIndex,
        title: recordTitle,
        type: 'error',
        message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] requires non-empty string "${field}".`
      };
    }
  }

  for (const optStr of ['fileName', 'description'] as const) {
    const val = obj[optStr];
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return {
        index: recordIndex,
        title: recordTitle,
        type: 'error',
        message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] optional "${optStr}" must be a string when supplied.`
      };
    }
  }

  if (obj.isPublic !== undefined && obj.isPublic !== null && typeof obj.isPublic !== 'boolean') {
    return {
      index: recordIndex,
      title: recordTitle,
      type: 'error',
      message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] optional "isPublic" must be a boolean when supplied.`
    };
  }

  if (
    obj.sizeBytes !== undefined &&
    obj.sizeBytes !== null &&
    (typeof obj.sizeBytes !== 'number' || !Number.isFinite(obj.sizeBytes) || obj.sizeBytes < 0)
  ) {
    return {
      index: recordIndex,
      title: recordTitle,
      type: 'error',
      message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] optional "sizeBytes" must be a finite non-negative number when supplied.`
    };
  }

  return null;
}

export const BACKUP_EXPORT_SCOPE =
  'Selected Admin Data Snapshot — Export Only — Not a Complete Database Backup';

export const SENSITIVE_USER_AUTH_FIELD_KEYS = new Set<string>([
  'password',
  'passwordhash',
  'salt',
  'accesstoken',
  'refreshtoken',
  'resettoken',
  'verificationtoken',
  'sessiontoken',
  'passwordresettoken',
  'emailverificationtoken',
  'authtoken',
  'twofactorsecret',
  'mfasecret',
  'hashedpassword',
  'passworddigest',
  'apikey',
  'privatekey',
  'otpsecret',
  'mfarecoverycodes',
  'bearertoken',
  'idtoken',
  'clientsecret',
  'authorization'
]);

const SANITIZED_USER_FIELD_LABELS = [
  'password',
  'passwordHash',
  'salt',
  'accessToken',
  'refreshToken',
  'resetToken',
  'verificationToken',
  'sessionToken',
  'passwordResetToken',
  'emailVerificationToken',
  'authToken',
  'twoFactorSecret',
  'mfaSecret',
  'password_hash',
  'hashedPassword',
  'passwordDigest',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'otpSecret',
  'mfaRecoveryCodes',
  'bearerToken',
  'idToken',
  'clientSecret',
  'authorization'
];

export const EXCLUDED_BACKUP_CATEGORIES = [
  {
    key: 'paymentMethodSettings',
    label: 'Payment method settings',
    reason: 'Admin payment receiver configurations are managed separately on the server and excluded from this frontend export.'
  },
  {
    key: 'communicationProviderSecrets',
    label: 'Communication provider secrets',
    reason: 'SMTP passwords, SendGrid/Resend API keys, WhatsApp API tokens, Twilio auth tokens, and encrypted provider secret envelopes are never exported.'
  },
  {
    key: 'durableSecurityAuditRecords',
    label: 'Durable security audit records',
    reason: 'Immutable backend security and admin audit trail records (AuditRepository) are not supplied to this component; scraperAuditLogs contain scraper-specific history only.'
  },
  {
    key: 'applications',
    label: 'Applications',
    reason: 'Server-side job application collection records are not included in this frontend snapshot.'
  },
  {
    key: 'notifications',
    label: 'Notifications',
    reason: 'Server-side user and administrative notification records are excluded.'
  },
  {
    key: 'savedJobsAndAlerts',
    label: 'Saved jobs and alerts',
    reason: 'User-specific saved job bookmarks and personal alert rules stored server-side are excluded.'
  },
  {
    key: 'userDocuments',
    label: 'User documents',
    reason: 'Uploaded CVs, resumes, payment proof files, and document storage are not included.'
  },
  {
    key: 'kycRecords',
    label: 'KYC records',
    reason: 'Employer KYC verification requests and identity documents are excluded.'
  },
  {
    key: 'otherServerDatabaseCollections',
    label: 'Other server-side database collections not supplied to this component',
    reason: 'Additional MongoDB collections, session stores, chat archives, location catalogs, currency settings, and unpaginated/unloaded records remain solely in the backend database.'
  }
];

function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_USER_AUTH_FIELD_KEYS.has(normalized);
}

function cloneSanitizedValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value as object)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    seen.add(value);
    const clonedArr = value.map((item) => cloneSanitizedValue(item, seen));
    seen.delete(value);
    return clonedArr;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }
  seen.add(value);
  const out: Record<string, unknown> = {};
  for (const [key, entryVal] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      continue;
    }
    out[key] = cloneSanitizedValue(entryVal, seen);
  }
  seen.delete(value);
  return out;
}

/**
 * Backup-only sanitizer for UserAccount records.
 * Strips authentication credentials and tokens without mutating the source user object
 * while preserving profile, membership, wallet, transaction, and application fields.
 */
export function sanitizeUserForBackup(
  user: UserAccount
): Omit<UserAccount, 'password'> & Record<string, any> {
  if (!user || typeof user !== 'object') {
    return user as any;
  }
  return cloneSanitizedValue(user, new WeakSet<object>()) as Omit<UserAccount, 'password'> & Record<string, any>;
}

const CSV_FORMULA_TRIGGER_RE = /^[\s\u0000-\u001F\u007F]*[=+\-@]/;

/**
 * Safely escapes a CSV cell value:
 * - Preserves numeric 0 and negative numeric values without altering numbers
 * - Uses nullish checks instead of truthy coercion
 * - Neutralizes formula injection in untrusted string fields beginning with =, +, -, @
 *   (including when preceded by whitespace or control characters)
 * - Escapes embedded double quotes and quotes every cell safely
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      return '""';
    }
    return `"${Object.is(val, -0) ? '0' : String(val)}"`;
  }
  if (typeof val === 'boolean') {
    return `"${val ? 'true' : 'false'}"`;
  }
  const raw = String(val);
  const safeText = CSV_FORMULA_TRIGGER_RE.test(raw) ? `'${raw}` : raw;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function escapeCsvHeader(header: string): string {
  const raw = String(header ?? '');
  if (CSV_FORMULA_TRIGGER_RE.test(raw) || /[,"\r\n]/.test(raw)) {
    return escapeCsvCell(raw);
  }
  return raw;
}

export function buildCsvContent(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map((h) => escapeCsvHeader(h)).join(',');
  const rowLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
  return [headerLine, ...rowLines].join('\n');
}

export interface SnapshotBuildInput {
  jobs?: Job[];
  pendingJobs?: Job[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  feeLogs?: JobPostingFeeLog[];
  paymentTransactions?: PaymentTransaction[];
  ads?: any[];
  auditLogs?: ScrapedJobAuditEntry[];
  batchRuns?: ScraperBatchRun[];
  customFormFields?: CustomFormField[];
  featureFlags?: AdminFeatureFlags;
  jobPostingPricing?: JobPostingPricingConfig;
  adPricingConfig?: AdPricingConfig;
  landingConfig?: LandingPageConfig;
  seoConfig?: SiteSeoConfig;
  whatsAppSupportConfig?: WhatsAppSupportConfig;
  createdAt?: string;
}

export function buildAdminSnapshotPayload(input: SnapshotBuildInput): SystemSnapshotPayload {
  const createdAt = input.createdAt || new Date().toISOString();
  const safeJobs = Array.isArray(input.jobs) ? input.jobs : [];
  const safePendingJobs = Array.isArray(input.pendingJobs) ? input.pendingJobs : [];
  const safeUsers = Array.isArray(input.users) ? input.users.map((u) => sanitizeUserForBackup(u)) : [];
  const safeSubscribers = Array.isArray(input.subscribers) ? input.subscribers : [];
  const safeFeeLogs = Array.isArray(input.feeLogs) ? input.feeLogs : [];
  const safePaymentTransactions = Array.isArray(input.paymentTransactions) ? input.paymentTransactions : [];
  const safeAds = Array.isArray(input.ads) ? input.ads : [];
  const safeScraperAuditLogs = Array.isArray(input.auditLogs) ? input.auditLogs : [];
  const safeScraperBatchRuns = Array.isArray(input.batchRuns) ? input.batchRuns : [];
  const safeCustomFormFields = Array.isArray(input.customFormFields) ? input.customFormFields : [];
  const safeFeatureFlags = (input.featureFlags && typeof input.featureFlags === 'object'
    ? input.featureFlags
    : {}) as AdminFeatureFlags;

  const adminConfig: SnapshotAdminConfig = {};
  if (input.jobPostingPricing && typeof input.jobPostingPricing === 'object') {
    adminConfig.jobPostingPricing = input.jobPostingPricing;
  }
  if (input.adPricingConfig && typeof input.adPricingConfig === 'object') {
    adminConfig.adPricingConfig = input.adPricingConfig;
  }
  if (input.landingConfig && typeof input.landingConfig === 'object') {
    adminConfig.landingConfig = input.landingConfig;
  }
  if (input.seoConfig && typeof input.seoConfig === 'object') {
    adminConfig.seoConfig = input.seoConfig;
  }
  if (input.whatsAppSupportConfig && typeof input.whatsAppSupportConfig === 'object') {
    adminConfig.whatsAppSupportConfig = input.whatsAppSupportConfig;
  }
  const adminConfigSectionsCount = Object.keys(adminConfig).length;

  const recordCounts: Record<string, number> = {
    jobs: safeJobs.length,
    pendingJobs: safePendingJobs.length,
    users: safeUsers.length,
    subscribers: safeSubscribers.length,
    feeLogs: safeFeeLogs.length,
    paymentTransactions: safePaymentTransactions.length,
    ads: safeAds.length,
    scraperAuditLogs: safeScraperAuditLogs.length,
    scraperBatchRuns: safeScraperBatchRuns.length,
    customFormFields: safeCustomFormFields.length,
    featureFlags: Object.keys(safeFeatureFlags).length,
    adminConfigSections: adminConfigSectionsCount
  };

  const manifest: SnapshotManifest = {
    schemaVersion: BACKUP_SNAPSHOT_SCHEMA_VERSION,
    createdAt,
    exportScope: BACKUP_EXPORT_SCOPE,
    isCompleteDatabaseBackup: false,
    sanitizationApplied: {
      usersCredentialsStripped: true,
      strippedUserFields: [...SANITIZED_USER_FIELD_LABELS],
      secretsExcluded: true
    },
    includedCategories: [
      {
        key: 'jobs',
        label: 'Live / Approved Jobs',
        description: 'Job listings currently loaded into admin live state.',
        recordCount: safeJobs.length
      },
      {
        key: 'pendingJobs',
        label: 'Pending Review Jobs',
        description: 'Pending job listings currently loaded into admin review state.',
        recordCount: safePendingJobs.length
      },
      {
        key: 'users',
        label: 'Sanitized User Profiles',
        description: 'User profile, membership, wallet, transaction, and application data with passwords and auth/session tokens stripped.',
        recordCount: safeUsers.length
      },
      {
        key: 'subscribers',
        label: 'Alert Subscribers',
        description: 'Job alert subscriber records currently loaded in admin state.',
        recordCount: safeSubscribers.length
      },
      {
        key: 'feeLogs',
        label: 'Per-Job Fee Logs',
        description: 'Per-job posting fee log entries (distinct from paymentTransactions).',
        recordCount: safeFeeLogs.length
      },
      {
        key: 'paymentTransactions',
        label: 'Payment Transactions',
        description: 'Subscription, job posting, ad campaign, wallet, and proof verification transaction records (distinct from feeLogs).',
        recordCount: safePaymentTransactions.length
      },
      {
        key: 'ads',
        label: 'Advertisements & Campaigns',
        description: 'Advertisement campaign records supplied to AdminDashboard.',
        recordCount: safeAds.length
      },
      {
        key: 'scraperAuditLogs',
        label: 'Scraper Audit History (Scraper-Specific)',
        description: 'Scraper ingestion review history only — NOT the durable security audit log.',
        recordCount: safeScraperAuditLogs.length
      },
      {
        key: 'scraperBatchRuns',
        label: 'Scraper Batch Run History (Scraper-Specific)',
        description: 'Scraper crawl/batch execution history only — NOT the durable security audit log.',
        recordCount: safeScraperBatchRuns.length
      },
      {
        key: 'customFormFields',
        label: 'Custom Registration Form Fields',
        description: 'Registration custom field definitions.',
        recordCount: safeCustomFormFields.length
      },
      {
        key: 'featureFlags',
        label: 'Admin Feature Flags',
        description: 'Portal feature switch configuration.',
        recordCount: Object.keys(safeFeatureFlags).length
      },
      {
        key: 'adminConfig',
        label: 'Supplied Non-Secret Admin Configurations',
        description: 'Supplied job posting pricing, ad pricing, landing page, SEO, and WhatsApp support configurations (no provider secrets).',
        recordCount: adminConfigSectionsCount
      }
    ],
    excludedCategories: EXCLUDED_BACKUP_CATEGORIES.map((item) => ({ ...item })),
    recordCounts
  };

  return {
    snapshotVersion: BACKUP_SNAPSHOT_SCHEMA_VERSION,
    createdAt,
    platformName: 'CareerPak & Global Work Portal',
    manifest,
    totalJobs: safeJobs.length,
    totalPendingJobs: safePendingJobs.length,
    totalUsers: safeUsers.length,
    totalPaymentTransactions: safePaymentTransactions.length,
    totalFeeLogs: safeFeeLogs.length,
    jobs: safeJobs,
    pendingJobs: safePendingJobs,
    users: safeUsers,
    subscribers: safeSubscribers,
    feeLogs: safeFeeLogs,
    paymentTransactions: safePaymentTransactions,
    ads: safeAds,
    scraperAuditLogs: safeScraperAuditLogs,
    scraperBatchRuns: safeScraperBatchRuns,
    customFormFields: safeCustomFormFields,
    featureFlags: safeFeatureFlags,
    adminConfig
  };
}

export function triggerBlobDownload(
  content: string,
  mimeType: string,
  filename: string,
  options?: { revokeDelayMs?: number }
): string {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', objectUrl);
  link.setAttribute('download', filename);
  if (link.style) {
    link.style.display = 'none';
  }
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    const delayMs = typeof options?.revokeDelayMs === 'number' ? Math.max(0, options.revokeDelayMs) : 1000;
    const timer = setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    }, delayMs);
    if (timer && typeof (timer as any).unref === 'function') {
      (timer as any).unref();
    }
  }
  return objectUrl;
}

export function isSystemSnapshotPayload(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return Boolean(
    obj.snapshotVersion ||
    obj.manifest ||
    (Array.isArray(obj.jobs) &&
      (Array.isArray(obj.users) ||
        Array.isArray(obj.subscribers) ||
        Array.isArray(obj.feeLogs) ||
        Array.isArray(obj.paymentTransactions) ||
        Array.isArray(obj.pendingJobs)))
  );
}

export function processBackupImportJson(
  rawText: string,
  onImportBulkJobs?: (importedJobs: Job[]) => any
): BackupImportProcessResult {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      status: 'error',
      kind: 'invalid',
      message: 'Please paste a valid JSON array of job objects to import.',
      requestedCount: 0,
      processed: 0,
      importedCount: 0,
      failedCount: 0,
      skippedDuplicateCount: 0
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e: any) {
    return {
      status: 'error',
      kind: 'invalid',
      message: `Invalid JSON formatting: ${e?.message || 'Syntax error'}`,
      requestedCount: 0,
      processed: 0,
      importedCount: 0,
      failedCount: 0,
      skippedDuplicateCount: 0
    };
  }

  if (isSystemSnapshotPayload(parsed)) {
    return {
      status: 'rejected',
      kind: 'full-snapshot',
      message:
        'Full snapshot restore is temporarily unavailable and disabled because not all snapshot categories (users, subscribers, payments, audit logs) have a verified restore implementation. To import jobs, provide a JSON array of job objects (`[...]`).',
      requestedCount: 0,
      processed: 0,
      importedCount: 0,
      failedCount: 0,
      skippedDuplicateCount: 0
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      status: 'error',
      kind: 'invalid',
      message: 'Unrecognized format. Please provide a JSON array of job objects (`[ { ... } ]`).',
      requestedCount: 0,
      processed: 0,
      importedCount: 0,
      failedCount: 0,
      skippedDuplicateCount: 0
    };
  }

  if (parsed.length === 0) {
    return {
      status: 'error',
      kind: 'invalid',
      message: 'The JSON array is empty. Please provide at least 1 valid job object to import.',
      requestedCount: 0,
      processed: 0,
      importedCount: 0,
      failedCount: 0,
      skippedDuplicateCount: 0
    };
  }

  if (parsed.length > MAX_BULK_IMPORT_RECORDS) {
    return {
      status: 'error',
      kind: 'invalid',
      message: `Batch limit exceeded: you provided ${parsed.length} records, but the maximum allowed per import is ${MAX_BULK_IMPORT_RECORDS}. No records were written.`,
      requestedCount: parsed.length,
      processed: parsed.length,
      importedCount: 0,
      failedCount: parsed.length,
      skippedDuplicateCount: 0
    };
  }

  const recordErrors: BulkJobImportRecordError[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (
      item === null ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.prototype.toString.call(item) !== '[object Object]'
    ) {
      const kindLabel = item === null ? 'null' : Array.isArray(item) ? 'nested array' : typeof item;
      recordErrors.push({
        index: i,
        message: `Record #${i + 1} (index ${i}): Expected a job object, received ${kindLabel}.`
      });
      continue;
    }

    const record = item as Record<string, unknown>;
    const rawTitleLabel = typeof record.title === 'string' && record.title.trim() ? record.title.trim() : undefined;

    if (isNonJobRecord(record as Partial<Job>)) {
      recordErrors.push({
        index: i,
        title: rawTitleLabel,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Non-job records (isNonJob/NON_JOB) cannot be imported.`
      });
      continue;
    }

    if (isNeedsReviewRecord(record as Partial<Job>)) {
      recordErrors.push({
        index: i,
        title: rawTitleLabel,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Records marked NEEDS_REVIEW cannot be directly imported as Approved.`
      });
      continue;
    }

    const titleStr = typeof record.title === 'string' ? record.title.trim() : '';
    if (!titleStr) {
      recordErrors.push({
        index: i,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Missing or invalid non-empty string "title".`
      });
      continue;
    }

    const companyStr = typeof record.company === 'string' ? record.company.trim() : '';
    if (!companyStr) {
      recordErrors.push({
        index: i,
        title: titleStr,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Missing or invalid non-empty string "company".`
      });
      continue;
    }

    const locationFields = ['city', 'province', 'region', 'country', 'location'] as const;
    let badLocationField = false;
    for (const locField of locationFields) {
      if (record[locField] !== undefined && record[locField] !== null && typeof record[locField] !== 'string') {
        recordErrors.push({
          index: i,
          title: titleStr,
          type: 'error',
          message: `Record #${i + 1} (index ${i}): Optional location field "${locField}" must be a string.`
        });
        badLocationField = true;
        break;
      }
    }
    if (badLocationField) continue;

    if (record.description !== undefined && record.description !== null && typeof record.description !== 'string') {
      recordErrors.push({
        index: i,
        title: titleStr,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Optional "description" must be a string.`
      });
      continue;
    }

    let badArrayField = false;
    for (const field of OPTIONAL_IMPORT_STRING_ARRAY_FIELDS) {
      const val = record[field];
      if (val !== undefined && val !== null) {
        if (!Array.isArray(val) || !val.every((entry) => typeof entry === 'string')) {
          recordErrors.push({
            index: i,
            title: titleStr,
            type: 'error',
            message: `Record #${i + 1} (index ${i}): Optional "${field}" must be an array of strings.`
          });
          badArrayField = true;
          break;
        }
      }
    }
    if (badArrayField) continue;

    if (record.attachments !== undefined && record.attachments !== null) {
      if (!Array.isArray(record.attachments)) {
        recordErrors.push({
          index: i,
          title: titleStr,
          type: 'error',
          message: `Record #${i + 1} (index ${i}): Optional "attachments" must be an array.`
        });
        continue;
      }
      let attachmentErr: BulkJobImportRecordError | null = null;
      for (let aIdx = 0; aIdx < record.attachments.length; aIdx++) {
        attachmentErr = validateFrontendImportAttachment(record.attachments[aIdx], i, aIdx, titleStr);
        if (attachmentErr) break;
      }
      if (attachmentErr) {
        recordErrors.push(attachmentErr);
        continue;
      }
    }
  }

  if (recordErrors.length > 0) {
    const preview = recordErrors
      .slice(0, 3)
      .map((err) => err.message)
      .join(' ');
    const extraCount = recordErrors.length > 3 ? ` (+${recordErrors.length - 3} more error(s))` : '';
    return {
      status: 'error',
      kind: 'invalid',
      message: `Batch validation failed on ${recordErrors.length} of ${parsed.length} record(s); entire batch rejected so 0 of ${parsed.length} job(s) were written. ${preview}${extraCount}`,
      requestedCount: parsed.length,
      processed: parsed.length,
      importedCount: 0,
      failedCount: parsed.length,
      skippedDuplicateCount: 0,
      errors: recordErrors
    };
  }

  if (typeof onImportBulkJobs === 'function') {
    onImportBulkJobs(parsed as Job[]);
  }

  return {
    status: 'success',
    kind: 'job-array',
    message: `Validated ${parsed.length} job object(s) ready for import.`,
    requestedCount: parsed.length,
    processed: parsed.length,
    importedCount: parsed.length,
    failedCount: 0,
    skippedDuplicateCount: 0,
    jobs: parsed as Job[]
  };
}

interface PendingSensitiveExportAction {
  title: string;
  filename: string;
  summary: string;
  execute: () => void;
}

export const AdminDataBackupHub: React.FC<AdminDataBackupHubProps> = ({
  jobs = [],
  pendingJobs = [],
  users = [],
  subscribers = [],
  feeLogs = [],
  paymentTransactions = [],
  ads = [],
  auditLogs = [],
  batchRuns = [],
  customFormFields = [],
  featureFlags = {} as any,
  jobPostingPricing,
  adPricingConfig,
  landingConfig,
  seoConfig,
  whatsAppSupportConfig,
  onRestoreSnapshot: _onRestoreSnapshot,
  onImportBulkJobs
}) => {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safePendingJobs = Array.isArray(pendingJobs) ? pendingJobs : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];
  const safeFeeLogs = Array.isArray(feeLogs) ? feeLogs : [];
  const safePaymentTransactions = Array.isArray(paymentTransactions) ? paymentTransactions : [];
  const safeAds = Array.isArray(ads) ? ads : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const safeBatchRuns = Array.isArray(batchRuns) ? batchRuns : [];
  const safeCustomFormFields = Array.isArray(customFormFields) ? customFormFields : [];

  const [activeSubTab, setActiveSubTab] = useState<'snapshot' | 'csv-export' | 'bulk-import'>('snapshot');
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importWarningMessage, setImportWarningMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [importResultDetails, setImportResultDetails] = useState<BulkJobImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingExportConfirmation, setPendingExportConfirmation] = useState<PendingSensitiveExportAction | null>(null);
  const [exportNoticeMessage, setExportNoticeMessage] = useState<string | null>(null);
  const importInFlightRef = useRef(false);

  const suppliedConfigNames = [
    jobPostingPricing ? 'Job Posting Pricing' : null,
    adPricingConfig ? 'Ad Pricing' : null,
    landingConfig ? 'Landing Page' : null,
    seoConfig ? 'SEO Settings' : null,
    whatsAppSupportConfig ? 'WhatsApp Support' : null
  ].filter(Boolean) as string[];

  const executeSelectedSnapshotDownload = () => {
    const snapshot = buildAdminSnapshotPayload({
      jobs: safeJobs,
      pendingJobs: safePendingJobs,
      users: safeUsers,
      subscribers: safeSubscribers,
      feeLogs: safeFeeLogs,
      paymentTransactions: safePaymentTransactions,
      ads: safeAds,
      auditLogs: safeAuditLogs,
      batchRuns: safeBatchRuns,
      customFormFields: safeCustomFormFields,
      featureFlags,
      jobPostingPricing,
      adPricingConfig,
      landingConfig,
      seoConfig,
      whatsAppSupportConfig
    });

    const dateStamp = new Date().toISOString().substring(0, 10);
    const filename = `careerpak_selected_admin_data_snapshot_${dateStamp}.json`;
    triggerBlobDownload(JSON.stringify(snapshot, null, 2), 'application/json;charset=utf-8;', filename);
    setExportNoticeMessage(
      `Downloaded selected admin data snapshot (${filename}) with ${snapshot.totalPaymentTransactions} payment transactions, ${snapshot.totalFeeLogs} fee logs, and ${snapshot.totalUsers} sanitized user records.`
    );
  };

  // Selected Admin Data Snapshot JSON Download (requires explicit sensitive data warning confirmation)
  const handleDownloadFullSnapshot = () => {
    const dateStamp = new Date().toISOString().substring(0, 10);
    const filename = `careerpak_selected_admin_data_snapshot_${dateStamp}.json`;
    setPendingExportConfirmation({
      title: 'Confirm Sensitive Admin Data Snapshot Export',
      filename,
      summary: `Exports ${safeJobs.length} live jobs, ${safePendingJobs.length} pending jobs, ${safeUsers.length} sanitized users (credentials stripped), ${safePaymentTransactions.length} payment transactions, ${safeFeeLogs.length} separate fee logs, ${safeSubscribers.length} subscribers, scraper history, and supplied non-secret configs.`,
      execute: executeSelectedSnapshotDownload
    });
  };

  // CSV Exporter Helper using Blob + Object URL
  const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => {
    const csvContent = buildCsvContent(headers, rows);
    triggerBlobDownload(csvContent, 'text/csv;charset=utf-8;', filename);
  };

  // Export Jobs to CSV
  const handleExportJobsCsv = () => {
    const headers = ['ID', 'Title', 'Company', 'JobType', 'Region', 'Salary', 'Category', 'GovtScale', 'Status', 'PostedAt', 'SourceUrl'];
    const rows = safeJobs.concat(safePendingJobs).map(j => [
      j.id,
      j.title,
      j.company,
      j.jobType,
      j.region,
      j.salary,
      j.jobCategory ?? 'Private Corporate',
      j.govtScale ?? 'N/A',
      j.status ?? 'Approved',
      j.postedAt,
      j.sourceUrl ?? ''
    ]);
    const filename = `careerpak_jobs_export_${new Date().toISOString().substring(0, 10)}.csv`;
    downloadCsv(filename, headers, rows);
    setExportNoticeMessage(`Downloaded jobs CSV export (${filename}) with ${rows.length} job record(s).`);
  };

  // Export Users to CSV (requires sensitive data confirmation)
  const handleExportUsersCsv = () => {
    const filename = `careerpak_users_export_${new Date().toISOString().substring(0, 10)}.csv`;
    setPendingExportConfirmation({
      title: 'Confirm User Personal Data CSV Export',
      filename,
      summary: `Exports ${safeUsers.length} user record(s) including names, email addresses, membership plans, expiry dates, and wallet balances.`,
      execute: () => {
        const headers = ['ID', 'Name', 'Email', 'Role', 'Company', 'Plan', 'ExpiryDate', 'AutoRenew', 'WalletBalance'];
        const rows = safeUsers.map(u => [
          u.id,
          u.name,
          u.email,
          u.role,
          u.companyName || 'N/A',
          u.plan,
          u.expiryDate || 'N/A',
          u.autoRenew ? 'Yes' : 'No',
          u.walletBalance ?? 0
        ]);
        downloadCsv(filename, headers, rows);
        setExportNoticeMessage(`Downloaded users CSV export (${filename}) with ${rows.length} user record(s).`);
      }
    });
  };

  // Export Financial Ledger (Fee Logs) to CSV (requires sensitive data confirmation)
  const handleExportRevenueCsv = () => {
    const filename = `careerpak_financial_revenue_ledger_${new Date().toISOString().substring(0, 10)}.csv`;
    setPendingExportConfirmation({
      title: 'Confirm Financial Fee Ledger CSV Export',
      filename,
      summary: `Exports ${safeFeeLogs.length} per-job fee ledger entry/entries with customer names, emails, amounts, payment methods, and statuses.`,
      execute: () => {
        const headers = ['TransactionID', 'DateTime', 'UserName', 'UserEmail', 'JobTitle', 'Amount', 'Currency', 'PaymentMethod', 'Status'];
        const rows = safeFeeLogs.map(f => [
          f.id,
          f.dateTime,
          f.userName,
          f.userEmail,
          f.jobTitle,
          f.amount,
          f.currency,
          f.paymentMethod,
          f.status
        ]);
        downloadCsv(filename, headers, rows);
        setExportNoticeMessage(`Downloaded financial fee ledger CSV (${filename}) with ${rows.length} record(s).`);
      }
    });
  };

  // Bulk JSON Importer Handler (job-array only; awaits backend persistence; full snapshot restore safely disabled)
  const handleParseAndImport = async () => {
    if (isImporting || importInFlightRef.current) return;

    setImportStatusMessage(null);
    setImportWarningMessage(null);
    setImportErrorMessage(null);
    setImportResultDetails(null);

    const validation = processBackupImportJson(importJsonText);
    if (validation.status !== 'success' || !validation.jobs) {
      setImportErrorMessage(validation.message);
      const reqCount = typeof validation.requestedCount === 'number' ? validation.requestedCount : 0;
      const procCount = typeof validation.processed === 'number' ? validation.processed : reqCount;
      const failCount = typeof validation.failedCount === 'number' ? validation.failedCount : reqCount;
      if (reqCount > 0 || (validation.errors && validation.errors.length > 0)) {
        setImportResultDetails({
          success: false,
          message: validation.message,
          processed: procCount,
          requestedCount: reqCount,
          importedCount: 0,
          failedCount: failCount,
          skippedDuplicateCount: 0,
          errors: validation.errors || [],
          partialSuccess: false
        });
      }
      return;
    }

    if (typeof onImportBulkJobs !== 'function') {
      setImportErrorMessage('Bulk job import handler is not configured.');
      return;
    }

    importInFlightRef.current = true;
    setIsImporting(true);
    try {
      const result = await onImportBulkJobs(validation.jobs);
      if (!result || typeof result.importedCount !== 'number' || typeof result.failedCount !== 'number') {
        setImportErrorMessage('Backend did not confirm job persistence. Please verify and try again.');
        return;
      }

      const skippedDuplicates = typeof result.skippedDuplicateCount === 'number' ? result.skippedDuplicateCount : 0;
      const normalizedResult: BulkJobImportResult = {
        ...result,
        skippedDuplicateCount: skippedDuplicates
      };
      setImportResultDetails(normalizedResult);

      if (normalizedResult.importedCount > 0 && normalizedResult.failedCount === 0 && skippedDuplicates === 0) {
        setImportStatusMessage(
          normalizedResult.message ||
            `✅ Confirmed: ${normalizedResult.importedCount} of ${normalizedResult.requestedCount} job(s) imported and saved.`
        );
        setImportJsonText('');
      } else if (normalizedResult.importedCount > 0 && (normalizedResult.failedCount > 0 || skippedDuplicates > 0)) {
        const notes: string[] = [];
        if (skippedDuplicates > 0) notes.push(`${skippedDuplicates} duplicate(s) skipped`);
        if (normalizedResult.failedCount > 0) notes.push(`${normalizedResult.failedCount} failed`);
        setImportWarningMessage(
          normalizedResult.message ||
            `Partial import: ${normalizedResult.importedCount} of ${normalizedResult.requestedCount} job(s) saved (${notes.join(', ')}).`
        );
      } else {
        const notes: string[] = [];
        if (skippedDuplicates > 0) notes.push(`${skippedDuplicates} skipped as duplicate`);
        if (normalizedResult.failedCount > 0) notes.push(`${normalizedResult.failedCount} failed`);
        setImportErrorMessage(
          normalizedResult.message ||
            `No jobs imported: 0 of ${normalizedResult.requestedCount} job(s) saved (${notes.join(', ') || '0 imported'}).`
        );
      }
    } catch (err: any) {
      setImportErrorMessage(err?.message || 'Bulk job import failed due to a server or network error.');
    } finally {
      importInFlightRef.current = false;
      setIsImporting(false);
    }
  };

  return (
    <div className="admin-settings-mobile-compact space-y-6 text-white">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Database className="w-4 h-4" />
            <span>Selected Admin Data Export &amp; Bulk Job Importer</span>
          </div>
          <h2 className="text-xl font-black text-white">Selected Admin Data Snapshot, CSV Exports &amp; Importer</h2>
          <p className="text-xs text-slate-400 mt-1">
            Export loaded admin data snapshots with a manifest, download hardened CSV reports, or ingest bulk job arrays.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
          {[
            { id: 'snapshot', label: 'Admin JSON Snapshot', icon: FolderArchive },
            { id: 'csv-export', label: 'CSV Spreadsheets', icon: FileSpreadsheet },
            { id: 'bulk-import', label: 'Bulk Job Importer', icon: Upload }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id as any)}
                className={`px-3.5 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeSubTab === t.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {exportNoticeMessage && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportNoticeMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNoticeMessage(null)}
            className="text-emerald-300 hover:text-white cursor-pointer"
            aria-label="Dismiss export notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sensitive Export Confirmation Dialog */}
      {pendingExportConfirmation && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sensitive-export-modal-title">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="sensitive-export-modal-title" className="text-base font-black text-white">
                    {pendingExportConfirmation.title}
                  </h3>
                  <p className="text-[11px] font-mono text-amber-300 mt-0.5">{pendingExportConfirmation.filename}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingExportConfirmation(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Cancel export"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 leading-relaxed space-y-1.5">
              <p className="font-bold">
                Security Notice: This file contains private personal or payment information and must be stored securely.
              </p>
              <p className="text-slate-300">{pendingExportConfirmation.summary}</p>
              <p className="text-[11px] text-slate-400">
                User passwords, password hashes, salts, and session/auth tokens are stripped automatically; communication provider secrets remain excluded.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setPendingExportConfirmation(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingExportConfirmation;
                  setPendingExportConfirmation(null);
                  action.execute();
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Confirm &amp; Download File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: SELECTED ADMIN JSON SNAPSHOT */}
      {activeSubTab === 'snapshot' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Download className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                  Export Only
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Selected Admin Data Snapshot</h3>
              <p className="text-xs font-bold text-amber-300">
                {BACKUP_EXPORT_SCOPE}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Exports a structured JSON snapshot with manifest of currently loaded admin state: {safeJobs.length} live jobs, {safePendingJobs.length} pending jobs, {safeUsers.length} sanitized users, {safePaymentTransactions.length} payment transactions, {safeFeeLogs.length} separate fee logs, {safeSubscribers.length} subscribers, {safeAds.length} ads, {safeAuditLogs.length} scraper audit entries &amp; {safeBatchRuns.length} scraper batch runs (scraper-specific, not the durable security audit log), {safeCustomFormFields.length} custom form fields, feature flags, and {suppliedConfigNames.length} supplied non-secret admin configs.
              </p>
              
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1 text-slate-300">
                <div>📦 File: careerpak_selected_admin_data_snapshot_YYYY-MM-DD.json</div>
                <div>🧬 Schema: {BACKUP_SNAPSHOT_SCHEMA_VERSION} (Blob Export + Manifest)</div>
                <div>💳 Payment Transactions: {safePaymentTransactions.length} | Fee Logs: {safeFeeLogs.length}</div>
                <div>🔒 User Auth Sanitization: Passwords, hashes, salts &amp; tokens stripped</div>
                <div>⚙️ Admin Configs: {suppliedConfigNames.length > 0 ? suppliedConfigNames.join(', ') : 'None supplied'}</div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-amber-500/25 text-[11px] text-slate-300 leading-relaxed space-y-1">
                <div className="font-bold text-amber-300 flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Excluded Server-Side Categories (Not Backed Up Here):</span>
                </div>
                <p className="text-slate-400">
                  Payment method settings, communication provider secrets, durable security audit records, applications, notifications, saved jobs &amp; alerts, user documents, KYC records, and other server-side database collections not supplied to this component.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadFullSnapshot}
              className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download System JSON Backup</span>
            </button>
          </div>

          {/* Snapshot Restore Box (Temporarily Unavailable) */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  Temporarily Unavailable
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Restore from Backup Snapshot (Disabled)</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Complete portal snapshot restore is temporarily unavailable and disabled because not all snapshot categories (users, subscribers, payment records, audit logs, and feature flags) have a verified restore implementation.
              </p>

              <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                Use <strong>Bulk Job Importer</strong> if you need to import an array of job listings (`[...]`). Selected admin snapshots remain export-only to prevent partial or misleading restores.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Upload .json Snapshot File (Disabled)</label>
                <input
                  type="file"
                  accept=".json"
                  disabled
                  aria-disabled="true"
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-500 opacity-50 cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="button"
              disabled
              aria-disabled="true"
              className="w-full py-3.5 bg-slate-800 text-slate-500 font-black text-xs rounded-xl border border-slate-700 flex items-center justify-center space-x-2 opacity-60 cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              <span>Full Snapshot Restore Temporarily Unavailable</span>
            </button>
          </div>

        </div>
      )}

      {/* SUB-TAB 2: CSV SPREADSHEETS */}
      {activeSubTab === 'csv-export' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start space-x-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              CSV files are exported via secure Blob downloads with formula-injection protection and zero-value preservation. User and Financial Ledger exports contain private personal or payment information and must be stored securely.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
            {/* Export 1: Jobs CSV */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-white">Export Live &amp; Pending Jobs</h4>
                <p className="text-xs text-slate-400">
                  Exports all {safeJobs.length + safePendingJobs.length} job records with salaries, BPS scales, and application URLs.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportJobsCsv}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Jobs (.CSV)</span>
              </button>
            </div>

            {/* Export 2: Users CSV */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-white">Export Registered Users</h4>
                <p className="text-xs text-slate-400">
                  Exports all {safeUsers.length} registered candidates and employers with plan tiers and expiry dates.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportUsersCsv}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl border border-indigo-500/30 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Users (.CSV)</span>
              </button>
            </div>

            {/* Export 3: Revenue CSV */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-white">Export Revenue Ledger</h4>
                <p className="text-xs text-slate-400">
                  Exports all {safeFeeLogs.length} per-job fee ledger entries ({safePaymentTransactions.length} payment transactions are included separately in the JSON snapshot).
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportRevenueCsv}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Ledger (.CSV)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 3: BULK JOB IMPORTER */}
      {activeSubTab === 'bulk-import' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Bulk Vacancy Array Ingestion</span>
              </h3>
              <p className="text-xs text-slate-400">Paste an array of job objects in JSON format to instantly import hundreds of jobs.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                const sample = [
                  {
                    id: `job-bulk-${Date.now()}-1`,
                    title: 'Senior Python & Django Backend Architect',
                    company: 'TechVentures PK',
                    jobType: 'Remote',
                    region: 'Pakistan',
                    city: 'Lahore',
                    salary: 'PKR 350,000 - 450,000 / mo',
                    currency: 'PKR',
                    experienceLevel: 'Senior',
                    department: 'Software Engineering',
                    tags: ['Python', 'Django', 'PostgreSQL', 'Docker'],
                    description: 'We are seeking an experienced Python Architect to lead our backend engineering squad.',
                    requirements: ['5+ years Python', 'Strong SQL knowledge'],
                    benefits: ['Health Insurance', 'Remote Work Allowance'],
                    postedAt: 'Just now',
                    applicationsCount: 0,
                    status: 'Approved'
                  }
                ];
                setImportJsonText(JSON.stringify(sample, null, 2));
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
            >
              Load Sample Template
            </button>
          </div>

          {importErrorMessage && (
            <div className="p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-bold text-xs">
              {importErrorMessage}
            </div>
          )}

          {importWarningMessage && (
            <div className="p-3.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-200 font-bold text-xs">
              {importWarningMessage}
            </div>
          )}

          {importStatusMessage && (
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs">
              {importStatusMessage}
            </div>
          )}

          {importResultDetails && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-4 font-bold">
                <span className="text-slate-300">Requested: {importResultDetails.requestedCount}</span>
                <span className="text-emerald-400">Imported: {importResultDetails.importedCount}</span>
                <span className={(importResultDetails.skippedDuplicateCount || 0) > 0 ? 'text-amber-400' : 'text-slate-400'}>
                  Duplicates Skipped: {importResultDetails.skippedDuplicateCount || 0}
                </span>
                <span className={importResultDetails.failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}>
                  Failed: {importResultDetails.failedCount}
                </span>
              </div>
              {Array.isArray(importResultDetails.errors) && importResultDetails.errors.length > 0 && (
                <ul className="space-y-1 text-[11px] max-h-40 overflow-y-auto list-disc pl-4">
                  {importResultDetails.errors.map((errItem, idx) => {
                    const isDup = errItem.type === 'duplicate';
                    return (
                      <li
                        key={`${errItem.index}-${idx}`}
                        className={isDup ? 'text-amber-300' : 'text-rose-300'}
                      >
                        <span className="font-bold">
                          [{isDup ? 'Duplicate' : 'Error'}] Record #{errItem.index + 1} (index {errItem.index}):
                        </span>{' '}
                        {errItem.title ? `[${errItem.title}] ` : ''}
                        {errItem.message}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div>
            <textarea
              rows={10}
              value={importJsonText}
              disabled={isImporting}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON array here e.g. [ { title: '...', company: '...', city: 'Lahore' } ]"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono text-xs leading-relaxed disabled:opacity-60"
            />
          </div>

          <button
            type="button"
            onClick={handleParseAndImport}
            disabled={isImporting}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Importing &amp; Persisting Jobs...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Validate Schema &amp; Ingest Jobs</span>
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
};
