import { JobVisibilityRepository, JobSourceType } from '../db/repositories/JobVisibilityRepository';

export interface EarlyAccessConfig {
  enabled?: boolean;
  sourceTypes?: JobSourceType[];
  durationHours?: number;
  showOnLanding?: boolean;
  showJobCount?: boolean;
  showCountdown?: boolean;
  maxJobs?: number;
  heading?: string;
  description?: string;
  displayFields?: string[];
  showSource?: boolean;
  jobOverrides?: Array<{ jobId: string; enabled?: boolean; displayTitle?: string }>;
}

const ALLOWED_DISPLAY_FIELDS = new Set([
  'title', 'company', 'department', 'city', 'province', 'jobType',
  'deadlineDate', 'salary', 'totalVacancies', 'experienceLevel', 'jobCategory'
]);

export function isEarlyAccessJobLocked(
  job: any,
  config: EarlyAccessConfig | undefined,
  now: number = Date.now()
): boolean {
  if (!job || config?.enabled !== true) return false;

  const jobOverride = Array.isArray(config.jobOverrides) ? config.jobOverrides.find((item) => item && item.jobId === String(job.id || '')) : undefined;
  if (jobOverride?.enabled === false) return false;

  const source: JobSourceType = JobVisibilityRepository.deriveJobSource(job);
  const selectedSources = Array.isArray(config.sourceTypes) ? config.sourceTypes : [];
  if (!selectedSources.includes(source)) return false;

  const durationHours = Number(config.durationHours);
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 8760) {
    // Invalid persisted policy must fail closed for selected sources.
    return true;
  }

  const rawStart = job.approvedAt || job.verifiedDate || job.publishedAt || job.createdAt || job.postedAt || job.datePosted;
  const start = rawStart ? new Date(rawStart).getTime() : Number.NaN;
  if (!Number.isFinite(start)) return true;

  return now < start + durationHours * 60 * 60 * 1000;
}

export function buildEarlyAccessDisplayJob(job: any, config: EarlyAccessConfig): Record<string, any> {
  const fields = Array.isArray(config.displayFields)
    ? config.displayFields.filter((field) => ALLOWED_DISPLAY_FIELDS.has(field))
    : ['title', 'company', 'department', 'city', 'deadlineDate'];

  const jobOverride = Array.isArray(config.jobOverrides) ? config.jobOverrides.find((item) => item && item.jobId === String(job.id || '')) : undefined;
  const display: Record<string, any> = { id: String(job.id || '') };
  for (const field of fields) {
    const value = job[field];
    if (value !== undefined && value !== null && value !== '') display[field] = field === 'title' && jobOverride?.displayTitle ? jobOverride.displayTitle : value;
  }

  if (config.showSource === true) {
    display.sourceType = JobVisibilityRepository.deriveJobSource(job);
    display.sourceLabel = String(job.scraperSourceName || job.sourcePortal || job.sourceWebsite || display.sourceType);
  }

  const rawStart = job.approvedAt || job.publishedAt || job.createdAt || job.postedAt || job.datePosted;
  const start = rawStart ? new Date(rawStart).getTime() : Number.NaN;
  const durationHours = Math.min(8760, Math.max(1, Number(config.durationHours) || 24));
  display.earlyAccessEndsAt = Number.isFinite(start) ? new Date(start + durationHours * 60 * 60 * 1000).toISOString() : null;
  return display;
}

export function getEarlyAccessLandingConfig(config: EarlyAccessConfig): Record<string, any> {
  return {
    enabled: config.enabled === true,
    showOnLanding: config.showOnLanding !== false,
    showJobCount: config.showJobCount !== false,
    showCountdown: config.showCountdown !== false,
    maxJobs: Math.min(100, Math.max(1, Number(config.maxJobs) || 10)),
    heading: typeof config.heading === 'string' ? config.heading.slice(0, 100) : 'Premium Early Access',
    description: typeof config.description === 'string' ? config.description.slice(0, 300) : '',
    durationHours: Math.min(8760, Math.max(1, Number(config.durationHours) || 24))
  };
}
