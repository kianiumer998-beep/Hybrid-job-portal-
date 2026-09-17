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
 * Resets the cached Mongo client and connection pool.
 * Called automatically when network timeouts, broken sockets, or connection drops occur.
 */
export function resetMongoClient(err?: any): void {
  if (err) {
    console.warn(`[MongoDB] Resetting connection pool due to network issue: ${err?.message || err}`);
  }
  if (cachedClient) {
    try {
      cachedClient.close(true).catch(() => {});
    } catch {}
  }
  cachedClient = null;
  cachedDb = null;
  clientPromise = null;
}

/**
 * Safely executes a MongoDB promise with an enforced timeout to prevent network stalls.
 */
export async function withMongoTimeout<T>(promise: Promise<T>, timeoutMs = 12000, label = 'Operation'): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const timeoutErr = new Error(`MongoDB ${label} timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'MongoNetworkTimeoutError';
      resetMongoClient(timeoutErr);
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } catch (err: any) {
    if (err?.name === 'MongoNetworkTimeoutError' || err?.name === 'MongoNetworkError' || err?.message?.includes('timed out')) {
      resetMongoClient(err);
    }
    throw err;
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
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 15000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 12000,
      retryWrites: true,
      retryReads: true
    });

    clientPromise = client.connect().then(async (connectedClient) => {
      cachedClient = connectedClient;
      cachedDb = connectedClient.db();
      console.log(`[MongoDB] Connected successfully to database "${cachedDb.databaseName}"`);
      await initMongoIndexes(cachedDb);
      return connectedClient;
    }).catch((err) => {
      resetMongoClient(err);
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
  try {
    const jobsColl = db.collection('jobs');
    const pendingColl = db.collection('pending_jobs');
    const scraperSourcesColl = db.collection('scraper_sources');
    const scraperRunsColl = db.collection('scraper_runs');
    const scraperGroupsColl = db.collection('scraper_groups');

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
      pendingColl.createIndex({ createdAt: -1 }, { background: true }),
      pendingColl.createIndex({ status: 1 }, { background: true }),
      scraperSourcesColl.createIndex({ id: 1 }, { unique: true, background: true }),
      scraperRunsColl.createIndex({ id: 1 }, { unique: true, background: true }),
      scraperRunsColl.createIndex({ startedAt: -1 }, { background: true }),
      scraperGroupsColl.createIndex({ id: 1 }, { unique: true, background: true })
    ]);
    indexesInitialized = true;
    console.log('[MongoDB] Jobs, pending_jobs, scraper_sources, scraper_runs, and scraper_groups indexes ensured.');
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
