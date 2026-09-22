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
 * Safe logging helper for MongoDB connection events.
 * Does NOT forcibly close active MongoClient instances during server execution,
 * allowing the official driver's automatic reconnection and socket-pool recovery to function.
 */
export function resetMongoClient(err?: any): void {
  if (err) {
    console.warn(`[MongoDB] Connection notice: ${err?.message || err}`);
  }
}

/**
 * Safely executes a MongoDB promise with an enforced timeout to prevent network stalls.
 * Does not destroy or close the shared connection pool if an individual query exceeds timeout.
 */
export async function withMongoTimeout<T>(promise: Promise<T>, timeoutMs = 15000, label = 'Operation'): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const timeoutErr = new Error(`MongoDB ${label} timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'MongoNetworkTimeoutError';
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  if (!clientPromise) {
    const uri = getMongoUri();
    const client = new MongoClient(uri, {
      maxPoolSize: 50,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true
    });

    clientPromise = client.connect().then((connectedClient) => {
      cachedClient = connectedClient;
      cachedDb = connectedClient.db();
      console.log(`[MongoDB] Connected successfully to database "${cachedDb.databaseName}"`);
      // Initialize indexes in background without delaying queries
      initMongoIndexes(cachedDb).catch((err) => {
        console.warn('[MongoDB] Background index setup note:', err?.message || err);
      });
      return connectedClient;
    }).catch((err) => {
      clientPromise = null;
      console.error('[MongoDB] Initial connection error:', err?.message || err);
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

    await jobsColl.createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { slug: 1 } },
      { key: { status: 1, createdAt: -1 } },
      { key: { company: 1 } },
      { key: { region: 1 } },
      { key: { city: 1 } },
      { key: { jobType: 1 } }
    ]).catch(e => console.warn('[MongoDB] Jobs indexes setup note:', e.message));

    await pendingColl.createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { status: 1, createdAt: -1 } },
      { key: { createdAt: -1 } }
    ]).catch(e => console.warn('[MongoDB] Pending jobs indexes setup note:', e.message));

    await scraperSourcesColl.createIndex({ id: 1 }, { unique: true })
      .catch(e => console.warn('[MongoDB] Scraper sources index note:', e.message));

    await scraperRunsColl.createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { startedAt: -1 } }
    ]).catch(e => console.warn('[MongoDB] Scraper runs indexes note:', e.message));

    await scraperGroupsColl.createIndex({ id: 1 }, { unique: true })
      .catch(e => console.warn('[MongoDB] Scraper groups index note:', e.message));

    console.log('[MongoDB] Collections indexes ensured.');
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
