import React, { useState } from 'react';
import {
  DollarSign,
  Users,
  Briefcase,
  Globe,
  Bot,
  Clock,
  CheckCircle2,
  Sparkles,
  Building2,
  AlertTriangle
} from 'lucide-react';
import {
  Currency,
  Job,
  JobPostingFeeLog,
  PaymentTransaction,
  ScrapedJobAuditEntry,
  ScraperBatchRun,
  Subscriber,
  UserAccount
} from '../../types/job';
import { Advertisement } from '../../types/ad';
import { CurrencyExchangeConfig } from '../../types/adminSuite';

export type AnalyticsTimeRange = 'today' | '7days' | '30days' | 'all';

interface AdminAnalyticsOverviewProps {
  jobs?: Job[];
  pendingJobs?: Job[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  feeLogs?: JobPostingFeeLog[];
  paymentTransactions?: PaymentTransaction[];
  auditLogs?: ScrapedJobAuditEntry[];
  batchRuns?: ScraperBatchRun[];
  currencyConfig?: CurrencyExchangeConfig;
  onNavigateTab?: (tabId: any) => void;
  ads?: Advertisement[];
}

export const ANALYTICS_SHORTCUT_TAB_IDS = [
  'fee-logs',
  'pending',
  'user-audit',
  'scraped-history',
  'currency-forex',
  'advertisements',
  'add-job',
  'broadcast-center',
  'ai-enhancer',
  'data-backup'
] as const;

export interface ComputedAnalyticsMetrics {
  timeRange: AnalyticsTimeRange;
  totalFeeLogsPkr: number | null;
  paidFeeLogsCount: number;
  totalSubscribersPkr: number | null;
  paidSubscribersCount: number;
  totalAdsPkr: number | null;
  paidAdsCount: number;
  activeAdsCount: number;
  totalTransactionsRevenuePkr: number | null;
  countedTransactionsCount: number;
  totalGrossRevenuePkr: number | null;
  scraperSuccessRate: number | null;
  filteredJobsCount: number;
  filteredPendingJobsCount: number;
  filteredGovtJobsCount: number;
  filteredUsersCount: number;
  filteredAuditLogsCount: number;
  filteredBatchRunsCount: number;
  employersCount: number;
  seekersCount: number;
  missingDateRecordsCount: number;
  missingEligibleFinancialDateCount?: number;
  ambiguousFinancialDeduplicationCount?: number;
  regionBreakdown: Array<{ regionName: string; count: number; pct: number }>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Karachi (PKT, UTC+5 fixed)
const AMBIGUOUS_DEDUPE_TIME_WINDOW_MS = 5 * 60 * 1000;

function isDateOnlyString(raw: unknown): boolean {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

function getPktCalendarDateKey(timestampMs: number): string {
  const pktShifted = new Date(timestampMs + PKT_OFFSET_MS);
  const year = pktShifted.getUTCFullYear();
  const month = String(pktShifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pktShifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUtcCalendarDateKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPktDayBoundsMs(referenceMs: number): { pktDayStartMs: number; pktDayEndMs: number; pktDateKey: string } {
  const pktShifted = new Date(referenceMs + PKT_OFFSET_MS);
  const year = pktShifted.getUTCFullYear();
  const month = pktShifted.getUTCMonth();
  const day = pktShifted.getUTCDate();
  const pktDayStartMs = Date.UTC(year, month, day, 0, 0, 0, 0) - PKT_OFFSET_MS;
  const pktDayEndMs = Date.UTC(year, month, day, 23, 59, 59, 999) - PKT_OFFSET_MS;
  const pktDateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { pktDayStartMs, pktDayEndMs, pktDateKey };
}

export function parseAnalyticsTimestamp(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Support stored PKT suffix timestamps such as "2026-08-26 11:45 PKT" or "2026-10-15 14:30:00 PKT"
  const pktMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*PKT$/i.exec(trimmed);
  if (pktMatch) {
    const sec = pktMatch[3] || '00';
    const frac = pktMatch[4] ? `.${pktMatch[4]}` : '';
    const ms = Date.parse(`${pktMatch[1]}T${pktMatch[2]}:${sec}${frac}+05:00`);
    return Number.isFinite(ms) ? ms : null;
  }

  // Normalize "YYYY-MM-DD HH:MM" or "YYYY-MM-DD HH:MM:SS" without timezone deterministically as UTC
  const spaceDateTimeMatch = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(trimmed);
  if (spaceDateTimeMatch) {
    const sec = spaceDateTimeMatch[3] || '00';
    const frac = spaceDateTimeMatch[4] ? `.${spaceDateTimeMatch[4]}` : '';
    const ms = Date.parse(`${spaceDateTimeMatch[1]}T${spaceDateTimeMatch[2]}:${sec}${frac}Z`);
    return Number.isFinite(ms) ? ms : null;
  }

  // Normalize ISO strings without explicit timezone suffix deterministically as UTC
  const isoNoTzMatch = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/.exec(trimmed);
  if (isoNoTzMatch) {
    const ms = Date.parse(`${isoNoTzMatch[1]}Z`);
    return Number.isFinite(ms) ? ms : null;
  }

  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

function getRecordTimestampMs(record: any, fields: string[]): number | null {
  if (!record || typeof record !== 'object') return null;
  for (const field of fields) {
    const parsed = parseAnalyticsTimestamp(record[field]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function getRecordTimestampValues(record: any, fields: string[]): Array<{ ms: number; dateOnly: boolean; raw: string }> {
  if (!record || typeof record !== 'object') return [];
  const results: Array<{ ms: number; dateOnly: boolean; raw: string }> = [];
  for (const field of fields) {
    const rawVal = record[field];
    const ms = parseAnalyticsTimestamp(rawVal);
    if (ms !== null) {
      results.push({
        ms,
        dateOnly: isDateOnlyString(rawVal),
        raw: typeof rawVal === 'string' ? rawVal.trim() : ''
      });
    }
  }
  return results;
}

function areTimestampsPotentiallySamePayment(
  recordTimestamps: Array<{ ms: number; dateOnly: boolean; raw: string }>,
  txTimestamps: Array<{ ms: number; dateOnly: boolean; raw: string }>
): boolean {
  if (recordTimestamps.length === 0 || txTimestamps.length === 0) {
    return true;
  }
  for (const rTs of recordTimestamps) {
    for (const tTs of txTimestamps) {
      if (rTs.dateOnly || tTs.dateOnly) {
        if (rTs.dateOnly && !tTs.dateOnly) {
          if (rTs.raw === getPktCalendarDateKey(tTs.ms) || rTs.raw === getUtcCalendarDateKey(tTs.ms)) {
            return true;
          }
        } else if (tTs.dateOnly && !rTs.dateOnly) {
          if (tTs.raw === getPktCalendarDateKey(rTs.ms) || tTs.raw === getUtcCalendarDateKey(rTs.ms)) {
            return true;
          }
        } else if (rTs.raw === tTs.raw) {
          return true;
        }
      } else if (Math.abs(rTs.ms - tTs.ms) <= AMBIGUOUS_DEDUPE_TIME_WINDOW_MS) {
        return true;
      }
    }
  }
  return false;
}

export function isTimestampInRange(
  timestampMs: number | null,
  timeRange: AnalyticsTimeRange,
  referenceDate?: Date | string | number
): boolean {
  if (timeRange === 'all') {
    return true;
  }
  if (timestampMs === null || !Number.isFinite(timestampMs)) {
    return false;
  }

  const parsedRef =
    referenceDate !== undefined ? parseAnalyticsTimestamp(referenceDate) : Date.now();
  const refMs = parsedRef !== null ? parsedRef : Date.now();
  if (timeRange === 'today') {
    const { pktDayStartMs, pktDayEndMs } = getPktDayBoundsMs(refMs);
    return timestampMs >= pktDayStartMs && timestampMs <= pktDayEndMs;
  }

  const days = timeRange === '7days' ? 7 : 30;
  const windowStart = refMs - days * MS_PER_DAY;
  return timestampMs >= windowStart && timestampMs <= refMs;
}

export function convertRecordAmountToPkr(
  amount: unknown,
  currency: unknown,
  currencyConfig?: CurrencyExchangeConfig
): number | null {
  if (typeof amount !== 'number' && typeof amount !== 'string') return null;
  if (typeof amount === 'string' && amount.trim() === '') return null;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) return null;

  if (typeof currency !== 'string' || !currency.trim()) {
    return null;
  }
  const normalizedCurr = currency.trim().toUpperCase();

  if (normalizedCurr === 'PKR') {
    return numericAmount;
  }

  const rate = currencyConfig?.rates?.[normalizedCurr as Currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  // currencyConfig.rates stores how many target currency units equal 1 PKR (configured per portal settings)
  return numericAmount / rate;
}

export function convertPkrAmount(
  amountPkr: number | null | undefined,
  targetCurrency: Currency,
  currencyConfig?: CurrencyExchangeConfig
): number | null {
  if (amountPkr === null || amountPkr === undefined || !Number.isFinite(amountPkr)) {
    return null;
  }
  if (targetCurrency === 'PKR') {
    return Math.round(amountPkr);
  }
  const rate = currencyConfig?.rates?.[targetCurrency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return Math.round(amountPkr * rate);
}

export function formatAnalyticsCurrency(
  amountPkr: number | null | undefined,
  targetCurrency: Currency,
  currencyConfig?: CurrencyExchangeConfig
): string {
  const converted = convertPkrAmount(amountPkr, targetCurrency, currencyConfig);
  if (converted === null) {
    return 'N/A';
  }
  return `${targetCurrency} ${converted.toLocaleString()}`;
}

function filterRecordsByTimeRange<T>(
  records: T[],
  dateFields: string[],
  timeRange: AnalyticsTimeRange,
  referenceDate?: Date | string | number
): { items: T[]; datedCount: number; missingDateCount: number } {
  const safeList = Array.isArray(records) ? records.filter((r) => Boolean(r && typeof r === 'object')) : [];
  let datedCount = 0;
  let missingDateCount = 0;
  const items: T[] = [];

  for (const record of safeList) {
    const ts = getRecordTimestampMs(record, dateFields);
    if (ts !== null) {
      datedCount++;
    } else {
      missingDateCount++;
    }
    if (isTimestampInRange(ts, timeRange, referenceDate)) {
      items.push(record);
    }
  }

  return { items, datedCount, missingDateCount };
}

function isRevenueTransaction(tx: any): boolean {
  if (!tx || typeof tx !== 'object') return false;
  if (tx.status !== 'Success') return false;
  if (
    tx.refunded === true ||
    tx.compensated === true ||
    tx.compensationStatus === 'Compensated' ||
    tx.compensatedAt ||
    tx.refundReferenceId
  ) {
    return false;
  }
  const txType = String(tx.type || '').trim();
  if (!txType || txType === 'Wallet Deposit' || txType === 'Refund') {
    return false;
  }
  return (
    txType === 'Subscription' ||
    txType === 'Job Posting Fee' ||
    txType === 'Job Posting' ||
    txType === 'Ad Campaign Fee' ||
    txType === 'Advertisement'
  );
}

function isEligiblePaidSubscriber(sub: any): boolean {
  if (!sub || typeof sub !== 'object') return false;
  const status = String(sub.status || '').trim();
  if (status !== 'Active' && status !== 'Expiring Soon') return false;

  const paymentMethod = String(sub.paymentMethod || '').trim().toLowerCase();
  if (paymentMethod === 'free trial') return false;

  const amount = Number(sub.amountPaid);
  if (!Number.isFinite(amount) || amount <= 0) return false;

  return true;
}

function getAdvertisementVerifiedCostPkr(
  ad: any,
  txAmountByRef: Map<string, number>
): { eligiblePaid: boolean; costPkr: number | null; unverifiedMissingStatus: boolean } {
  if (!ad || typeof ad !== 'object') {
    return { eligiblePaid: false, costPkr: null, unverifiedMissingStatus: false };
  }

  const paymentStatus = typeof ad.paymentStatus === 'string' ? ad.paymentStatus.trim() : '';

  if (
    paymentStatus === 'Pending Wallet Deduction' ||
    paymentStatus === 'Refunded' ||
    paymentStatus === 'Exempt'
  ) {
    return { eligiblePaid: false, costPkr: 0, unverifiedMissingStatus: false };
  }

  if (paymentStatus !== 'Paid') {
    return { eligiblePaid: false, costPkr: null, unverifiedMissingStatus: true };
  }

  if (typeof ad.campaignCostPkr === 'number' && Number.isFinite(ad.campaignCostPkr) && ad.campaignCostPkr >= 0) {
    return { eligiblePaid: true, costPkr: ad.campaignCostPkr, unverifiedMissingStatus: false };
  }

  if (typeof ad.budget === 'number' && Number.isFinite(ad.budget) && ad.budget >= 0) {
    return { eligiblePaid: true, costPkr: ad.budget, unverifiedMissingStatus: false };
  }

  const refCandidates = [ad.walletTxId, ad.paymentTransactionId, ad.transactionRef, ad.id]
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => String(v).trim());
  for (const ref of refCandidates) {
    if (txAmountByRef.has(ref)) {
      return { eligiblePaid: true, costPkr: txAmountByRef.get(ref)!, unverifiedMissingStatus: false };
    }
  }

  return { eligiblePaid: true, costPkr: null, unverifiedMissingStatus: false };
}

export function computeAnalyticsMetrics(params: {
  jobs?: Job[];
  pendingJobs?: Job[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  feeLogs?: JobPostingFeeLog[];
  paymentTransactions?: PaymentTransaction[];
  auditLogs?: ScrapedJobAuditEntry[];
  batchRuns?: ScraperBatchRun[];
  ads?: Advertisement[];
  timeRange?: AnalyticsTimeRange;
  referenceDate?: Date | string | number;
  currencyConfig?: CurrencyExchangeConfig;
}): ComputedAnalyticsMetrics {
  const timeRange: AnalyticsTimeRange = params.timeRange || 'all';
  const { referenceDate, currencyConfig } = params;

  const rawJobs = Array.isArray(params.jobs) ? params.jobs : [];
  const rawPendingJobs = Array.isArray(params.pendingJobs) ? params.pendingJobs : [];
  const rawUsers = Array.isArray(params.users) ? params.users : [];
  const rawSubscribers = Array.isArray(params.subscribers) ? params.subscribers : [];
  const rawFeeLogs = Array.isArray(params.feeLogs) ? params.feeLogs : [];
  const rawPaymentTransactions = Array.isArray(params.paymentTransactions) ? params.paymentTransactions : [];
  const rawAuditLogs = Array.isArray(params.auditLogs) ? params.auditLogs : [];
  const rawBatchRuns = Array.isArray(params.batchRuns) ? params.batchRuns : [];
  const rawAds = Array.isArray(params.ads) ? params.ads : [];

  // Combine authoritative central paymentTransactions + user-embedded transactions without duplicates
  const allCombinedTransactions: PaymentTransaction[] = [];
  const seenTxIds = new Set<string>();
  const seenTxTids = new Set<string>();

  for (const tx of rawPaymentTransactions) {
    if (!tx || typeof tx !== 'object') continue;
    const txId = tx.id ? String(tx.id).trim() : '';
    const txTid = tx.transactionId ? String(tx.transactionId).trim() : '';
    if ((txId && seenTxIds.has(txId)) || (txTid && seenTxTids.has(txTid))) {
      continue;
    }
    if (txId) seenTxIds.add(txId);
    if (txTid) seenTxTids.add(txTid);
    allCombinedTransactions.push(tx);
  }
  for (const user of rawUsers) {
    if (!user || !Array.isArray(user.transactions)) continue;
    for (const tx of user.transactions) {
      if (!tx || typeof tx !== 'object') continue;
      const txId = tx.id ? String(tx.id).trim() : '';
      const txTid = tx.transactionId ? String(tx.transactionId).trim() : '';
      if (!txId && !txTid) continue;
      if ((txId && seenTxIds.has(txId)) || (txTid && seenTxTids.has(txTid))) {
        continue;
      }
      if (txId) seenTxIds.add(txId);
      if (txTid) seenTxTids.add(txTid);
      allCombinedTransactions.push({
        ...tx,
        userId: tx.userId || user.id,
        userEmail: tx.userEmail || user.email
      });
    }
  }

  const filteredJobs = filterRecordsByTimeRange(rawJobs, ['createdAt', 'postedAt', 'scrapedAt'], timeRange, referenceDate);
  const filteredPending = filterRecordsByTimeRange(
    rawPendingJobs,
    ['createdAt', 'postedAt', 'scrapedAt'],
    timeRange,
    referenceDate
  );
  const filteredUsers = filterRecordsByTimeRange(rawUsers, ['createdAt', 'lastLogin'], timeRange, referenceDate);
  const filteredSubscribers = filterRecordsByTimeRange(
    rawSubscribers,
    ['subscribedAt', 'createdAt'],
    timeRange,
    referenceDate
  );
  const filteredFeeLogs = filterRecordsByTimeRange(
    rawFeeLogs,
    ['dateTime', 'createdAt'],
    timeRange,
    referenceDate
  );
  const filteredTransactions = filterRecordsByTimeRange(
    allCombinedTransactions,
    ['verifiedAt', 'createdAt', 'dateTime'],
    timeRange,
    referenceDate
  );
  const filteredAuditLogs = filterRecordsByTimeRange(rawAuditLogs, ['scrapedAt'], timeRange, referenceDate);
  const filteredBatchRuns = filterRecordsByTimeRange(
    rawBatchRuns,
    ['startTime', 'endTime'],
    timeRange,
    referenceDate
  );
  const filteredAds = filterRecordsByTimeRange(
    rawAds,
    ['createdAt', 'approvedAt', 'updatedAt', 'scheduledStartAt'],
    timeRange,
    referenceDate
  );

  // Lookup map of verified revenue transaction amounts across all loaded transactions for ad cost recovery
  const allTxAmountByRef = new Map<string, number>();
  for (const tx of allCombinedTransactions) {
    if (!isRevenueTransaction(tx)) continue;
    const pkrVal = convertRecordAmountToPkr(tx.amount, tx.currency, currencyConfig);
    if (pkrVal === null) continue;
    const txId = tx.id ? String(tx.id).trim() : '';
    const txTid = tx.transactionId ? String(tx.transactionId).trim() : '';
    const txType = String(tx.type || '').trim();
    if (txId) allTxAmountByRef.set(txId, pkrVal);
    if (txTid) allTxAmountByRef.set(txTid, pkrVal);
    if ((txType === 'Ad Campaign Fee' || txType === 'Advertisement') && tx.adIdRef) {
      allTxAmountByRef.set(String(tx.adIdRef).trim(), pkrVal);
    }
  }

  // Track eligible financial records with missing dates across full streams in bounded ranges
  let missingEligibleFinancialDateCount = 0;

  let txHasUndatedEligible = false;
  for (const tx of allCombinedTransactions) {
    if (!isRevenueTransaction(tx)) continue;
    const ts = getRecordTimestampMs(tx, ['verifiedAt', 'createdAt', 'dateTime']);
    if (ts === null && timeRange !== 'all') {
      txHasUndatedEligible = true;
      missingEligibleFinancialDateCount++;
    }
  }

  // 1. Authoritative Revenue Transactions (exclude Wallet Deposit & Refund)
  interface CountedRevenueTxEntry {
    tx: PaymentTransaction;
    txType: string;
    pkrVal: number;
    timestamps: Array<{ ms: number; dateOnly: boolean; raw: string }>;
    claimedByFeeLog: boolean;
    claimedBySubscriber: boolean;
  }

  const countedTxIds = new Set<string>();
  const countedAdIds = new Set<string>();
  const revenueTxByUniqueKey = new Map<string, CountedRevenueTxEntry>();
  const countedRevenueTxEntries: CountedRevenueTxEntry[] = [];

  let totalTransactionsRevenuePkrRaw = 0;
  let txCurrencyUnconvertible = false;
  let countedTransactionsCount = 0;

  for (const tx of filteredTransactions.items) {
    if (!isRevenueTransaction(tx)) continue;

    const pkrVal = convertRecordAmountToPkr(tx.amount, tx.currency, currencyConfig);
    if (pkrVal === null) {
      txCurrencyUnconvertible = true;
      continue;
    }

    countedTransactionsCount++;
    totalTransactionsRevenuePkrRaw += pkrVal;

    const txId = tx.id ? String(tx.id).trim() : '';
    const txTid = tx.transactionId ? String(tx.transactionId).trim() : '';
    const txType = String(tx.type || '').trim();

    const entry: CountedRevenueTxEntry = {
      tx,
      txType,
      pkrVal,
      timestamps: getRecordTimestampValues(tx, ['dateTime', 'createdAt', 'verifiedAt']),
      claimedByFeeLog: false,
      claimedBySubscriber: false
    };
    countedRevenueTxEntries.push(entry);

    if (txId) {
      countedTxIds.add(txId);
      countedTxIds.add(`log-${txId}`);
      revenueTxByUniqueKey.set(txId, entry);
      revenueTxByUniqueKey.set(`log-${txId}`, entry);
    }
    if (txTid) {
      countedTxIds.add(txTid);
      countedTxIds.add(`log-${txTid}`);
      revenueTxByUniqueKey.set(txTid, entry);
      revenueTxByUniqueKey.set(`log-${txTid}`, entry);
    }

    if ((txType === 'Ad Campaign Fee' || txType === 'Advertisement') && tx.adIdRef) {
      countedAdIds.add(String(tx.adIdRef).trim());
    }
  }

  const txRangeUndetermined = timeRange !== 'all' && txHasUndatedEligible;
  const totalTransactionsRevenuePkr: number | null =
    txCurrencyUnconvertible || txRangeUndetermined ? null : totalTransactionsRevenuePkrRaw;

  // 2. Paid Fee Logs (only status === 'Paid'; strict ID/ref deduplication + ambiguous legacy detection)
  let feeLogsHasUndatedEligible = false;
  for (const log of rawFeeLogs) {
    if (!log || typeof log !== 'object' || log.status !== 'Paid') continue;
    const ts = getRecordTimestampMs(log, ['dateTime', 'createdAt']);
    if (ts === null && timeRange !== 'all') {
      feeLogsHasUndatedEligible = true;
      missingEligibleFinancialDateCount++;
    }
  }

  let feeLogSumRaw = 0;
  let unlinkedFeeLogSumRaw = 0;
  let paidFeeLogsCount = 0;
  let feeLogCurrencyUnconvertible = false;
  let ambiguousFinancialDeduplicationCount = 0;

  const validInRangePaidFeeLogs: Array<{
    log: JobPostingFeeLog;
    pkrVal: number;
    matchedByUniqueKey: boolean;
  }> = [];

  for (const log of filteredFeeLogs.items) {
    if (!log || log.status !== 'Paid') continue;

    const pkrVal = convertRecordAmountToPkr(log.amount, log.currency, currencyConfig);
    if (pkrVal === null) {
      feeLogCurrencyUnconvertible = true;
      continue;
    }

    paidFeeLogsCount++;
    feeLogSumRaw += pkrVal;

    const logObj = log as Record<string, any>;
    const logId = log.id ? String(log.id).trim() : '';
    const rawLogId = logId.replace(/^log-/, '');
    const logTid = logObj.transactionId ? String(logObj.transactionId).trim() : '';
    const logPayTxId = logObj.paymentTransactionId ? String(logObj.paymentTransactionId).trim() : '';
    const logTxRef = logObj.transactionRef ? String(logObj.transactionRef).trim() : '';

    const matchedTxEntry =
      (logId && revenueTxByUniqueKey.get(logId)) ||
      (rawLogId && revenueTxByUniqueKey.get(rawLogId)) ||
      (logTid && revenueTxByUniqueKey.get(logTid)) ||
      (logPayTxId && revenueTxByUniqueKey.get(logPayTxId)) ||
      (logTxRef && revenueTxByUniqueKey.get(logTxRef)) ||
      undefined;

    if (matchedTxEntry) {
      matchedTxEntry.claimedByFeeLog = true;
    }

    validInRangePaidFeeLogs.push({
      log,
      pkrVal,
      matchedByUniqueKey: Boolean(matchedTxEntry)
    });
  }

  for (const item of validInRangePaidFeeLogs) {
    if (item.matchedByUniqueKey) continue;

    const logObj = item.log as Record<string, any>;
    const explicitRef =
      String(logObj.transactionId || logObj.paymentTransactionId || logObj.transactionRef || '').trim();
    if (explicitRef) {
      // Carries its own unique reference not present in counted revenue transactions
      unlinkedFeeLogSumRaw += item.pkrVal;
      continue;
    }

    const logUserId = item.log.userId ? String(item.log.userId).trim() : '';
    const logEmail = item.log.userEmail ? String(item.log.userEmail).trim().toLowerCase() : '';
    const logTitle = item.log.jobTitle ? String(item.log.jobTitle).trim().toLowerCase() : '';
    const logJobId = logObj.jobIdRef ? String(logObj.jobIdRef).trim() : '';
    const logTimestamps = getRecordTimestampValues(item.log, ['dateTime', 'createdAt']);

    const unclaimedCandidate = countedRevenueTxEntries.find((entry) => {
      if (entry.claimedByFeeLog) return false;
      if (entry.txType !== 'Job Posting Fee' && entry.txType !== 'Job Posting') return false;
      if (Math.abs(entry.pkrVal - item.pkrVal) >= 0.01) return false;

      const txUserId = entry.tx.userId ? String(entry.tx.userId).trim() : '';
      const txEmail = entry.tx.userEmail ? String(entry.tx.userEmail).trim().toLowerCase() : '';
      const sameUser = Boolean((logUserId && txUserId && logUserId === txUserId) || (logEmail && txEmail && logEmail === txEmail));
      if (!sameUser) return false;

      const txTitle = entry.tx.jobTitleRef ? String(entry.tx.jobTitleRef).trim().toLowerCase() : '';
      const txJobId = entry.tx.jobIdRef ? String(entry.tx.jobIdRef).trim() : '';
      const sameJob = Boolean((logJobId && txJobId && logJobId === txJobId) || (logTitle && txTitle && logTitle === txTitle));
      if (!sameJob) return false;

      return areTimestampsPotentiallySamePayment(logTimestamps, entry.timestamps);
    });

    if (unclaimedCandidate) {
      unclaimedCandidate.claimedByFeeLog = true;
      ambiguousFinancialDeduplicationCount++;
    } else {
      unlinkedFeeLogSumRaw += item.pkrVal;
    }
  }

  const feeLogsRangeUndetermined = timeRange !== 'all' && feeLogsHasUndatedEligible;
  const totalFeeLogsPkr: number | null =
    feeLogCurrencyUnconvertible || feeLogsRangeUndetermined ? null : feeLogSumRaw;

  // 3. Active Subscribers (strict ID/ref deduplication + ambiguous legacy detection)
  let subscribersHasUndatedEligible = false;
  for (const sub of rawSubscribers) {
    if (!isEligiblePaidSubscriber(sub)) {
      continue;
    }
    const ts = getRecordTimestampMs(sub, ['subscribedAt', 'createdAt']);
    if (ts === null && timeRange !== 'all') {
      subscribersHasUndatedEligible = true;
      missingEligibleFinancialDateCount++;
    }
  }

  let subscribersSumRaw = 0;
  let unlinkedSubscribersSumRaw = 0;
  let paidSubscribersCount = 0;
  let subscriberCurrencyUnconvertible = false;

  const validInRangePaidSubscribers: Array<{
    sub: Subscriber;
    pkrVal: number;
    matchedByUniqueKey: boolean;
  }> = [];

  for (const sub of filteredSubscribers.items) {
    if (!isEligiblePaidSubscriber(sub)) continue;

    const pkrVal = convertRecordAmountToPkr(sub.amountPaid, sub.currency, currencyConfig);
    if (pkrVal === null) {
      subscriberCurrencyUnconvertible = true;
      continue;
    }

    paidSubscribersCount++;
    subscribersSumRaw += pkrVal;

    const subId = sub.id ? String(sub.id).trim() : '';
    const rawSubId = subId.startsWith('sub-') ? subId.slice(4).trim() : '';
    const pTxId = sub.paymentTransactionId ? String(sub.paymentTransactionId).trim() : '';
    const txRef = sub.transactionRef ? String(sub.transactionRef).trim() : '';

    const matchedTxEntry =
      (pTxId && revenueTxByUniqueKey.get(pTxId)) ||
      (txRef && revenueTxByUniqueKey.get(txRef)) ||
      (rawSubId && revenueTxByUniqueKey.get(rawSubId)) ||
      undefined;

    if (matchedTxEntry) {
      matchedTxEntry.claimedBySubscriber = true;
    }

    validInRangePaidSubscribers.push({
      sub,
      pkrVal,
      matchedByUniqueKey: Boolean(matchedTxEntry)
    });
  }

  for (const item of validInRangePaidSubscribers) {
    if (item.matchedByUniqueKey) continue;

    const pTxId = item.sub.paymentTransactionId ? String(item.sub.paymentTransactionId).trim() : '';
    const txRef = item.sub.transactionRef ? String(item.sub.transactionRef).trim() : '';
    if (pTxId || txRef) {
      // Explicit unique payment reference not present in counted revenue transactions
      unlinkedSubscribersSumRaw += item.pkrVal;
      continue;
    }

    const subObj = item.sub as Record<string, any>;
    const subUserId = subObj.userId ? String(subObj.userId).trim() : '';
    const subEmail = item.sub.email ? String(item.sub.email).trim().toLowerCase() : '';
    const subTimestamps = getRecordTimestampValues(item.sub, ['subscribedAt', 'createdAt']);

    const unclaimedCandidate = countedRevenueTxEntries.find((entry) => {
      if (entry.claimedBySubscriber) return false;
      if (entry.txType !== 'Subscription') return false;
      if (Math.abs(entry.pkrVal - item.pkrVal) >= 0.01) return false;

      const txUserId = entry.tx.userId ? String(entry.tx.userId).trim() : '';
      const txEmail = entry.tx.userEmail ? String(entry.tx.userEmail).trim().toLowerCase() : '';
      const sameUser = Boolean((subUserId && txUserId && subUserId === txUserId) || (subEmail && txEmail && subEmail === txEmail));
      if (!sameUser) return false;

      return areTimestampsPotentiallySamePayment(subTimestamps, entry.timestamps);
    });

    if (unclaimedCandidate) {
      unclaimedCandidate.claimedBySubscriber = true;
      ambiguousFinancialDeduplicationCount++;
    } else {
      unlinkedSubscribersSumRaw += item.pkrVal;
    }
  }

  const subscribersRangeUndetermined = timeRange !== 'all' && subscribersHasUndatedEligible;
  const totalSubscribersPkr: number | null =
    subscriberCurrencyUnconvertible || subscribersRangeUndetermined ? null : subscribersSumRaw;

  // 4. Advertisements (only verified paymentStatus === 'Paid' + actual AdvertisementRecord fields)
  let adsHasUndatedEligibleOrUnverified = false;
  for (const ad of rawAds) {
    const evaluation = getAdvertisementVerifiedCostPkr(ad, allTxAmountByRef);
    if (!evaluation.eligiblePaid && !evaluation.unverifiedMissingStatus) {
      continue;
    }
    const ts = getRecordTimestampMs(ad, ['createdAt', 'approvedAt', 'updatedAt', 'scheduledStartAt']);
    if (ts === null && timeRange !== 'all') {
      adsHasUndatedEligibleOrUnverified = true;
      missingEligibleFinancialDateCount++;
    }
  }

  let adsSumRaw = 0;
  let unlinkedAdsSumRaw = 0;
  let paidAdsCount = 0;
  let hasUnreliablePaidAd = false;
  let hasUnverifiedMissingStatusAd = false;

  for (const ad of filteredAds.items) {
    const evaluation = getAdvertisementVerifiedCostPkr(ad, allTxAmountByRef);
    if (evaluation.unverifiedMissingStatus) {
      hasUnverifiedMissingStatusAd = true;
      continue;
    }
    if (!evaluation.eligiblePaid) {
      continue;
    }
    paidAdsCount++;
    if (evaluation.costPkr === null) {
      hasUnreliablePaidAd = true;
      continue;
    }
    adsSumRaw += evaluation.costPkr;

    const adObj = ad as Record<string, any>;
    const adId = ad.id ? String(ad.id).trim() : '';
    const walletRef = ad.walletTxId ? String(ad.walletTxId).trim() : '';
    const payTxRef = adObj.paymentTransactionId ? String(adObj.paymentTransactionId).trim() : '';
    const txRef = adObj.transactionRef ? String(adObj.transactionRef).trim() : '';

    const alreadyInTransactions =
      (adId && countedAdIds.has(adId)) ||
      (walletRef && countedTxIds.has(walletRef)) ||
      (payTxRef && countedTxIds.has(payTxRef)) ||
      (txRef && countedTxIds.has(txRef));

    if (!alreadyInTransactions) {
      unlinkedAdsSumRaw += evaluation.costPkr;
    }
  }

  const adsRangeUndetermined = timeRange !== 'all' && adsHasUndatedEligibleOrUnverified;
  const totalAdsPkr: number | null =
    adsRangeUndetermined || hasUnreliablePaidAd || hasUnverifiedMissingStatusAd ? null : adsSumRaw;

  const activeAdsCount = filteredAds.items.filter((a) => a && a.status === 'active').length;

  // 5. Total Gross Revenue (propagate any stream uncertainty, missing dates, currency failure, or ambiguous dedupe)
  const hasStreamUncertainty =
    totalTransactionsRevenuePkr === null ||
    totalFeeLogsPkr === null ||
    totalSubscribersPkr === null ||
    totalAdsPkr === null ||
    ambiguousFinancialDeduplicationCount > 0;

  const totalGrossRevenuePkr: number | null = hasStreamUncertainty
    ? null
    : totalTransactionsRevenuePkrRaw + unlinkedFeeLogSumRaw + unlinkedSubscribersSumRaw + unlinkedAdsSumRaw;

  // 6. Scraper & Non-Financial Metrics
  const totalScrapedInAudit = filteredAuditLogs.items.length;
  const approvedScraped = filteredAuditLogs.items.filter(
    (a) => a?.status === 'Approved Live' || a?.status === 'Auto-Approved'
  ).length;
  const scraperSuccessRate =
    totalScrapedInAudit > 0 ? Math.round((approvedScraped / totalScrapedInAudit) * 100) : null;

  const employersCount = filteredUsers.items.filter(
    (u) => u?.role?.toLowerCase()?.includes('employer') || u?.companyName
  ).length;
  const seekersCount = Math.max(0, filteredUsers.items.length - employersCount);

  const regionCounts = filteredJobs.items.reduce((acc, job) => {
    const r = job?.region || 'Global';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalJobsCount = filteredJobs.items.length;
  const regionBreakdown = (Object.entries(regionCounts) as [string, number][]).map(
    ([regionName, count]) => ({
      regionName,
      count,
      pct: totalJobsCount > 0 ? Math.round((Number(count) / totalJobsCount) * 100) : 0
    })
  );

  const missingDateRecordsCount =
    filteredJobs.missingDateCount +
    filteredPending.missingDateCount +
    filteredUsers.missingDateCount +
    filteredSubscribers.missingDateCount +
    filteredFeeLogs.missingDateCount +
    filteredTransactions.missingDateCount +
    filteredAuditLogs.missingDateCount +
    filteredBatchRuns.missingDateCount +
    filteredAds.missingDateCount;

  return {
    timeRange,
    totalFeeLogsPkr,
    paidFeeLogsCount,
    totalSubscribersPkr,
    paidSubscribersCount,
    totalAdsPkr,
    paidAdsCount,
    activeAdsCount,
    totalTransactionsRevenuePkr,
    countedTransactionsCount,
    totalGrossRevenuePkr,
    scraperSuccessRate,
    filteredJobsCount: totalJobsCount,
    filteredPendingJobsCount: filteredPending.items.length,
    filteredGovtJobsCount: filteredJobs.items.filter((j) => j?.isGovtJob).length,
    filteredUsersCount: filteredUsers.items.length,
    filteredAuditLogsCount: totalScrapedInAudit,
    filteredBatchRunsCount: filteredBatchRuns.items.length,
    employersCount,
    seekersCount,
    missingDateRecordsCount,
    missingEligibleFinancialDateCount,
    ambiguousFinancialDeduplicationCount,
    regionBreakdown
  };
}

const TIME_RANGE_OPTIONS: Array<{ id: AnalyticsTimeRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: '7 Days' },
  { id: '30days', label: '30 Days' },
  { id: 'all', label: 'All Time' }
];

export const AdminAnalyticsOverview: React.FC<AdminAnalyticsOverviewProps> = ({
  jobs = [],
  pendingJobs = [],
  users = [],
  subscribers = [],
  feeLogs = [],
  paymentTransactions = [],
  auditLogs = [],
  batchRuns = [],
  currencyConfig,
  onNavigateTab = (_tabId: any) => {},
  ads = []
}) => {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('all');
  const [selectedCurrencyView, setSelectedCurrencyView] = useState<'PKR' | 'USD' | 'AED' | 'SAR'>('PKR');

  const safeFeeLogs = Array.isArray(feeLogs) ? feeLogs : [];
  const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safePendingJobs = Array.isArray(pendingJobs) ? pendingJobs : [];
  const safePaymentTransactions = Array.isArray(paymentTransactions) ? paymentTransactions : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const safeBatchRuns = Array.isArray(batchRuns) ? batchRuns : [];
  const safeAds = Array.isArray(ads) ? ads : [];

  const metrics = computeAnalyticsMetrics({
    jobs: safeJobs,
    pendingJobs: safePendingJobs,
    users: safeUsers,
    subscribers: safeSubscribers,
    feeLogs: safeFeeLogs,
    paymentTransactions: safePaymentTransactions,
    auditLogs: safeAuditLogs,
    batchRuns: safeBatchRuns,
    ads: safeAds,
    timeRange,
    currencyConfig
  });

  const selectedRateValid =
    selectedCurrencyView === 'PKR' ||
    (typeof currencyConfig?.rates?.[selectedCurrencyView] === 'number' &&
      Number.isFinite(currencyConfig.rates[selectedCurrencyView]) &&
      currencyConfig.rates[selectedCurrencyView] > 0);

  const fmt = (amountPkr: number | null) =>
    formatAnalyticsCurrency(amountPkr, selectedCurrencyView, currencyConfig);

  return (
    <div className="space-y-6 text-white">
      {/* Top Banner & Fast Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 font-black text-[10px] tracking-wider uppercase border border-amber-500/30">
                Executive Command
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Cluster Health: <span className="text-slate-300 font-bold">Not Verified (No Telemetry Feed)</span>
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2">
              <span>Platform Intelligence & Global Metrics</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl mt-1">
              Computed strictly from verified paid job fee logs, authoritative payment transactions (excluding wallet deposits and refunds), active paid subscriptions, paid ad campaigns, and loaded records.
            </p>
          </div>

          {/* Quick Currency & View Scope Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
              {(['PKR', 'USD', 'AED', 'SAR'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setSelectedCurrencyView(curr)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedCurrencyView === curr
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
              {TIME_RANGE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimeRange(t.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    timeRange === t.id
                      ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!selectedRateValid && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center space-x-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Configured exchange rate for {selectedCurrencyView} is missing or invalid. Monetary figures display N/A until configured in Multi-Currency &amp; Forex or switch back to PKR.
          </span>
        </div>
      )}

      {timeRange !== 'all' && metrics.missingDateRecordsCount > 0 && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-2"
        >
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {metrics.missingDateRecordsCount} loaded record(s) have no valid timestamp and are excluded from the selected {TIME_RANGE_OPTIONS.find((o) => o.id === timeRange)?.label} range (switch to All Time to include undated records).
          </span>
        </div>
      )}

      {selectedRateValid && metrics.totalGrossRevenuePkr === null && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center space-x-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Gross Revenue displays N/A because one or more eligible financial records have unverified ad payment status/cost, missing currency or exchange rates, missing timestamps in the selected range, or ambiguous legacy transaction links.
          </span>
        </div>
      )}

      {/* PRIMARY 4-METRIC GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Gross Revenue */}
        <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Recorded Gross Revenue</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {fmt(metrics.totalGrossRevenuePkr)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-semibold">
              {metrics.countedTransactionsCount} verified revenue tx(s) • Month-over-month trend: Not Available
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Paid Job Fees: {fmt(metrics.totalFeeLogsPkr)}</span>
            <button
              type="button"
              onClick={() => onNavigateTab('fee-logs')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              View Logs →
            </button>
          </div>
        </div>

        {/* Metric 2: Live Active Jobs */}
        <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Active Listings</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {metrics.filteredJobsCount.toLocaleString()}
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-amber-400 mt-1 font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>{metrics.filteredPendingJobsCount} in approval queue</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Govt / FPSC: {metrics.filteredGovtJobsCount}</span>
            <button
              type="button"
              onClick={() => onNavigateTab('pending')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Review Queue →
            </button>
          </div>
        </div>

        {/* Metric 3: User Directory & Employers */}
        <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Registered Users</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {metrics.filteredUsersCount.toLocaleString()}
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-indigo-400 mt-1 font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>{metrics.employersCount} Employer Accounts</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Candidates: {metrics.seekersCount}</span>
            <button
              type="button"
              onClick={() => onNavigateTab('user-audit')}
              className="text-indigo-400 hover:underline font-bold cursor-pointer"
            >
              User Directory →
            </button>
          </div>
        </div>

        {/* Metric 4: Ingestion Scraper Throughput */}
        <div className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Scraper Approval Rate</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Bot className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {metrics.scraperSuccessRate !== null ? `${metrics.scraperSuccessRate}%` : 'N/A'}
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-cyan-400 mt-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{metrics.filteredBatchRunsCount} logged runs</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-2 flex justify-between">
            <span>Audit Entries: {metrics.filteredAuditLogsCount}</span>
            <button
              type="button"
              onClick={() => onNavigateTab('scraped-history')}
              className="text-cyan-400 hover:underline font-bold cursor-pointer"
            >
              Audit Trail →
            </button>
          </div>
        </div>
      </div>

      {/* DETAILED SECONDARY SECTION: REGIONAL DISTRIBUTION & REVENUE STREAMS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Regional Distribution Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <span>Regional Vacancy Distribution</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{metrics.filteredJobsCount} Total</span>
          </div>

          {metrics.regionBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No live job listings loaded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.regionBreakdown.map(({ regionName, count, pct }) => (
                <div key={regionName} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">{regionName}</span>
                    <span className="font-mono text-amber-400 font-bold">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Grouped by loaded job region</span>
            <button
              type="button"
              onClick={() => onNavigateTab('currency-forex')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Exchange Rates &amp; Regions →
            </button>
          </div>
        </div>

        {/* Revenue Streams Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Monetization &amp; Channel Streams</span>
            </h3>
            <span className="text-xs font-mono text-slate-400 font-bold">Verified Paid Streams</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Per-Job Posting Paywall</div>
                <div className="text-[10px] text-slate-400">
                  {metrics.paidFeeLogsCount} Paid of {safeFeeLogs.length} Fee Log(s)
                </div>
              </div>
              <div className="text-right font-mono font-bold text-emerald-400">
                {fmt(metrics.totalFeeLogsPkr)}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Candidate Pro Alert Subscriptions</div>
                <div className="text-[10px] text-slate-400">
                  {metrics.paidSubscribersCount} Active Paid of {safeSubscribers.length} Subscribers
                </div>
              </div>
              <div className="text-right font-mono font-bold text-indigo-400">
                {fmt(metrics.totalSubscribersPkr)}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Banner &amp; Feed Ad Campaigns</div>
                <div className="text-[10px] text-slate-400">
                  {metrics.paidAdsCount} Verified Paid • {metrics.activeAdsCount} Active of {safeAds.length}
                </div>
              </div>
              <div className="text-right font-mono font-bold text-amber-400">
                {fmt(metrics.totalAdsPkr)}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>View campaign metrics in Ad Hub</span>
            <button
              type="button"
              onClick={() => onNavigateTab('advertisements')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Ad Campaign Hub →
            </button>
          </div>
        </div>

        {/* Quick Admin Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Admin Speed Actions</span>
            </h3>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded">Shortcuts</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => onNavigateTab('add-job')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <div className="text-amber-400 font-black">+ Post Job</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Manual publication</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('broadcast-center')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <div className="text-indigo-400 font-black">📢 Broadcast</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Server campaigns hub</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('ai-enhancer')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <div className="text-emerald-400 font-black">✓ Quality Audit</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Rule-based scorer</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('data-backup')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <div className="text-cyan-400 font-black">💾 Backup</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">JSON &amp; CSV export</div>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
            <strong>Note:</strong> Use the <strong>Rule-Based Quality Analyzer</strong> to check job title length, salary presence, tags, and formatting rules.
          </div>
        </div>
      </div>
    </div>
  );
};
