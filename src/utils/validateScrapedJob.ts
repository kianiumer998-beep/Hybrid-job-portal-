export function validateScrapedJobFields(job: any): string[] {
  if (job.source !== 'scraper' && !job.scrapedJob) return [];
  
  const missing: string[] = [];
  if (!job.company) missing.push('Company');
  
  const hasLocation = job.location || job.country || job.region || job.province || job.city || job.district;
  if (!hasLocation) missing.push('Location');
  
  if (!job.salary) missing.push('Salary');
  if (!job.currency) missing.push('Currency');
  if (!job.experienceLevel) missing.push('Experience Level');
  if (!job.department) missing.push('Department');
  if (!job.description) missing.push('Description');
  if (!job.jobType) missing.push('Job Type');
  if (!job.sourceUrl && !job.applicationUrl) missing.push('Source URL');
  if (!job.postedAt) missing.push('Posted Date');
  
  return missing;
}
