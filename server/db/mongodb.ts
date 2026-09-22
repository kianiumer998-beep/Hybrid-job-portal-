import { MongoClient, Db, Collection } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri || !uri.trim()) {
    throw new Error(
      'MongoDB is not configured. Please define the MONGODB_URI environment variable (e.g. mongodb+srv://... or mongodb://...).'
    );
  }
  return uri.trim();
}

export function isMongoConfigured(): boolean {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  return Boolean(uri && uri.trim());
}

/**
 * Checks whether an error is network/connection-related so we can safely reconnect and retry.
 */
export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const name = String(err.name || '').toLowerCase();
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '');
  
  if (
    name.includes('timeout') ||
    name.includes('network') ||
    name.includes('serverselection') ||
    msg.includes('timed out') ||
    msg.includes('connection timed out') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket closed') ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED'
  ) {
    return true;
  }

  // Check MongoDB RetryableWriteError label or driver error labels
  if (err.hasErrorLabel && (err.hasErrorLabel('RetryableWriteError') || err.hasErrorLabel('TransientTransactionError'))) {
    return true;
  }
  if (err.errorLabels) {
    if (typeof err.errorLabels.has === 'function') {
      if (err.errorLabels.has('RetryableWriteError') || err.errorLabels.has('TransientTransactionError')) {
        return true;
      }
    } else if (Array.isArray(err.errorLabels)) {
      if (err.errorLabels.includes('RetryableWriteError') || err.errorLabels.includes('TransientTransactionError')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Closes and resets the cached MongoDB client, destroying stale or dead sockets in the pool.
 */
export async function closeAndResetMongoClient(cause?: any): Promise<void> {
  const clientToClose = cachedClient;
  cachedClient = null;
  cachedDb = null;
  clientPromise = null;

  if (clientToClose) {
    try {
      if (cause) {
        console.warn(`[MongoDB] Resetting connection pool due to network issue: ${cause.name || cause.message || cause}`);
      }
      await clientToClose.close(true);
    } catch {
      // Ignore errors on closing a dead socket
    }
  }
}

export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  if (!clientPromise) {
    const uri = getMongoUri();
    const client = new MongoClient(uri, {
      maxPoolSize: 15,
      minPoolSize: 0,              // Never hold dead idle sockets
      maxIdleTimeMS: 20000,        // Prune connections idle for 20s to prevent remote timeout
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
      socketTimeoutMS: 20000,      // Fast socket timeout
      waitQueueTimeoutMS: 8000,
      retryWrites: true,
      retryReads: true,
    });

    client.on('serverClosed', () => {
      console.warn('[MongoDB Event] Server connection closed. Invalidating client pool.');
      closeAndResetMongoClient('serverClosed');
    });

    clientPromise = client.connect().then((connectedClient) => {
      cachedClient = connectedClient;
      cachedDb = connectedClient.db();
      console.log(`[MongoDB] Connected successfully to database "${cachedDb.databaseName}"`);
      // Run index initialization asynchronously in background without blocking queries
      setTimeout(() => {
        if (cachedDb) {
          initMongoIndexes(cachedDb).catch((e) => {
            console.warn('[MongoDB Background Index Notice]', e.message);
          });
        }
      }, 1000);
      return connectedClient;
    }).catch((err) => {
      clientPromise = null;
      cachedClient = null;
      cachedDb = null;
      console.error('[MongoDB] Connection error:', err.message);
      throw err;
    });
  }

  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }
  const client = await getMongoClient();
  cachedDb = client.db();
  return cachedDb;
}

/**
 * Robust executor for database operations.
 * Automatically catches network timeouts, invalidates broken socket pools, retries once,
 * and falls back gracefully to a fallback function (e.g. local cache) if remote remains down.
 */
export async function executeWithMongoRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  fallbackFn?: () => Promise<T> | T
): Promise<T> {
  try {
    return await operation();
  } catch (firstErr: any) {
    if (isNetworkError(firstErr)) {
      console.warn(`[MongoDB] ${operationName} network error (${firstErr.name}: ${firstErr.message}). Resetting pool and retrying...`);
      await closeAndResetMongoClient(firstErr);
      try {
        return await operation();
      } catch (secondErr: any) {
        console.error(`[MongoDB] ${operationName} retry failed:`, secondErr.message);
        if (fallbackFn) {
          console.warn(`[MongoDB] Engaging fallback for ${operationName}...`);
          return await fallbackFn();
        }
        throw secondErr;
      }
    }
    throw firstErr;
  }
}

export async function getJobsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('jobs');
}

export async function getPendingJobsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('pending_jobs');
}

export async function getScraperSourcesCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('scraper_sources');
}

export async function getScraperRunsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('scraper_runs');
}

export async function getScraperGroupsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('scraper_groups');
}

export async function getSettingsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('site_settings');
}

export async function getNotificationsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('notifications');
}

export async function getUserNotificationRecordsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('user_notification_records');
}

export async function getTransactionsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('transactions');
}

export async function getUsersCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('users');
}

export async function getApplicationsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('applications');
}

export async function getAdsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('advertisements');
}

export async function getCasesCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('cases');
}

export async function getSupportTicketsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('support_tickets');
}

export async function getSavedJobsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('saved_jobs');
}

export async function getAuditLogsCollection(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('audit_logs');
}

let indexesInitialized = false;
async function initMongoIndexes(db: Db): Promise<void> {
  if (indexesInitialized) return;
  indexesInitialized = true;
  try {
    const jobsColl = db.collection('jobs');
    const pendingColl = db.collection('pending_jobs');
    const scraperSourcesColl = db.collection('scraper_sources');
    const scraperRunsColl = db.collection('scraper_runs');
    const scraperGroupsColl = db.collection('scraper_groups');
    const settingsColl = db.collection('site_settings');
    const notifsColl = db.collection('notifications');
    const userNotifsColl = db.collection('user_notification_records');
    const txColl = db.collection('transactions');
    const userColl = db.collection('users');
    const appColl = db.collection('applications');
    const adsColl = db.collection('advertisements');
    const casesColl = db.collection('cases');
    const ticketsColl = db.collection('support_tickets');
    const savedJobsColl = db.collection('saved_jobs');
    const auditColl = db.collection('audit_logs');

    const indexTasks: (() => Promise<any>)[] = [
      () => jobsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => jobsColl.createIndex({ slug: 1 }, { background: true }),
      () => jobsColl.createIndex({ status: 1, createdAt: -1 }, { background: true }),
      () => pendingColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => pendingColl.createIndex({ status: 1, createdAt: -1 }, { background: true }),
      () => scraperSourcesColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => scraperRunsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => scraperRunsColl.createIndex({ startedAt: -1 }, { background: true }),
      () => scraperGroupsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => settingsColl.createIndex({ key: 1 }, { unique: true, background: true }),
      () => notifsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => userNotifsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => txColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => txColl.createIndex({ idempotencyKey: 1 }, { sparse: true, background: true }),
      () => userColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => userColl.createIndex({ email: 1 }, { unique: true, background: true }),
      () => appColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => adsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => casesColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => ticketsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      () => savedJobsColl.createIndex({ userId: 1, jobId: 1 }, { unique: true, background: true }),
      () => auditColl.createIndex({ id: 1 }, { unique: true, background: true })
    ];

    // Execute gently in small batches to preserve connection pool bandwidth
    for (let i = 0; i < indexTasks.length; i += 2) {
      const batch = indexTasks.slice(i, i + 2);
      await Promise.all(batch.map(fn => fn().catch(() => {})));
    }
    console.log('[MongoDB] Production collections and essential indexes initialized.');
  } catch (err: any) {
    console.warn('[MongoDB] Index creation notice:', err.message);
  }
}

/**
 * Normalizes a MongoDB document into a clean frontend Job object.
 * Removes internal MongoDB _id and guarantees valid array formats.
 */
export function normalizeMongoJob(doc: any): any {
  if (!doc) return null;
  const { _id, ...job } = doc;
  
  return {
    ...job,
    id: job.id || (_id ? _id.toString() : `job-${Date.now()}`),
    tags: Array.isArray(job.tags)
      ? job.tags
      : typeof job.tags === 'string'
        ? job.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [],
    requirements: Array.isArray(job.requirements)
      ? job.requirements
      : typeof job.requirements === 'string'
        ? job.requirements.split('\n').map((r: string) => r.trim()).filter(Boolean)
        : [],
    benefits: Array.isArray(job.benefits)
      ? job.benefits
      : typeof job.benefits === 'string'
        ? job.benefits.split('\n').map((b: string) => b.trim()).filter(Boolean)
        : [],
    applicationsCount: typeof job.applicationsCount === 'number' ? job.applicationsCount : 0,
    status: job.status || 'Approved'
  };
}
