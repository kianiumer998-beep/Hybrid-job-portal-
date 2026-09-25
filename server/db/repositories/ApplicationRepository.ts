import { Database } from '../database';
import { getMongoDb, isMongoConfigured } from '../mongodb';

export interface ApplicationFilter {
  jobId?: string;
  applicantId?: string;
}

export class ApplicationRepository {
  /**
   * Synchronous fallback for local development or non-async callers.
   */
  static getAll(filter: ApplicationFilter = {}): any[] {
    let apps = Database.getApplications();
    if (filter.jobId) {
      apps = apps.filter(a => a.jobId === filter.jobId);
    }
    if (filter.applicantId) {
      apps = apps.filter(a => a.applicantId === filter.applicantId);
    }
    return apps;
  }

  /**
   * Asynchronously retrieves applications.
   * When MongoDB is configured, queries the authoritative "applications" collection.
   */
  static async getAllAsync(filter: ApplicationFilter = {}): Promise<any[]> {
    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        const coll = db.collection('applications');
        const query: any = {};
        if (filter.jobId) query.jobId = filter.jobId;
        if (filter.applicantId) query.applicantId = filter.applicantId;

        const docs = await coll.find(query).sort({ appliedAt: -1, createdAt: -1 }).toArray();
        return (docs || []).map(doc => {
          const { _id, ...safe } = doc;
          return safe;
        });
      } catch (err) {
        // Fallback to local database cache on genuine query/connection error
        return ApplicationRepository.getAll(filter);
      }
    }
    return ApplicationRepository.getAll(filter);
  }

  /**
   * Synchronous fallback to get single application by ID.
   */
  static getById(id: string): any | null {
    const apps = Database.getApplications();
    return apps.find(a => a.id === id) || null;
  }

  /**
   * Asynchronously retrieves a single application by ID.
   * When MongoDB is configured, reads directly from "applications" collection.
   */
  static async getByIdAsync(id: string): Promise<any | null> {
    if (!id) return null;
    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        const coll = db.collection('applications');
        const doc = await coll.findOne({ id });
        if (doc) {
          const { _id, ...safe } = doc;
          return safe;
        }
        return null;
      } catch (err) {
        return ApplicationRepository.getById(id);
      }
    }
    return ApplicationRepository.getById(id);
  }

  /**
   * Asynchronously persists a new job application.
   * When MongoDB is configured, writes strictly to MongoDB and throws on error (no silent false success).
   */
  static async createAsync(data: any): Promise<any> {
    const id = data.id || `app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const appToSave = {
      ...data,
      id,
      appliedAt: data.appliedAt || data.createdAt || now,
      createdAt: data.createdAt || data.appliedAt || now,
      updatedAt: data.updatedAt || now,
      status: data.status || 'Applied'
    };

    if (isMongoConfigured()) {
      const db = await getMongoDb();
      const coll = db.collection('applications');
      await coll.insertOne({ ...appToSave });
      return appToSave;
    }

    return Database.addApplication(appToSave);
  }

  /**
   * Synchronous create fallback.
   */
  static create(data: any): any {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous create is prohibited to ensure authoritative persistence; use createAsync.');
    }
    return Database.addApplication(data);
  }

  /**
   * Asynchronously updates the status and admin notes of an application in MongoDB.
   */
  static async updateStatusAsync(id: string, status: string, notes?: string): Promise<any | null> {
    const now = new Date().toISOString();
    const updatePayload: any = {
      status,
      updatedAt: now
    };
    if (notes !== undefined) {
      updatePayload.adminNotes = notes;
    }

    if (isMongoConfigured()) {
      const db = await getMongoDb();
      const coll = db.collection('applications');
      const updatedDoc = await coll.findOneAndUpdate(
        { id },
        { $set: updatePayload },
        { returnDocument: 'after' }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      return null;
    }

    return ApplicationRepository.updateStatus(id, status, notes);
  }

  /**
   * Synchronous updateStatus fallback.
   */
  static updateStatus(id: string, status: string, notes?: string): any | null {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous updateStatus is prohibited to ensure authoritative persistence; use updateStatusAsync.');
    }
    const apps = Database.getApplications();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return null;

    apps[idx].status = status;
    if (notes !== undefined) apps[idx].adminNotes = notes;
    apps[idx].updatedAt = new Date().toISOString();
    Database.saveApplications(apps);
    return apps[idx];
  }
}
