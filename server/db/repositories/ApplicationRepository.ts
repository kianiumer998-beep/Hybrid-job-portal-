import { Database } from '../database';

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

  static getById(id: string): any | null {
    const apps = Database.getApplications();
    return apps.find(a => a.id === id) || null;
  }

  static create(data: any): any {
    return Database.addApplication(data);
  }

  static updateStatus(id: string, status: string, notes?: string): any | null {
    const apps = Database.getApplications();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return null;

    apps[idx].status = status;
    if (notes) apps[idx].adminNotes = notes;
    apps[idx].updatedAt = new Date().toISOString();
    Database.saveApplications(apps);
    return apps[idx];
  }
}
