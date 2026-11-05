import { FieldVisibility } from '../types/job';

export interface RegistryFieldDef {
  key: string;
  label: string;
  category: 'Sensitive' | 'Standard';
}

export const SENSITIVE_FIELD_KEYS = new Set([
  'applicationUrl',
  'contactEmail',
  'contactEmailOrPhone',
  'attachments',
  'externalApplyUrl',
  'sourceUrl',
  'pdfSourceUrl',
  'mediaUrl',
  'salary',
  'pdfFileName',
  'pdfCaseNumber',
  'pdfTotalVacanciesInCase',
  'relatedSourceUrls'
]);

export const ALL_REGISTRY_FIELDS: RegistryFieldDef[] = [
  // Public Standard Fields
  { key: 'title', label: 'Job Title', category: 'Standard' },
  { key: 'company', label: 'Company Name', category: 'Standard' },
  { key: 'companyLogo', label: 'Company Logo', category: 'Standard' },
  { key: 'jobType', label: 'Job Type', category: 'Standard' },
  { key: 'region', label: 'Region', category: 'Standard' },
  { key: 'country', label: 'Country', category: 'Standard' },
  { key: 'province', label: 'Province', category: 'Standard' },
  { key: 'city', label: 'City', category: 'Standard' },
  { key: 'district', label: 'District', category: 'Standard' },
  { key: 'salaryNumericMin', label: 'Numeric Min Salary', category: 'Standard' },
  { key: 'currency', label: 'Currency', category: 'Standard' },
  { key: 'experienceLevel', label: 'Experience Level', category: 'Standard' },
  { key: 'department', label: 'Department', category: 'Standard' },
  { key: 'tags', label: 'Tags', category: 'Standard' },
  { key: 'description', label: 'Description', category: 'Standard' },
  { key: 'requirements', label: 'Requirements', category: 'Standard' },
  { key: 'responsibilities', label: 'Responsibilities', category: 'Standard' },
  { key: 'responsibilitiesList', label: 'Responsibilities List', category: 'Standard' },
  { key: 'benefits', label: 'Benefits', category: 'Standard' },
  { key: 'postedAt', label: 'Posted At', category: 'Standard' },
  { key: 'featured', label: 'Featured Status', category: 'Standard' },
  { key: 'urgent', label: 'Urgent Status', category: 'Standard' },
  { key: 'isPinnedTop', label: 'Pinned Top', category: 'Standard' },
  { key: 'isFutureJob', label: 'Future Job', category: 'Standard' },
  { key: 'futureIntakeDate', label: 'Future Intake Date', category: 'Standard' },
  { key: 'priorityTier', label: 'Priority Tier', category: 'Standard' },
  { key: 'applicationsCount', label: 'Applications Count', category: 'Standard' },
  { key: 'status', label: 'Job Status', category: 'Standard' },
  { key: 'jobCategory', label: 'Job Category', category: 'Standard' },
  { key: 'isGovtJob', label: 'Govt Job', category: 'Standard' },
  { key: 'govtDepartment', label: 'Govt Department', category: 'Standard' },
  { key: 'govtScale', label: 'Govt Scale', category: 'Standard' },
  { key: 'govtCategory', label: 'Govt Category', category: 'Standard' },
  { key: 'isNewspaperAd', label: 'Newspaper Ad', category: 'Standard' },
  { key: 'newspaperName', label: 'Newspaper', category: 'Standard' },
  { key: 'clippingImageUrl', label: 'Clipping Image', category: 'Standard' },
  { key: 'newspaperDate', label: 'Newspaper Date', category: 'Standard' },
  { key: 'deadlineDate', label: 'Deadline', category: 'Standard' },
  { key: 'domicileQuota', label: 'Domicile Quota', category: 'Standard' },
  { key: 'challanFee', label: 'Challan Fee', category: 'Standard' },
  { key: 'ageRelaxationNote', label: 'Age Relaxation Note', category: 'Standard' },
  { key: 'advertisedPositions', label: 'Advertised Positions', category: 'Standard' },
  { key: 'totalVacancies', label: 'Total Vacancies', category: 'Standard' },
  { key: 'employmentType', label: 'Employment Type', category: 'Standard' },
  { key: 'ageLimit', label: 'Age Limit', category: 'Standard' },
  { key: 'minimumAge', label: 'Minimum Age', category: 'Standard' },
  { key: 'maximumAge', label: 'Maximum Age', category: 'Standard' },
  { key: 'qualificationSummary', label: 'Qualification Summary', category: 'Standard' },
  { key: 'domicile', label: 'Domicile', category: 'Standard' },
  { key: 'newspaperPtid', label: 'Newspaper PTID', category: 'Standard' },
  { key: 'datePosted', label: 'Date Posted', category: 'Standard' },
  { key: 'createdAt', label: 'Created At', category: 'Standard' },
  { key: 'updatedAt', label: 'Updated At', category: 'Standard' },

  // Sensitive Fields
  { key: 'applicationUrl', label: 'Application URL', category: 'Sensitive' },
  { key: 'contactEmail', label: 'Contact Email', category: 'Sensitive' },
  { key: 'contactEmailOrPhone', label: 'Contact Info (Email/Phone)', category: 'Sensitive' },
  { key: 'attachments', label: 'Supporting Attachments', category: 'Sensitive' },
  { key: 'externalApplyUrl', label: 'External Apply URL', category: 'Sensitive' },
  { key: 'sourceUrl', label: 'Source Web Page URL', category: 'Sensitive' },
  { key: 'pdfSourceUrl', label: 'PDF Source URL', category: 'Sensitive' },
  { key: 'mediaUrl', label: 'Media URL', category: 'Sensitive' },
  { key: 'salary', label: 'Salary Information / Text', category: 'Sensitive' },
  { key: 'pdfFileName', label: 'PDF Filename', category: 'Sensitive' },
  { key: 'pdfCaseNumber', label: 'PDF Case Number', category: 'Sensitive' },
  { key: 'pdfTotalVacanciesInCase', label: 'PDF Total Vacancies in Case', category: 'Sensitive' },
  { key: 'relatedSourceUrls', label: 'Related Source URLs', category: 'Sensitive' }
];

export const ALL_REGISTRY_KEYS = ALL_REGISTRY_FIELDS.map(f => f.key);

export function getDefaultVisibilityForField(key: string): FieldVisibility {
  return SENSITIVE_FIELD_KEYS.has(key) ? 'Premium' : 'Free';
}

export type JobVisibilitySourceType = 'user_posted' | 'scraped' | 'admin_created';

/**
 * Normalizes job source classifications consistently across the visibility system.
 * Treats 'pdf_scraped' as 'scraped', while preserving 'scraped', 'user_posted', and 'admin_created'.
 */
export function normalizeJobVisibilitySource(sourceOrJob: any): JobVisibilitySourceType {
  if (!sourceOrJob) return 'user_posted';
  if (typeof sourceOrJob === 'string') {
    if (sourceOrJob === 'pdf_scraped' || sourceOrJob === 'scraped') return 'scraped';
    if (sourceOrJob === 'admin_created') return 'admin_created';
    if (sourceOrJob === 'user_posted') return 'user_posted';
    return 'user_posted';
  }
  const job = sourceOrJob;
  if (job.sourceType === 'admin_created' || job.isAdminCreated || job.createdByRole === 'Admin' || job.createdByRole === 'Super Admin') {
    return 'admin_created';
  }
  if (job.isScraped || job.isPdfScraped || job.sourceType === 'scraped' || job.sourceType === 'pdf_scraped' || job.scraperSourceId) {
    return 'scraped';
  }
  return 'user_posted';
}

