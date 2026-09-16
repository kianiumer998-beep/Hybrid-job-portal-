import { Database } from '../database';
import { getApplicationsCollection, isMongoConfigured } from '../mongodb';

export interface ApplicationFilter {
  jobId?: string;
  applicantId?: string;
}

export class ApplicationRepository {
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

  static async getAllAsync(filter: ApplicationFilter = {}): Promise<any[]> {
    if (isMongoConfigured()) {
      const coll = await getApplicationsCollection();
      const query: any = {};
      if (filter.jobId) query.jobId = filter.jobId;
      if (filter.applicantId) query.applicantId = filter.applicantId;

      const apps = await coll.find(query).sort({ appliedAt: -1 }).toArray();
      return (apps || []).map(doc => {
        const { _id, ...safe } = doc;
        return safe;
      });
    }
    return this.getAll(filter);
  }

  static getById(id: string): any | null {
    const apps = Database.getApplications();
    return apps.find(a => a.id === id) || null;
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (isMongoConfigured()) {
      const coll = await getApplicationsCollection();
      const app = await coll.findOne({ id });
      if (!app) return null;
      const { _id, ...safe } = app;
      return safe;
    }
    return this.getById(id);
  }

  static async createAsync(data: any): Promise<any> {
    const id = data.id || `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const appToSave = {
      ...data,
      id,
      status: data.status || 'applied',
      appliedAt: data.appliedAt || now,
      updatedAt: data.updatedAt || now
    };

    if (isMongoConfigured()) {
      const coll = await getApplicationsCollection();
      await coll.insertOne({ ...appToSave });
      try {
        Database.addApplication(appToSave);
      } catch {}
      return appToSave;
    }

    return Database.addApplication(appToSave);
  }

  static create(data: any): any {
    const newApp = Database.addApplication(data);
    this.syncMongoApp(newApp);
    return newApp;
  }

  static async updateStatusAsync(id: string, status: string, notes?: string): Promise<any | null> {
    const now = new Date().toISOString();
    const updateFields: any = { status, updatedAt: now };
    if (notes) updateFields.adminNotes = notes;

    if (isMongoConfigured()) {
      const coll = await getApplicationsCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id },
        { $set: updateFields },
        { returnDocument: 'after' }
      );
      if (!updatedDoc) return null;
      const { _id, ...safe } = updatedDoc;
      try {
        const apps = Database.getApplications();
        const idx = apps.findIndex(a => a.id === id);
        if (idx !== -1) {
          apps[idx] = safe;
          Database.saveApplications(apps);
        }
      } catch {}
      return safe;
    }

    return this.updateStatus(id, status, notes);
  }

  static updateStatus(id: string, status: string, notes?: string): any | null {
    const apps = Database.getApplications();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return null;

    apps[idx].status = status;
    if (notes) apps[idx].adminNotes = notes;
    apps[idx].updatedAt = new Date().toISOString();
    Database.saveApplications(apps);
    this.syncMongoApp(apps[idx]);
    return apps[idx];
  }

  private static syncMongoApp(app: any): void {
    if (!isMongoConfigured() || !app?.id) return;
    getApplicationsCollection()
      .then(coll => {
        coll.updateOne(
          { id: app.id },
          { $set: app },
          { upsert: true }
        ).catch(err => console.warn('[MongoDB] Sync application notice:', err.message));
      })
      .catch(() => {});
  }
}
