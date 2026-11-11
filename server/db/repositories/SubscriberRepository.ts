import { Subscriber } from '../../../src/types/job';
import { PaymentRepository } from './PaymentRepository';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const isTest = () => process.env.IS_TEST === 'true';

// Test-isolated in-memory store (only active when process.env.IS_TEST === 'true')
const testSubscribers = new Map<string, any>();

export interface StoredSubscriberRecord extends Subscriber {
  normalizedEmail?: string;
  normalizedPhone?: string;
  paymentTransactionId?: string;
  createdAt?: string;
  updatedAt?: string;
  importedAt?: string;
  isDemo?: boolean;
}

export function normalizeEmail(email?: string): string {
  return String(email || '').trim().toLowerCase();
}

export function normalizePhone(phone?: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export function isSyntheticDemoSubscriber(record: any): boolean {
  if (!record || typeof record !== 'object') return true;
  const id = String(record.id || '').trim().toLowerCase();
  const email = normalizeEmail(record.email);
  const name = String(record.name || '').trim().toLowerCase();

  if (
    id === 'sub-1' ||
    id === 'demo' ||
    id.startsWith('demo-') ||
    id.startsWith('sub-demo') ||
    record.isDemo === true ||
    record.isSynthetic === true
  ) {
    return true;
  }

  // Hard-coded default fallback demo record from initial App state
  if (id === 'sub-1' || (email === 'usman.c@example.com' && name.includes('usman chaudhry'))) {
    return true;
  }

  return false;
}

export const VALID_SUBSCRIBER_STATUSES = ['Active', 'Pending', 'Expiring Soon', 'Expired'] as const;
export type SubscriberStatus = typeof VALID_SUBSCRIBER_STATUSES[number];

export function validateSubscriberRecord(
  record: any,
  isUpdate = false
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be a non-null object.'] };
  }

  if (!isUpdate || record.id !== undefined) {
    const id = String(record.id || '').trim();
    if (!id || id.length === 0 || id.length > 120) {
      errors.push('Subscriber ID must be a non-empty string under 120 characters.');
    }
  }

  if (!isUpdate || record.name !== undefined) {
    const name = String(record.name || '').trim();
    if (!name || name.length === 0 || name.length > 200) {
      errors.push('Subscriber name must be a non-empty string under 200 characters.');
    }
  }

  if (!isUpdate || record.phone !== undefined) {
    const phone = String(record.phone || '').trim();
    if (!phone || phone.length === 0 || phone.length > 50) {
      errors.push('Subscriber phone number must be a non-empty string under 50 characters.');
    }
  }

  if (record.email !== undefined && record.email !== null && record.email !== '') {
    if (typeof record.email !== 'string' || record.email.length > 255) {
      errors.push('Subscriber email must be a valid string under 255 characters.');
    }
  }

  if (!isUpdate || record.amountPaid !== undefined) {
    const amount = Number(record.amountPaid);
    if (typeof record.amountPaid !== 'number' || !Number.isFinite(amount) || amount < 0) {
      errors.push('amountPaid must be a finite, non-negative number.');
    }
  }

  if (!isUpdate || record.status !== undefined) {
    if (!VALID_SUBSCRIBER_STATUSES.includes(record.status)) {
      errors.push(
        `Subscriber status must be one of: ${VALID_SUBSCRIBER_STATUSES.join(', ')}. Received: '${record.status}'`
      );
    }
  }

  if (record.whatsappEnabled !== undefined && typeof record.whatsappEnabled !== 'boolean') {
    errors.push('whatsappEnabled must be a boolean.');
  }

  return { valid: errors.length === 0, errors };
}

async function getSubscribersCollection() {
  const db = await getMongoDb();
  return db.collection('subscribers');
}

let indexesEnsured = false;
async function ensureSubscriberIndexes() {
  if (indexesEnsured || isTest() || !isMongoConfigured()) return;
  try {
    const coll = await getSubscribersCollection();
    await coll.createIndex({ id: 1 }, { unique: true });
    await coll.createIndex({ normalizedEmail: 1 }, { sparse: true });
    await coll.createIndex({ normalizedPhone: 1 }, { sparse: true });
    await coll.createIndex({ paymentTransactionId: 1 }, { sparse: true });
    await coll.createIndex({ transactionRef: 1 }, { sparse: true });
    indexesEnsured = true;
    console.log('[SubscriberRepository] Unique and non-unique indexes verified on subscribers collection.');
  } catch (err: any) {
    console.warn('[SubscriberRepository] Notice: Index verification note on subscribers collection:', err?.message || err);
  }
}

ensureSubscriberIndexes().catch(() => {});

export class SubscriberRepository {
  /**
   * Reset in-memory test store (for automated test isolation only)
   */
  static resetTestStore(): void {
    if (!isTest()) return;
    testSubscribers.clear();
  }

  /**
   * Inject a subscriber directly into the in-memory test store (test isolation only)
   */
  static injectTestSubscriber(sub: StoredSubscriberRecord): void {
    if (!isTest()) return;
    testSubscribers.set(sub.id, {
      ...sub,
      normalizedEmail: normalizeEmail(sub.email),
      normalizedPhone: normalizePhone(sub.phone)
    });
  }

  /**
   * Helper: Reconciles subscriber status against authoritative payment transaction if linked.
   * If MongoDB fails during transaction lookup, throws an explicit error (Rule 69).
   */
  private static async reconcileSubscriberStatus(sub: StoredSubscriberRecord): Promise<StoredSubscriberRecord> {
    if (!sub || !sub.paymentTransactionId) {
      // Manually created admin subscriber with no linked transaction preserves its status (Rule 70)
      return sub;
    }

    let tx: any = null;
    try {
      tx = await PaymentRepository.getByIdAsync(sub.paymentTransactionId);
    } catch (err: any) {
      // If MongoDB is configured but fails, return explicit error rather than assuming payment success (Rule 69)
      throw new Error(`Authoritative payment transaction lookup failed: ${err?.message || err}`);
    }

    if (!tx) {
      return sub;
    }

    const txStatus = String(tx.status || '').trim();

    // Rule 65: A transaction with status "Success" may produce subscriber status "Active"
    if (txStatus === 'Success' || txStatus === 'Paid' || txStatus === 'Approved') {
      return {
        ...sub,
        status: sub.status === 'Expiring Soon' ? 'Expiring Soon' : 'Active',
        amountPaid: Number(tx.amount) ?? sub.amountPaid,
        currency: (tx.currency as any) || sub.currency,
        plan: tx.plan || sub.plan
      };
    }

    // Rule 66: "Pending", "Verifying", or "VerificationUncertain" must NEVER produce "Active"
    if (
      txStatus === 'Pending' ||
      txStatus === 'Verifying' ||
      txStatus === 'VerificationUncertain' ||
      txStatus === 'Under Review'
    ) {
      return {
        ...sub,
        status: 'Pending',
        amountPaid: Number(tx.amount) ?? sub.amountPaid,
        currency: (tx.currency as any) || sub.currency,
        plan: tx.plan || sub.plan
      };
    }

    // Rule 67: "Failed", "Refunded", "Rejected", "Compensated" must not remain Active
    if (
      txStatus === 'Failed' ||
      txStatus === 'Rejected' ||
      txStatus === 'Refunded' ||
      txStatus === 'Compensated' ||
      PaymentRepository.isTransactionCompensated(tx)
    ) {
      return {
        ...sub,
        status: 'Expired',
        amountPaid: Number(tx.amount) ?? sub.amountPaid,
        currency: (tx.currency as any) || sub.currency,
        plan: tx.plan || sub.plan
      };
    }

    return sub;
  }

  /**
   * Cleans sensitive fields before returning to client (Rule 61)
   */
  private static sanitizeForClient(sub: StoredSubscriberRecord): Subscriber {
    const { _id, normalizedEmail, normalizedPhone, isDemo, proofScreenshotUrl, ...clean } = sub as any;
    return clean as Subscriber;
  }

  /**
   * Retrieves all subscribers.
   */
  static async getAllSubscribers(): Promise<Subscriber[]> {
    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Subscribers require MongoDB.');
      }
    }

    let rawRecords: StoredSubscriberRecord[] = [];

    if (isTest()) {
      rawRecords = Array.from(testSubscribers.values());
    } else {
      try {
        const coll = await getSubscribersCollection();
        const docs = await withMongoTimeout(
          coll.find({ isDemo: { $ne: true } }).toArray(),
          10000,
          'fetch subscribers'
        );
        rawRecords = docs.map((doc) => {
          const { _id, ...safe } = doc;
          return safe as StoredSubscriberRecord;
        });
      } catch (err: any) {
        throw new Error(`MongoDB subscribers query failed: ${err?.message || err}`);
      }
    }

    // Exclude synthetic demo records
    rawRecords = rawRecords.filter((r) => !isSyntheticDemoSubscriber(r));

    // Reconcile each linked record with authoritative payment transactions
    const reconciledList: Subscriber[] = [];
    for (const sub of rawRecords) {
      const reconciled = await this.reconcileSubscriberStatus(sub);
      reconciledList.push(this.sanitizeForClient(reconciled));
    }

    // Sort by subscribedAt descending
    reconciledList.sort((a, b) => {
      const dateA = new Date(a.subscribedAt).getTime() || 0;
      const dateB = new Date(b.subscribedAt).getTime() || 0;
      return dateB - dateA;
    });

    return reconciledList;
  }

  /**
   * Retrieves a subscriber by unique ID.
   */
  static async getById(id: string): Promise<Subscriber | null> {
    if (!id || typeof id !== 'string') return null;
    const cleanId = id.trim();

    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Subscribers require MongoDB.');
      }
    }

    let record: StoredSubscriberRecord | null = null;

    if (isTest()) {
      record = testSubscribers.get(cleanId) || null;
    } else {
      try {
        const coll = await getSubscribersCollection();
        const doc = await withMongoTimeout(
          coll.findOne({ id: cleanId, isDemo: { $ne: true } }),
          10000,
          'fetch subscriber by id'
        );
        if (doc) {
          const { _id, ...safe } = doc;
          record = safe as StoredSubscriberRecord;
        }
      } catch (err: any) {
        throw new Error(`MongoDB subscribers getById failed: ${err?.message || err}`);
      }
    }

    if (!record || isSyntheticDemoSubscriber(record)) return null;

    const reconciled = await this.reconcileSubscriberStatus(record);
    return this.sanitizeForClient(reconciled);
  }

  /**
   * Retrieves a subscriber linked to an internal payment transaction ID.
   */
  static async getByPaymentTransactionId(txId: string): Promise<Subscriber | null> {
    if (!txId) return null;
    const cleanTxId = String(txId).trim();

    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Subscribers require MongoDB.');
      }
    }

    let record: StoredSubscriberRecord | null = null;

    if (isTest()) {
      for (const item of testSubscribers.values()) {
        if (item.paymentTransactionId === cleanTxId || item.id === cleanTxId) {
          record = item;
          break;
        }
      }
    } else {
      try {
        const coll = await getSubscribersCollection();
        const doc = await withMongoTimeout(
          coll.findOne({
            $or: [{ paymentTransactionId: cleanTxId }, { id: cleanTxId }],
            isDemo: { $ne: true }
          }),
          10000,
          'fetch subscriber by paymentTransactionId'
        );
        if (doc) {
          const { _id, ...safe } = doc;
          record = safe as StoredSubscriberRecord;
        }
      } catch (err: any) {
        throw new Error(`MongoDB subscribers getByPaymentTransactionId failed: ${err?.message || err}`);
      }
    }

    if (!record || isSyntheticDemoSubscriber(record)) return null;

    const reconciled = await this.reconcileSubscriberStatus(record);
    return this.sanitizeForClient(reconciled);
  }

  /**
   * Creates a Pending subscriber record linked to a verified internal payment transaction (Rules 52-60).
   */
  static async createPendingSubscription(params: {
    paymentTransactionId: string;
    authUserId?: string;
    authUserEmail?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    whatsappEnabled?: boolean;
  }): Promise<Subscriber> {
    const { paymentTransactionId, authUserId, authUserEmail, guestName, guestEmail, guestPhone } = params;

    if (!paymentTransactionId || typeof paymentTransactionId !== 'string') {
      throw new Error('Valid paymentTransactionId is required.');
    }
    const cleanTxId = paymentTransactionId.trim();

    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Subscribers require MongoDB.');
      }
    }

    // 1. Authoritative transaction lookup (Rule 53)
    let tx: any = null;
    try {
      tx = await PaymentRepository.getByIdAsync(cleanTxId);
    } catch (err: any) {
      throw new Error(`Authoritative transaction verification failed: ${err?.message || err}`);
    }

    if (!tx) {
      throw new Error(`Payment transaction '${cleanTxId}' was not found.`);
    }

    // Verify type is Subscription (Rule 53)
    const txType = String(tx.type || '').trim().toLowerCase();
    if (txType !== 'subscription') {
      throw new Error(`Transaction '${cleanTxId}' is not a Subscription transaction (type: ${tx.type}).`);
    }

    // Verify transaction status is Pending (Rule 54)
    const txStatus = String(tx.status || '').trim();
    if (txStatus !== 'Pending') {
      throw new Error(
        `Subscription subscriber can only be created for Pending transactions. Current status: '${txStatus}'.`
      );
    }

    // Ownership verification (Rule 55-56)
    if (authUserId) {
      // Authenticated user: must match transaction's user ID or user Email
      const txUserId = String(tx.userId || '');
      const txUserEmail = normalizeEmail(tx.userEmail);
      const isOwner =
        (txUserId && txUserId === authUserId) ||
        (authUserEmail && txUserEmail && txUserEmail === normalizeEmail(authUserEmail));

      if (!isOwner) {
        throw new Error('Access denied: You are not authorized to create a subscriber for another user transaction.');
      }
    } else {
      // Guest submission: verify submitted contact against transaction's stored details (Rule 56)
      const txEmail = normalizeEmail(tx.userEmail);
      const txPhone = normalizePhone(tx.senderPhoneOrAccount);
      const subEmail = normalizeEmail(guestEmail);
      const subPhone = normalizePhone(guestPhone);

      const matchesEmail = Boolean(txEmail && subEmail && txEmail === subEmail);
      const matchesPhone = Boolean(txPhone && subPhone && txPhone === subPhone);

      if (!matchesEmail && !matchesPhone) {
        throw new Error(
          'Guest identity verification failed: Submitted contact details do not match the transaction record.'
        );
      }
    }

    // Idempotency: If subscriber already exists with this transaction reference, return it (Rules 59-60)
    const existing = await this.getByPaymentTransactionId(cleanTxId);
    if (existing) {
      return existing;
    }

    // Derive authoritative plan, amount, currency, and payment method from transaction (Rule 58)
    const authoritativeAmount = Number(tx.amount) || 0;
    const authoritativePlan = tx.plan || tx.packageSnapshot?.name || 'Pro Alerts';
    const authoritativeMethod = tx.paymentMethod || 'Manual';
    const authoritativeCurrency = tx.currency || 'PKR';
    const subscriberName = String(guestName || tx.userName || tx.senderName || 'Subscriber').trim();
    const subscriberEmail = String(guestEmail || tx.userEmail || '').trim();
    const subscriberPhone = String(guestPhone || tx.senderPhoneOrAccount || '').trim();

    const newSubscriber: StoredSubscriberRecord = {
      id: `sub-${cleanTxId}`,
      name: subscriberName,
      email: subscriberEmail,
      phone: subscriberPhone,
      normalizedEmail: normalizeEmail(subscriberEmail),
      normalizedPhone: normalizePhone(subscriberPhone),
      plan: authoritativePlan,
      paymentMethod: authoritativeMethod,
      amountPaid: authoritativeAmount,
      currency: authoritativeCurrency as any,
      status: 'Pending', // Rule 57: Public creation endpoint must never accept arbitrary Active status
      subscribedAt: tx.dateTime || tx.createdAt || new Date().toISOString(),
      whatsappEnabled: params.whatsappEnabled !== false,
      transactionRef: tx.transactionId || cleanTxId,
      paymentTransactionId: cleanTxId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const validation = validateSubscriberRecord(newSubscriber);
    if (!validation.valid) {
      throw new Error(`Subscriber validation error: ${validation.errors.join(', ')}`);
    }

    if (isTest()) {
      testSubscribers.set(newSubscriber.id, { ...newSubscriber });
      return this.sanitizeForClient(newSubscriber);
    }

    try {
      const coll = await getSubscribersCollection();
      await withMongoTimeout(
        coll.updateOne(
          { id: newSubscriber.id },
          { $setOnInsert: newSubscriber },
          { upsert: true }
        ),
        10000,
        'insert pending subscriber'
      );
    } catch (err: any) {
      throw new Error(`MongoDB failed to create subscriber record: ${err?.message || err}`);
    }

    return this.sanitizeForClient(newSubscriber);
  }

  /**
   * Creates a subscriber administratively (Admin only).
   */
  static async createAdminSubscriber(data: Partial<Subscriber>): Promise<Subscriber> {
    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Subscribers require MongoDB.');
      }
    }

    const subId = String(data.id || `sub-${Date.now()}`).trim();
    const existing = await this.getById(subId);
    if (existing) {
      throw new Error(`Subscriber with ID '${subId}' already exists.`);
    }

    const subscriber: StoredSubscriberRecord = {
      id: subId,
      name: String(data.name || '').trim(),
      email: String(data.email || '').trim(),
      phone: String(data.phone || '').trim(),
      normalizedEmail: normalizeEmail(data.email),
      normalizedPhone: normalizePhone(data.phone),
      plan: String(data.plan || 'Pro Alerts'),
      paymentMethod: String(data.paymentMethod || 'Manual'),
      amountPaid: Number(data.amountPaid) || 0,
      currency: (data.currency || 'PKR') as any,
      status: (data.status || 'Active') as any,
      subscribedAt: data.subscribedAt || new Date().toISOString(),
      whatsappEnabled: Boolean(data.whatsappEnabled),
      transactionRef: data.transactionRef ? String(data.transactionRef).trim() : undefined,
      paymentTransactionId: data.paymentTransactionId ? String(data.paymentTransactionId).trim() : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      categories: Array.isArray(data.categories) ? data.categories : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const validation = validateSubscriberRecord(subscriber);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    if (isTest()) {
      testSubscribers.set(subscriber.id, { ...subscriber });
      return this.sanitizeForClient(subscriber);
    }

    try {
      const coll = await getSubscribersCollection();
      await withMongoTimeout(
        coll.insertOne(subscriber),
        10000,
        'create admin subscriber'
      );
    } catch (err: any) {
      throw new Error(`MongoDB error creating subscriber: ${err?.message || err}`);
    }

    return this.sanitizeForClient(subscriber);
  }

  /**
   * Updates an existing subscriber (Admin only).
   * Ensures update operations cannot overwrite immutable identifiers or payment transaction references (Rule 46).
   */
  static async updateSubscriber(id: string, updates: Partial<Subscriber>): Promise<Subscriber> {
    if (!id || typeof id !== 'string') {
      throw new Error('Subscriber ID is required for update.');
    }
    const cleanId = id.trim();

    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Subscribers require MongoDB.');
      }
    }

    let existing: StoredSubscriberRecord | null = null;
    if (isTest()) {
      existing = testSubscribers.get(cleanId) || null;
    } else {
      try {
        const coll = await getSubscribersCollection();
        const doc = await withMongoTimeout(
          coll.findOne({ id: cleanId }),
          10000,
          'fetch subscriber for update'
        );
        if (doc) {
          const { _id, ...safe } = doc;
          existing = safe as StoredSubscriberRecord;
        }
      } catch (err: any) {
        throw new Error(`MongoDB error reading subscriber for update: ${err?.message || err}`);
      }
    }

    if (!existing) {
      throw new Error(`Subscriber '${cleanId}' was not found.`);
    }

    // Validate update fields
    const validation = validateSubscriberRecord(updates, true);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    // Rule 46: Ensure update operations cannot accidentally overwrite immutable identifiers or payment transaction references
    const {
      id: _ignoredId,
      paymentTransactionId: _ignoredPaymentTxId,
      ...allowedUpdates
    } = updates as any;

    const updatedRecord: StoredSubscriberRecord = {
      ...existing,
      ...allowedUpdates,
      id: existing.id, // Immutable
      paymentTransactionId: existing.paymentTransactionId, // Immutable
      normalizedEmail: updates.email !== undefined ? normalizeEmail(updates.email) : existing.normalizedEmail,
      normalizedPhone: updates.phone !== undefined ? normalizePhone(updates.phone) : existing.normalizedPhone,
      updatedAt: new Date().toISOString()
    };

    if (isTest()) {
      testSubscribers.set(cleanId, updatedRecord);
      const reconciled = await this.reconcileSubscriberStatus(updatedRecord);
      return this.sanitizeForClient(reconciled);
    }

    try {
      const coll = await getSubscribersCollection();
      await withMongoTimeout(
        coll.updateOne(
          { id: cleanId },
          { $set: updatedRecord }
        ),
        10000,
        'update subscriber'
      );
    } catch (err: any) {
      throw new Error(`MongoDB error updating subscriber: ${err?.message || err}`);
    }

    const reconciled = await this.reconcileSubscriberStatus(updatedRecord);
    return this.sanitizeForClient(reconciled);
  }

  /**
   * Deletes a single subscriber (Admin only).
   * CRITICAL: Does NOT delete or alter underlying payment transactions (Rule 15, 117, 139).
   */
  static async deleteSubscriber(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') {
      throw new Error('Subscriber ID is required for deletion.');
    }
    const cleanId = id.trim();

    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Subscribers require MongoDB.');
      }
    }

    if (isTest()) {
      const existed = testSubscribers.has(cleanId);
      testSubscribers.delete(cleanId);
      return existed;
    }

    try {
      const coll = await getSubscribersCollection();
      const res = await withMongoTimeout(
        coll.deleteOne({ id: cleanId }),
        10000,
        'delete subscriber'
      );
      return (res.deletedCount || 0) > 0;
    } catch (err: any) {
      throw new Error(`MongoDB error deleting subscriber '${cleanId}': ${err?.message || err}`);
    }
  }

  /**
   * Bulk-deletes subscribers by ID (Admin only).
   * CRITICAL: Does NOT delete or alter underlying payment transactions (Rule 15, 117, 139).
   */
  static async bulkDeleteSubscribers(ids: string[]): Promise<number> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return 0;
    }
    const cleanIds = ids.map((id) => String(id).trim()).filter(Boolean);
    if (cleanIds.length === 0) return 0;

    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Persistent Subscribers require MongoDB.');
      }
    }

    if (isTest()) {
      let count = 0;
      for (const id of cleanIds) {
        if (testSubscribers.delete(id)) {
          count++;
        }
      }
      return count;
    }

    try {
      const coll = await getSubscribersCollection();
      const res = await withMongoTimeout(
        coll.deleteMany({ id: { $in: cleanIds } }),
        10000,
        'bulk delete subscribers'
      );
      return res.deletedCount || 0;
    } catch (err: any) {
      throw new Error(`MongoDB error during bulk subscriber deletion: ${err?.message || err}`);
    }
  }

  /**
   * Imports legacy LocalStorage records with validation, deduplication and verification (Rules 94-104).
   */
  static async importLegacySubscribers(records: any[]): Promise<{
    success: boolean;
    importedCount: number;
    verifiedCount: number;
    alreadyRepresentedCount: number;
    skippedCount: number;
    records: Subscriber[];
    errors?: string[];
  }> {
    if (!Array.isArray(records)) {
      throw new Error('Records must be an array of subscriber objects.');
    }

    if (!isTest()) {
      if (!isMongoConfigured()) {
        throw new Error('MongoDB is not configured. Legacy migration requires active MongoDB.');
      }
    }

    let importedCount = 0;
    let alreadyRepresentedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const validRecordsToInsert: StoredSubscriberRecord[] = [];

    // 1. Inspect and filter records
    for (let i = 0; i < records.length; i++) {
      const raw = records[i];

      // Exclude hardcoded demo record and synthetic records (Rules 95, 136)
      if (isSyntheticDemoSubscriber(raw)) {
        skippedCount++;
        continue;
      }

      // Validate legitimate record (Rule 97)
      const validation = validateSubscriberRecord(raw);
      if (!validation.valid) {
        errors.push(`Record index ${i} ('${raw?.id || 'unidentified'}'): ${validation.errors.join('; ')}`);
        continue;
      }

      const cleanId = String(raw.id).trim();

      // Check if already in storage (idempotent migration)
      const existing = await this.getById(cleanId);
      if (existing) {
        alreadyRepresentedCount++;
        continue;
      }

      const storedItem: StoredSubscriberRecord = {
        id: cleanId,
        name: String(raw.name).trim(),
        email: String(raw.email || '').trim(),
        phone: String(raw.phone).trim(),
        normalizedEmail: normalizeEmail(raw.email),
        normalizedPhone: normalizePhone(raw.phone),
        plan: String(raw.plan || 'Pro Alerts'),
        paymentMethod: String(raw.paymentMethod || 'Manual'),
        amountPaid: Number(raw.amountPaid) || 0,
        currency: (raw.currency || 'PKR') as any,
        status: (raw.status || 'Active') as any,
        subscribedAt: raw.subscribedAt || new Date().toISOString(),
        expiryDate: raw.expiryDate || undefined,
        whatsappEnabled: Boolean(raw.whatsappEnabled),
        emailEnabled: raw.emailEnabled !== undefined ? Boolean(raw.emailEnabled) : undefined,
        smsEnabled: raw.smsEnabled !== undefined ? Boolean(raw.smsEnabled) : undefined,
        categories: Array.isArray(raw.categories) ? raw.categories : undefined,
        transactionRef: raw.transactionRef ? String(raw.transactionRef).trim() : undefined,
        paymentTransactionId: raw.paymentTransactionId ? String(raw.paymentTransactionId).trim() : undefined,
        notes: raw.notes ? String(raw.notes) : undefined,
        importedAt: new Date().toISOString(),
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      validRecordsToInsert.push(storedItem);
    }

    // If any legitimate record failed validation, do not claim complete success (Rule 102)
    if (errors.length > 0) {
      return {
        success: false,
        importedCount: 0,
        verifiedCount: alreadyRepresentedCount,
        alreadyRepresentedCount,
        skippedCount,
        records: [],
        errors
      };
    }

    // 2. Persist new records
    if (validRecordsToInsert.length > 0) {
      if (isTest()) {
        for (const item of validRecordsToInsert) {
          testSubscribers.set(item.id, { ...item });
          importedCount++;
        }
      } else {
        try {
          const coll = await getSubscribersCollection();
          for (const item of validRecordsToInsert) {
            await withMongoTimeout(
              coll.updateOne(
                { id: item.id },
                { $setOnInsert: item },
                { upsert: true }
              ),
              10000,
              'insert legacy subscriber'
            );
            importedCount++;
          }
        } catch (err: any) {
          throw new Error(`MongoDB failed to persist migrated subscribers: ${err?.message || err}`);
        }
      }
    }

    const verifiedCount = importedCount + alreadyRepresentedCount;
    const allCurrentSubscribers = await this.getAllSubscribers();

    return {
      success: true,
      importedCount,
      verifiedCount,
      alreadyRepresentedCount,
      skippedCount,
      records: allCurrentSubscribers
    };
  }
}
