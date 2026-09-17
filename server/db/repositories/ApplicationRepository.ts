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
      try {
        const coll = await getApplicationsCollection();
        const query: any = {};
        if (filter.jobId) query.jobId = filter.jobId;
        if (filter.applicantId) query.applicantId = filter.applicantId;

        const apps = await coll.find(query).sort({ appliedAt: -1 }).toArray();
        if (apps && apps.length > 0) {
          return apps.map(doc => {
            const { _id, ...safe } = doc;
            return safe;
          });
        }
      } catch (err: any) {
        console.warn('[MongoDB] getAllAsync applications fallback:', err.message);
      }
    }
    return this.getAll(filter);
  }

  static getById(id: string): any | null {
    const apps = Database.getApplications();
    return apps.find(a => a.id === id) || null;
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (isMongoConfigured()) {
      try {
        const coll = await getApplicationsCollection();
        const app = await coll.findOne({ id });
        if (app) {
          const { _id, ...safe } = app;
          return safe;
        }
      } catch (err: any) {
        console.warn('[MongoDB] getByIdAsync application fallback:', err.message);
      }
    }
    return this.getById(id);
  }

  static create(data: any): any {
    const newApp = Database.addApplication(data);
    this.syncMongoApp(newApp);
    return newApp;
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

