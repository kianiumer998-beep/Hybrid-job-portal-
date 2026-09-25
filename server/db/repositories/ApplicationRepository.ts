import { Database } from '../database';
import { getMongoDb, isMongoConfigured } from '../mongodb';

export interface ApplicationFilter {
  jobId?: string;
  applicantId?: string;
  applicantEmail?: string;
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
    if (filter.applicantEmail) {
      const emailLower = filter.applicantEmail.toLowerCase().trim();
      apps = apps.filter(a => a.applicantEmail && a.applicantEmail.toLowerCase().trim() === emailLower);
    }
    return apps;
  }

  /**
   * Asynchronously retrieves applications.
   * When MongoDB is configured, queries the authoritative "applications" collection.
   * If MongoDB fails, it throws the real error to prevent serving stale local fallback data.
   */
  static async getAllAsync(filter: ApplicationFilter = {}): Promise<any[]> {
    if (isMongoConfigured()) {
      const db = await getMongoDb();
      const coll = db.collection('applications');
      const query: any = {};
      if (filter.jobId) query.jobId = filter.jobId;
      if (filter.applicantId) query.applicantId = filter.applicantId;
      if (filter.applicantEmail) {
        const emailEscaped = filter.applicantEmail.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.applicantEmail = { $regex: new RegExp(`^${emailEscaped}$`, 'i') };
      }

      const docs = await coll.find(query).sort({ appliedAt: -1, createdAt: -1 }).toArray();
      return (docs || []).map(doc => {
        const { _id, ...safe } = doc;
        return safe;
      });
    }
    return ApplicationRepository.getAll(filter);
  }

  /**
   * Finds an existing application for duplicate prevention.
   * Scoped to (jobId + applicantId) for logged-in users, or (jobId + applicantEmail) for guests.
   */
  static async findExistingAsync(jobId: string, applicantId?: string, applicantEmail?: string): Promise<any | null> {
    if (!jobId) return null;
    const normalizedEmail = applicantEmail ? applicantEmail.trim().toLowerCase() : undefined;
    const isGuest = !applicantId || applicantId === 'guest';

    if (isMongoConfigured()) {
      const db = await getMongoDb();
      const coll = db.collection('applications');
      let query: any;
      if (!isGuest) {
        query = { jobId, applicantId };
      } else if (normalizedEmail) {
        const emailEscaped = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query = { jobId, applicantEmail: { $regex: new RegExp(`^${emailEscaped}$`, 'i') } };
      } else {
        return null;
      }

      const existing = await coll.findOne(query);
      if (existing) {
        const { _id, ...safe } = existing;
        return safe;
      }
      return null;
    }

    const apps = Database.getApplications();
    return apps.find(a => {
      if (a.jobId !== jobId) return false;
      if (!isGuest && a.applicantId === applicantId) return true;
      if (normalizedEmail && a.applicantEmail && a.applicantEmail.trim().toLowerCase() === normalizedEmail) return true;
      return false;
    }) || null;
  }

  /**
   * Synchronous fallback to get single application by ID (local development only).
   */
  static getById(id: string): any | null {
    const apps = Database.getApplications();
    return apps.find(a => a.id === id) || null;
  }

  /**
   * Asynchronously retrieves a single application by ID.
   * When MongoDB is configured, reads directly from "applications" collection.
   * If MongoDB fails, it throws the real error to prevent serving stale local fallback data.
   */
  static async getByIdAsync(id: string): Promise<any | null> {
    if (!id) return null;
    if (isMongoConfigured()) {
      const db = await getMongoDb();
      const coll = db.collection('applications');
      const doc = await coll.findOne({ id });
      if (doc) {
        const { _id, ...safe } = doc;
        return safe;
      }
      return null;
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
