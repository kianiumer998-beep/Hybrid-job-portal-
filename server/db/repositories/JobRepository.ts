import { Database, generateJobSlug } from '../database';

export interface JobFilterOptions {
  search?: string;
  jobType?: string;
  region?: string;
  province?: string;
  city?: string;
  experienceLevel?: string;
  salaryMin?: number;
  sortBy?: string;
  isGovt?: boolean;
  isUrgent?: boolean;
  isFeatured?: boolean;
  page?: number;
  limit?: number;
}

export class JobRepository {
  static getAll(filter: JobFilterOptions = {}): { jobs: any[]; total: number; page: number; limit: number } {
    let jobs = Database.getJobs().filter(j => j.status === 'Approved' || (!j.status && !j.isSuspended));

    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      jobs = jobs.filter(j =>
        (j.title && j.title.toLowerCase().includes(q)) ||
        (j.company && j.company.toLowerCase().includes(q)) ||
        (j.department && j.department.toLowerCase().includes(q)) ||
        (j.description && j.description.toLowerCase().includes(q)) ||
        (j.tags && j.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }

    if (filter.jobType && filter.jobType !== 'All') {
      jobs = jobs.filter(j => j.jobType === filter.jobType);
    }

    if (filter.region && filter.region !== 'All') {
      jobs = jobs.filter(j => j.region === filter.region);
    }

    if (filter.province && filter.province !== 'All') {
      jobs = jobs.filter(j => j.province === filter.province);
    }

    if (filter.city && filter.city !== 'All') {
      jobs = jobs.filter(j => j.city === filter.city);
    }

    if (filter.experienceLevel && filter.experienceLevel !== 'All') {
      jobs = jobs.filter(j => j.experienceLevel === filter.experienceLevel);
    }

    if (filter.salaryMin && filter.salaryMin > 0) {
      jobs = jobs.filter(j => (j.salaryNumericMin || 0) >= filter.salaryMin!);
    }

    if (filter.isGovt) {
      jobs = jobs.filter(j => j.isGovtJob);
    }

    if (filter.isUrgent) {
      jobs = jobs.filter(j => j.urgent);
    }

    if (filter.isFeatured) {
      jobs = jobs.filter(j => j.featured || j.isPinnedTop);
    }

    if (filter.sortBy === 'salary-high') {
      jobs.sort((a, b) => (b.salaryNumericMin || 0) - (a.salaryNumericMin || 0));
    } else if (filter.sortBy === 'salary-low') {
      jobs.sort((a, b) => (a.salaryNumericMin || 0) - (b.salaryNumericMin || 0));
    } else if (filter.sortBy === 'popular') {
      jobs.sort((a, b) => (b.applicationsCount || 0) - (a.applicationsCount || 0));
    } else {
      jobs.sort((a, b) => {
        if (a.isPinnedTop && !b.isPinnedTop) return -1;
        if (!a.isPinnedTop && b.isPinnedTop) return 1;
        return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
      });
    }

    const total = jobs.length;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 50));
    const paginated = jobs.slice((page - 1) * limit, page * limit);

    return { jobs: paginated, total, page, limit };
  }

  static getById(id: string): any | null {
    return Database.getJobById(id);
  }

  static getBySlug(slug: string): any | null {
    return Database.getJobBySlug(slug);
  }

  static create(jobData: any): any {
    return Database.addJob(jobData);
  }

  static update(id: string, updates: any): any | null {
    return Database.updateJob(id, updates);
  }

  static delete(id: string): boolean {
    return Database.deleteJob(id);
  }

  static getPending(): any[] {
    return Database.getPendingJobs();
  }

  static addPending(jobData: any): any {
    return Database.addPendingJob(jobData);
  }

  static approvePending(id: string): any | null {
    return Database.approvePendingJob(id);
  }

  static rejectPending(id: string, reason?: string): boolean {
    return Database.rejectPendingJob(id, reason);
  }
}
