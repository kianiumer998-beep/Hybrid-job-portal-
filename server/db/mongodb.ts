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

export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  if (!clientPromise) {
    const uri = getMongoUri();
    const client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    clientPromise = client.connect().then(async (connectedClient) => {
      cachedClient = connectedClient;
      cachedDb = connectedClient.db();
      console.log(`[MongoDB] Connected successfully to database "${cachedDb.databaseName}"`);
      await initMongoIndexes(cachedDb);
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

let indexesInitialized = false;
async function initMongoIndexes(db: Db): Promise<void> {
  if (indexesInitialized) return;
  try {
    const jobsColl = db.collection('jobs');
    const pendingColl = db.collection('pending_jobs');
    const scraperSourcesColl = db.collection('scraper_sources');
    const scraperRunsColl = db.collection('scraper_runs');

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
      scraperRunsColl.createIndex({ startedAt: -1 }, { background: true })
    ]);
    indexesInitialized = true;
    console.log('[MongoDB] Jobs, pending_jobs, scraper_sources, and scraper_runs indexes ensured.');
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
