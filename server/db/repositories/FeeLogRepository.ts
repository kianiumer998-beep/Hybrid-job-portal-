import { JobPostingFeeLog } from '../../../src/types/job';
import { PaymentRepository } from './PaymentRepository';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const isTest = () => process.env.IS_TEST === 'true';

// Test-isolated in-memory stores (only active when process.env.IS_TEST === 'true')
const testLegacyFeeLogs = new Map<string, any>();
const testArchivedFeeLogIds = new Set<string>();

export function mapPaymentStatusToFeeLogStatus(
  txStatus?: string
): 'Paid' | 'Pending' | 'Failed' | 'Refunded' | string {
  const s = String(txStatus || '').trim().toLowerCase();
  if (s === 'success' || s === 'paid' || s === 'completed' || s === 'approved') {
    return 'Paid';
  }
  if (s === 'pending' || s === 'under review') {
    return 'Pending';
  }
  if (s === 'failed' || s === 'rejected') {
    return 'Failed';
  }
  if (s === 'refunded' || s === 'compensated') {
    return 'Refunded';
  }
  return txStatus || 'Pending';
}

export function isJobPostingTransaction(tx: any): boolean {
  if (!tx || typeof tx !== 'object') return false;
  const type = String(tx.type || '').trim().toLowerCase();
  if (
    type === 'job posting fee' ||
    type === 'job posting' ||
    type === 'job_posting_fee' ||
    type === 'job_posting'
  ) {
    return true;
  }
  // Exclude explicit other transaction types
  const nonJobTypes = ['subscription', 'wallet deposit', 'ad campaign fee', 'ad campaign', 'refund'];
  if (nonJobTypes.includes(type)) {
    return false;
  }
  // If transaction has job reference and is not of another explicit type
  if (tx.jobIdRef || tx.jobTitleRef) {
    return true;
  }
  return false;
}

export function mapTransactionToFeeLog(tx: any): JobPostingFeeLog {
  const status = mapPaymentStatusToFeeLogStatus(tx.status);
  return {
    id: String(tx.id || tx.transactionId),
    dateTime: String(tx.dateTime || tx.createdAt || tx.createdDate || new Date().toISOString()),
    userId: String(tx.userId || ''),
    userName: String(tx.userName || tx.senderName || 'Anonymous'),
    userEmail: String(tx.userEmail || ''),
    jobTitle: String(tx.jobTitleRef || tx.jobTitle || 'Job Posting'),
    amount: Number(tx.amount) || 0,
    currency: (tx.currency || 'PKR') as any,
    paymentMethod: String(tx.paymentMethod || 'Manual'),
    status
  };
}

export function isSyntheticDemoRecord(record: any): boolean {
  if (!record || typeof record !== 'object') return true;
  const id = String(record.id || '').trim().toLowerCase();
  const userId = String(record.userId || '').trim().toLowerCase();
  const email = String(record.userEmail || '').trim().toLowerCase();
  const title = String(record.jobTitle || '').trim().toLowerCase();

  if (
    id === 'log-demo-1' ||
    id === 'log-demo-2' ||
    id.startsWith('log-demo-') ||
    id.startsWith('demo-') ||
    id === 'demo'
  ) {
    return true;
  }
  if (userId === 'user-demo-1' && email === 'ali.raza@example.com' && title.includes('python & django')) {
    return true;
  }
  if (record.isDemo === true || record.isSynthetic === true) {
    return true;
  }
  return false;
}

export function isValidLegacyRecord(record: any): boolean {
  if (!record || typeof record !== 'object') return false;
  const id = String(record.id || '').trim();
  const jobTitle = String(record.jobTitle || '').trim();
  const amount = Number(record.amount);
  if (!id || !jobTitle) return false;
  if (isNaN(amount) || amount < 0) return false;
  return true;
}

async function getLegacyFeeLogsCollection() {
  const db = await getMongoDb();
  return db.collection('legacy_fee_logs');
}

async function getArchivedFeeLogsCollection() {
  const db = await getMongoDb();
  return db.collection('archived_fee_logs');
}

export class FeeLogRepository {
  /**
   * Reset in-memory test stores (test isolation only)
   */
  static resetTestStore(): void {
    if (!isTest()) return;
    testLegacyFeeLogs.clear();
    testArchivedFeeLogIds.clear();
  }

  /**
   * Add a record directly to test store (test isolation only)
   */
  static injectTestLegacyLog(log: JobPostingFeeLog): void {
    if (!isTest()) return;
    testLegacyFeeLogs.set(log.id, { ...log });
  }

  /**
   * Add an archived ID directly to test store (test isolation only)
   */
  static injectTestArchivedId(id: string): void {
    if (!isTest()) return;
    testArchivedFeeLogIds.add(id);
  }

  /**
   * Fetches all active, non-archived fee logs.
   * Authoritative transactions from PaymentRepository take precedence.
   */
  static async getAllFeeLogs(): Promise<JobPostingFeeLog[]> {
    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Fee Logs require MongoDB.');
      }
    }

    // 1. Fetch authoritative transactions from PaymentRepository
    let allTransactions: any[] = [];
    try {
      allTransactions = await PaymentRepository.getAllAsync();
    } catch (err: any) {
      if (!isTest()) {
        throw new Error(`Failed to load authoritative transactions: ${err?.message || err}`);
      }
      allTransactions = [];
    }

    const jobPostingTransactions = allTransactions.filter(isJobPostingTransaction);
    const txMappedLogs: JobPostingFeeLog[] = jobPostingTransactions.map(mapTransactionToFeeLog);

    // Track transaction-derived identifiers to suppress duplicate legacy records
    const transactionIdSet = new Set<string>();
    for (const tx of jobPostingTransactions) {
      if (tx.id) {
        transactionIdSet.add(String(tx.id));
        transactionIdSet.add('log-' + String(tx.id));
      }
      if (tx.transactionId) {
        transactionIdSet.add(String(tx.transactionId));
      }
    }

    // 2. Fetch archived IDs
    const archivedIdSet = new Set<string>();
    if (isTest()) {
      for (const id of testArchivedFeeLogIds) {
        archivedIdSet.add(id);
      }
    } else {
      try {
        const archivedColl = await getArchivedFeeLogsCollection();
        const archivedDocs = await withMongoTimeout(
          archivedColl.find({}).toArray(),
          10000,
          'fetch archived fee logs'
        );
        for (const doc of archivedDocs) {
          if (doc.logId) archivedIdSet.add(String(doc.logId));
        }
      } catch (err: any) {
        throw new Error(`MongoDB archived_fee_logs query failed: ${err?.message || err}`);
      }
    }

    // Helper to check if an ID or normalized ID is archived
    const isArchived = (id: string, altId?: string) => {
      if (archivedIdSet.has(id)) return true;
      if (id.startsWith('log-') && archivedIdSet.has(id.slice(4))) return true;
      if (!id.startsWith('log-') && archivedIdSet.has('log-' + id)) return true;
      if (altId && archivedIdSet.has(altId)) return true;
      return false;
    };

    // 3. Fetch legacy records
    let legacyLogs: JobPostingFeeLog[] = [];
    if (isTest()) {
      legacyLogs = Array.from(testLegacyFeeLogs.values())
        .filter((l) => !l.isArchived)
        .map((l) => {
          const { isArchived: _, importedAt: __, importedBy: ___, ...safe } = l;
          return safe as JobPostingFeeLog;
        });
    } else {
      try {
        const legacyColl = await getLegacyFeeLogsCollection();
        const legacyDocs = await withMongoTimeout(
          legacyColl.find({ isArchived: { $ne: true } }).toArray(),
          10000,
          'fetch legacy fee logs'
        );
        legacyLogs = legacyDocs.map((doc) => {
          const { _id, isArchived: _, importedAt: __, importedBy: ___, ...safe } = doc;
          return safe as JobPostingFeeLog;
        });
      } catch (err: any) {
        throw new Error(`MongoDB legacy_fee_logs query failed: ${err?.message || err}`);
      }
    }

    // Filter out legacy records that are duplicates of transaction-backed logs
    const filteredLegacyLogs = legacyLogs.filter((log) => {
      const logId = String(log.id || '');
      const rawId = logId.replace(/^log-/, '');
      if (transactionIdSet.has(logId) || transactionIdSet.has(rawId)) {
        return false;
      }
      return true;
    });

    // 4. Combine transaction logs and legacy logs, then filter out archived records
    const combinedLogs: JobPostingFeeLog[] = [...txMappedLogs, ...filteredLegacyLogs].filter(
      (log) => !isArchived(log.id)
    );

    // 5. Deduplicate by log ID (giving transaction-backed logs priority)
    const seenIds = new Set<string>();
    const deduplicatedLogs: JobPostingFeeLog[] = [];
    for (const log of combinedLogs) {
      const cleanId = String(log.id || '');
      const normalizedId = cleanId.replace(/^log-/, '');
      if (seenIds.has(cleanId) || seenIds.has(normalizedId)) {
        continue;
      }
      seenIds.add(cleanId);
      seenIds.add(normalizedId);
      deduplicatedLogs.push(log);
    }

    // 6. Sort by date descending
    deduplicatedLogs.sort((a, b) => {
      const dateA = new Date(a.dateTime).getTime() || 0;
      const dateB = new Date(b.dateTime).getTime() || 0;
      return dateB - dateA;
    });

    return deduplicatedLogs;
  }

  /**
   * Archives a single fee log entry durably.
   * NOTE: This does NOT delete or alter the underlying transaction in PaymentRepository.
   */
  static async archiveFeeLog(logId: string, adminUser = 'Admin'): Promise<boolean> {
    if (!logId || typeof logId !== 'string') {
      throw new Error('Valid logId is required for archiving.');
    }
    const cleanId = logId.trim();

    if (isTest()) {
      testArchivedFeeLogIds.add(cleanId);
      if (testLegacyFeeLogs.has(cleanId)) {
        const item = testLegacyFeeLogs.get(cleanId);
        item.isArchived = true;
      }
      return true;
    }

    if (!isMongoConfigured()) {
      throw new Error('MongoDB is not configured. Cannot perform durable archive.');
    }

    try {
      const archivedColl = await getArchivedFeeLogsCollection();
      await withMongoTimeout(
        archivedColl.updateOne(
          { logId: cleanId },
          {
            $set: {
              logId: cleanId,
              archivedAt: new Date().toISOString(),
              archivedBy: adminUser
            }
          },
          { upsert: true }
        ),
        10000,
        'archive fee log'
      );

      // Also mark in legacy collection if present
      const legacyColl = await getLegacyFeeLogsCollection();
      await withMongoTimeout(
        legacyColl.updateOne(
          { $or: [{ id: cleanId }, { id: cleanId.replace(/^log-/, '') }] },
          { $set: { isArchived: true, archivedAt: new Date().toISOString() } }
        ),
        10000,
        'mark legacy fee log archived'
      ).catch(() => {});

      return true;
    } catch (err: any) {
      throw new Error(`Failed to archive fee log in MongoDB: ${err?.message || err}`);
    }
  }

  /**
   * Bulk archives multiple fee logs durably.
   * NOTE: This does NOT delete or alter underlying transactions in PaymentRepository.
   */
  static async bulkArchiveFeeLogs(logIds: string[], adminUser = 'Admin'): Promise<number> {
    if (!Array.isArray(logIds) || logIds.length === 0) {
      return 0;
    }
    const cleanIds = Array.from(new Set(logIds.map((id) => String(id).trim()).filter(Boolean)));
    if (cleanIds.length === 0) return 0;

    if (isTest()) {
      let count = 0;
      for (const id of cleanIds) {
        testArchivedFeeLogIds.add(id);
        if (testLegacyFeeLogs.has(id)) {
          testLegacyFeeLogs.get(id).isArchived = true;
        }
        count++;
      }
      return count;
    }

    if (!isMongoConfigured()) {
      throw new Error('MongoDB is not configured. Cannot perform durable bulk archive.');
    }

    try {
      const archivedColl = await getArchivedFeeLogsCollection();
      const now = new Date().toISOString();
      const operations = cleanIds.map((id) => ({
        updateOne: {
          filter: { logId: id },
          update: {
            $set: {
              logId: id,
              archivedAt: now,
              archivedBy: adminUser
            }
          },
          upsert: true
        }
      }));

      await withMongoTimeout(
        archivedColl.bulkWrite(operations, { ordered: false }),
        10000,
        'bulk archive fee logs'
      );

      // Also update legacy collection if applicable
      const legacyColl = await getLegacyFeeLogsCollection();
      await withMongoTimeout(
        legacyColl.updateMany(
          {
            $or: [
              { id: { $in: cleanIds } },
              { id: { $in: cleanIds.map((id) => id.replace(/^log-/, '')) } }
            ]
          },
          { $set: { isArchived: true, archivedAt: now } }
        ),
        10000,
        'bulk mark legacy fee logs archived'
      ).catch(() => {});

      return cleanIds.length;
    } catch (err: any) {
      throw new Error(`Failed to bulk archive fee logs in MongoDB: ${err?.message || err}`);
    }
  }

  /**
   * Imports legacy fee logs from LocalStorage into MongoDB.
   * Idempotent, rejects synthetic demo records, ignores records already represented by transactions,
   * and verifies saved records before returning success.
   */
  static async importLegacyRecords(
    records: any[],
    adminUser = 'Admin'
  ): Promise<{
    importedCount: number;
    verifiedCount: number;
    skippedCount: number;
    records: JobPostingFeeLog[];
  }> {
    if (!Array.isArray(records)) {
      throw new Error('Records must be an array.');
    }

    // 1. Filter out synthetic demo records and invalid records
    const validLegitimateRecords: JobPostingFeeLog[] = [];
    let skippedCount = 0;

    for (const r of records) {
      if (isSyntheticDemoRecord(r)) {
        skippedCount++;
        continue;
      }
      if (!isValidLegacyRecord(r)) {
        skippedCount++;
        continue;
      }
      validLegitimateRecords.push({
        id: String(r.id).trim(),
        dateTime: String(r.dateTime || new Date().toISOString()),
        userId: String(r.userId || ''),
        userName: String(r.userName || 'Anonymous'),
        userEmail: String(r.userEmail || ''),
        jobTitle: String(r.jobTitle || ''),
        amount: Number(r.amount) || 0,
        currency: (r.currency || 'PKR') as any,
        paymentMethod: String(r.paymentMethod || 'Manual'),
        status: mapPaymentStatusToFeeLogStatus(r.status)
      });
    }

    // 2. Fetch existing transactions to avoid duplicating existing transactions
    let allTransactions: any[] = [];
    try {
      allTransactions = await PaymentRepository.getAllAsync();
    } catch {
      allTransactions = [];
    }

    const txIdSet = new Set<string>();
    for (const tx of allTransactions) {
      if (tx.id) {
        txIdSet.add(String(tx.id));
        txIdSet.add('log-' + String(tx.id));
      }
      if (tx.transactionId) {
        txIdSet.add(String(tx.transactionId));
      }
    }

    // Filter out records already represented by transaction IDs
    const toImport = validLegitimateRecords.filter((r) => {
      const rawId = r.id.replace(/^log-/, '');
      if (txIdSet.has(r.id) || txIdSet.has(rawId)) {
        skippedCount++;
        return false;
      }
      return true;
    });

    if (toImport.length === 0) {
      return {
        importedCount: 0,
        verifiedCount: 0,
        skippedCount,
        records: []
      };
    }

    // 3. Persist records
    if (isTest()) {
      let imported = 0;
      for (const rec of toImport) {
        testLegacyFeeLogs.set(rec.id, {
          ...rec,
          isArchived: false,
          importedAt: new Date().toISOString(),
          importedBy: adminUser
        });
        imported++;
      }
      // Verification
      let verified = 0;
      const verifiedRecords: JobPostingFeeLog[] = [];
      for (const rec of toImport) {
        if (testLegacyFeeLogs.has(rec.id)) {
          verified++;
          verifiedRecords.push(rec);
        }
      }
      return {
        importedCount: imported,
        verifiedCount: verified,
        skippedCount,
        records: verifiedRecords
      };
    }

    if (!isMongoConfigured()) {
      throw new Error('MongoDB is not configured. Cannot perform durable legacy fee logs import.');
    }

    try {
      const legacyColl = await getLegacyFeeLogsCollection();
      const now = new Date().toISOString();

      const ops = toImport.map((rec) => ({
        updateOne: {
          filter: { id: rec.id },
          update: {
            $setOnInsert: {
              ...rec,
              isArchived: false,
              importedAt: now,
              importedBy: adminUser
            }
          },
          upsert: true
        }
      }));

      await withMongoTimeout(
        legacyColl.bulkWrite(ops, { ordered: false }),
        10000,
        'import legacy fee logs'
      );

      // 4. Server-side verification: Read back stored records to guarantee persistence
      const importedIds = toImport.map((r) => r.id);
      const storedDocs = await withMongoTimeout(
        legacyColl.find({ id: { $in: importedIds } }).toArray(),
        10000,
        'verify imported legacy fee logs'
      );

      const verifiedRecords: JobPostingFeeLog[] = storedDocs.map((doc) => {
        const { _id, isArchived: _, importedAt: __, importedBy: ___, ...safe } = doc;
        return safe as JobPostingFeeLog;
      });

      return {
        importedCount: toImport.length,
        verifiedCount: verifiedRecords.length,
        skippedCount,
        records: verifiedRecords
      };
    } catch (err: any) {
      throw new Error(`Failed to import legacy fee logs into MongoDB: ${err?.message || err}`);
    }
  }
}
