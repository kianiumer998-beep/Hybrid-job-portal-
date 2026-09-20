import { MongoClient, Db, Collection } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let reconnectPromise: Promise<MongoClient> | null = null;
let lastReconnectTimestamp = 0;

export function isTransientMongoError(err: any): boolean {
  if (!err) return false;
  const errMsg = String(err.message || err || '').toLowerCase();
  const errName = String(err.name || '').toLowerCase();
  const errCode = String(err.code || err.codeName || '').toLowerCase();
  const causeMsg = err.cause ? String(err.cause.message || err.cause.name || err.cause || '').toLowerCase() : '';

  return (
    errName.includes('mongoclientclosederror') ||
    errName.includes('mongonetworktimeouterror') ||
    errName.includes('mongoserverselectionerror') ||
    errName.includes('mongonetworkerror') ||
    errName.includes('mongotimeouterror') ||
    errName.includes('mongopoolclearederror') ||
    errName.includes('mongopoolclosederror') ||
    errName.includes('mongowaitqueuetimeouterror') ||
    errName.includes('mongonotconnectederror') ||
    errName.includes('mongotopologyclosederror') ||
    errName.includes('poolclearedonnetworkerror') ||
    errCode.includes('poolclearedonnetworkerror') ||
    errCode.includes('econnreset') ||
    errCode.includes('econnrefused') ||
    errCode.includes('etimedout') ||
    errCode.includes('epipe') ||
    errMsg.includes('mongoclientclosederror') ||
    errMsg.includes('operation interrupted because client was closed') ||
    errMsg.includes('client was closed') ||
    errMsg.includes('poolclearedonnetworkerror') ||
    errMsg.includes('pool cleared') ||
    errMsg.includes('connection pool') ||
    errMsg.includes('pool is closed') ||
    errMsg.includes('timeout') ||
    errMsg.includes('timed out') ||
    errMsg.includes('connection timed out') ||
    errMsg.includes('sockettimeout') ||
    errMsg.includes('serverselectiontimeout') ||
    errMsg.includes('monitor timeout') ||
    errMsg.includes('heartbeat timeout') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('etimedout') ||
    errMsg.includes('epipe') ||
    errMsg.includes('network error') ||
    errMsg.includes('connection closed') ||
    errMsg.includes('connection reset') ||
    errMsg.includes('topology was destroyed') ||
    errMsg.includes('topology is closed') ||
    errMsg.includes('client must be connected') ||
    causeMsg.includes('mongoclientclosederror') ||
    causeMsg.includes('client was closed') ||
    causeMsg.includes('poolclearedonnetworkerror') ||
    causeMsg.includes('pool cleared') ||
    causeMsg.includes('mongonetworktimeouterror') ||
    causeMsg.includes('mongonetworkerror') ||
    causeMsg.includes('mongoserverselectionerror') ||
    causeMsg.includes('timeout')
  );
}

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

async function createFreshMongoClient(): Promise<MongoClient> {
  const uri = getMongoUri();
  const client = new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  const connectedClient = await client.connect();
  const db = connectedClient.db();
  await db.command({ ping: 1 });
  await initMongoIndexes(db);

  cachedClient = connectedClient;
  cachedDb = db;
  console.log(`[MongoDB] Connected successfully to database "${cachedDb.databaseName}"`);
  return connectedClient;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (reconnectPromise) {
    return reconnectPromise;
  }

  if (cachedClient) {
    return cachedClient;
  }

  if (!clientPromise) {
    clientPromise = createFreshMongoClient().catch((err) => {
      clientPromise = null;
      cachedClient = null;
      cachedDb = null;
      console.error('[MongoDB] Connection error:', err.message);
      throw err;
    });
  }

  return clientPromise;
}

/**
 * Safe, centralized recovery mechanism for MongoClient on genuine network/pool failures.
 * Atomically detaches broken cached client/db and establishes a fresh connection.
 * Concurrent recovery calls share ONE in-flight recovery promise.
 * NEVER force-closes old client with close(true) so active checked-out connections are not interrupted.
 */
export async function recoverMongoClient(reason?: any): Promise<MongoClient> {
  if (reconnectPromise) {
    return reconnectPromise;
  }

  const reasonMsg = reason?.message || String(reason || 'transient network/pool failure');
  console.warn(`[MongoDB] Centralized MongoClient recovery initiated. Reason: ${reasonMsg}`);

  // Atomically detach broken client, cached db, and connection promise
  const oldClient = cachedClient;
  cachedClient = null;
  cachedDb = null;
  clientPromise = null;

  // Safe deferred cleanup: NEVER force-close with close(true) which interrupts active operations.
  // Allow checked-out connections to complete naturally, then close gracefully.
  if (oldClient) {
    const timer = setTimeout(() => {
      try {
        oldClient.close(false).catch((closeErr: any) => {
          console.warn('[MongoDB] Notice closing previous client during deferred cleanup:', closeErr?.message || closeErr);
        });
      } catch {
        // Ignore synchronous close errors
      }
    }, 15000);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  reconnectPromise = (async () => {
    try {
      const connectedClient = await createFreshMongoClient();
      clientPromise = Promise.resolve(connectedClient);
      lastReconnectTimestamp = Date.now();
      console.log(`[MongoDB] Centralized MongoClient recovery succeeded. Database: "${cachedDb?.databaseName || 'default'}"`);
      return connectedClient;
    } catch (err: any) {
      cachedClient = null;
      cachedDb = null;
      clientPromise = null;
      console.error('[MongoDB] Centralized MongoClient recovery failed:', err?.message || err);
      throw err;
    } finally {
      reconnectPromise = null;
    }
  })();

  return reconnectPromise;
}

export async function resetMongoClient(reason?: any): Promise<MongoClient> {
  return recoverMongoClient(reason);
}

export async function getMongoDb(): Promise<Db> {
  if (cachedDb && cachedClient && !reconnectPromise) {
    return cachedDb;
  }
  const client = await getMongoClient();
  cachedDb = client.db();
  return cachedDb;
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

    await Promise.all([
      jobsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      jobsColl.createIndex({ slug: 1 }, { background: true }),
      jobsColl.createIndex({ status: 1, createdAt: -1 }, { background: true }),
      jobsColl.createIndex({ company: 1 }, { background: true }),
      jobsColl.createIndex({ region: 1 }, { background: true }),
      jobsColl.createIndex({ city: 1 }, { background: true }),
      jobsColl.createIndex({ jobType: 1 }, { background: true }),
      pendingColl.createIndex({ id: 1 }, { unique: true, background: true }),
      pendingColl.createIndex({ status: 1, createdAt: -1 }, { background: true }),
      scraperSourcesColl.createIndex({ id: 1 }, { unique: true, background: true }),
      scraperRunsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      scraperRunsColl.createIndex({ startedAt: -1 }, { background: true }),
      scraperGroupsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      settingsColl.createIndex({ key: 1 }, { unique: true, background: true }),
      notifsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      notifsColl.createIndex({ status: 1, enabled: 1, createdAt: -1 }, { background: true }),
      userNotifsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      userNotifsColl.createIndex({ userId: 1, notificationId: 1 }, { background: true }),
      txColl.createIndex({ id: 1 }, { unique: true, background: true }),
      txColl.createIndex({ transactionId: 1 }, { background: true }),
      txColl.createIndex({ userId: 1, createdAt: -1 }, { background: true }),
      txColl.createIndex({ idempotencyKey: 1 }, { sparse: true, background: true }),
      userColl.createIndex({ id: 1 }, { unique: true, background: true }),
      userColl.createIndex({ email: 1 }, { unique: true, background: true }),
      appColl.createIndex({ id: 1 }, { unique: true, background: true }),
      appColl.createIndex({ jobId: 1, applicantId: 1 }, { background: true }),
      adsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      casesColl.createIndex({ id: 1 }, { unique: true, background: true }),
      casesColl.createIndex({ caseNumber: 1 }, { unique: true, background: true }),
      ticketsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      savedJobsColl.createIndex({ userId: 1, jobId: 1 }, { unique: true, background: true }),
      auditColl.createIndex({ id: 1 }, { unique: true, background: true }),
      db.collection('scraper_locks').createIndex({ id: 1 }, { unique: true, background: true })
    ]);
    indexesInitialized = true;
    console.log('[MongoDB] All production system collections and indexes ensured.');
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
  
  const isScrapedOrigin = Boolean(
    job.isPdfScraped === true ||
    job.isScraped === true ||
    job.scraperSourceId ||
    job.scraperSourceName ||
    job.scrapedSourceDomain ||
    job.sourcePortal ||
    job.scrapeRunId ||
    job.scrapedAt ||
    job.sourceJobId ||
    job.pdfSourceUrl ||
    job.pdfFileName ||
    (typeof job.id === 'string' && /^(scraped|gh|lever|sr|ashby|ld|html|doc|ocr|pdf|next)-/i.test(job.id))
  );

  const derivedSourceType = isScrapedOrigin
    ? 'scraped'
    : (job.sourceType && ['user_posted', 'admin_created', 'imported', 'unknown'].includes(job.sourceType))
      ? job.sourceType
      : (job.submittedByUserId && String(job.submittedByUserId).trim())
        ? 'user_posted'
        : (job.createdByAdmin === true || job.postedByAdmin === true)
          ? 'admin_created'
          : (job.isImported === true || (typeof job.id === 'string' && job.id.startsWith('import-')))
            ? 'imported'
            : 'unknown';

  return {
    ...job,
    id: job.id || (_id ? _id.toString() : `job-${Date.now()}`),
    sourceType: derivedSourceType,
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
