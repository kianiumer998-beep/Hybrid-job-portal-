export interface DuplicateMatchResult {
  isDuplicate: boolean;
  confidence: number; // 0 - 100%
  matchedExistingJob: any;
  duplicateCategory: 
    | 'LIVE DUPLICATE'
    | 'PENDING DUPLICATE'
    | 'EXPIRED DUPLICATE'
    | 'SAME-SOURCE DUPLICATE'
    | 'CROSS-SOURCE DUPLICATE'
    | 'CURRENT-SCRAPE DUPLICATE'
    | 'PREVIOUS-SCRAPE DUPLICATE'
    | 'POSSIBLE DUPLICATE'
    | 'NONE';
  reason: string;
  comparisonDetails: {
    titleSimilarity: number;
    companySimilarity: number;
    locationMatch: boolean;
    salaryMatch: boolean;
    sourceUrlMatch: boolean;
    govtDetailsMatch?: boolean;
  };
}

// Tokenize & normalize string for comparison
function tokenize(str: string): Set<string> {
  return new Set(
    (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

// Dice-Sorensen token similarity
function calculateTokenSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = (str1 || '').trim().toLowerCase();
  const s2 = (str2 || '').trim().toLowerCase();
  if (s1 === s2) return 1.0;

  const tokens1 = tokenize(s1);
  const tokens2 = tokenize(s2);
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) intersection++;
  });

  return (2 * intersection) / (tokens1.size + tokens2.size);
}

export function detectJobDuplicate(
  candidateJob: any,
  poolOfExistingJobs: any[],
  currentBatchJobs: any[] = []
): DuplicateMatchResult {
  let highestMatch: DuplicateMatchResult = {
    isDuplicate: false,
    confidence: 0,
    matchedExistingJob: null,
    duplicateCategory: 'NONE',
    reason: 'Unique job posting',
    comparisonDetails: {
      titleSimilarity: 0,
      companySimilarity: 0,
      locationMatch: false,
      salaryMatch: false,
      sourceUrlMatch: false
    }
  };

  const allJobsToCompare = [
    ...poolOfExistingJobs.map(j => ({ ...j, _pool: 'existing' })),
    ...currentBatchJobs.filter(j => j.id !== candidateJob.id).map(j => ({ ...j, _pool: 'batch' }))
  ];

  for (const existing of allJobsToCompare) {
    let score = 0;
    const titleSim = calculateTokenSimilarity(candidateJob.title, existing.title);
    const companySim = calculateTokenSimilarity(candidateJob.company, existing.company);

    const sameCity = !!(
      candidateJob.city &&
      existing.city &&
      candidateJob.city.toLowerCase() === existing.city.toLowerCase()
    );
    const sameUrl = !!(
      candidateJob.sourceUrl &&
      existing.sourceUrl &&
      candidateJob.sourceUrl.toLowerCase() === existing.sourceUrl.toLowerCase()
    );
    const sameDept = !!(
      candidateJob.department &&
      existing.department &&
      candidateJob.department.toLowerCase() === existing.department.toLowerCase()
    );
    const sameGovtScale = !!(
      candidateJob.govtScale &&
      existing.govtScale &&
      candidateJob.govtScale.toLowerCase() === existing.govtScale.toLowerCase()
    );

    // Exact Source URL match = immediate 100% duplicate
    if (sameUrl) {
      score = 100;
    } else {
      // Weight title similarity (up to 45%)
      score += titleSim * 45;

      // Weight company similarity (up to 30%)
      score += companySim * 30;

      // Location match bonus (10%)
      if (sameCity) score += 10;

      // Department or scale match bonus (15%)
      if (candidateJob.isGovtJob && existing.isGovtJob && sameGovtScale) {
        score += 15;
      } else if (sameDept) {
        score += 10;
      }
    }

    const confidence = Math.min(100, Math.round(score));

    if (confidence >= 65 && confidence > highestMatch.confidence) {
      let category: DuplicateMatchResult['duplicateCategory'] = 'POSSIBLE DUPLICATE';

      if (existing._pool === 'batch') {
        category = 'CURRENT-SCRAPE DUPLICATE';
      } else if (existing.status === 'Approved' || (!existing.status && !existing.isSuspended)) {
        category = 'LIVE DUPLICATE';
      } else if (existing.status === 'Pending') {
        category = 'PENDING DUPLICATE';
      } else if (existing.status === 'Expired') {
        category = 'EXPIRED DUPLICATE';
      } else if (existing.scraperSourceId && candidateJob.scraperSourceId && existing.scraperSourceId === candidateJob.scraperSourceId) {
        category = 'SAME-SOURCE DUPLICATE';
      } else if (existing.sourceUrl && candidateJob.sourceUrl && existing.scrapedSourceDomain !== candidateJob.scrapedSourceDomain) {
        category = 'CROSS-SOURCE DUPLICATE';
      }

      highestMatch = {
        isDuplicate: true,
        confidence,
        matchedExistingJob: existing,
        duplicateCategory: category,
        reason: sameUrl
          ? `Identical source URL matches existing listing: "${existing.title}"`
          : `High similarity (${confidence}%) to existing "${existing.title}" at "${existing.company}"`,
        comparisonDetails: {
          titleSimilarity: Math.round(titleSim * 100),
          companySimilarity: Math.round(companySim * 100),
          locationMatch: sameCity,
          salaryMatch: candidateJob.salary === existing.salary,
          sourceUrlMatch: sameUrl,
          govtDetailsMatch: sameGovtScale
        }
      };
    }
  }

  return highestMatch;
}

// Intelligent Merge Utility for duplicates
export function mergeJobRecords(primaryJob: any, secondaryJob: any): any {
  return {
    ...primaryJob,
    title: (primaryJob.title?.length >= secondaryJob.title?.length) ? primaryJob.title : secondaryJob.title,
    company: primaryJob.company || secondaryJob.company,
    description: (primaryJob.description?.length >= (secondaryJob.description?.length || 0))
      ? primaryJob.description
      : secondaryJob.description,
    requirements: Array.from(new Set([
      ...(primaryJob.requirements || []),
      ...(secondaryJob.requirements || [])
    ])),
    benefits: Array.from(new Set([
      ...(primaryJob.benefits || []),
      ...(secondaryJob.benefits || [])
    ])),
    tags: Array.from(new Set([
      ...(primaryJob.tags || []),
      ...(secondaryJob.tags || [])
    ])),
    salary: (primaryJob.salary && primaryJob.salary !== 'Salary not disclosed')
      ? primaryJob.salary
      : (secondaryJob.salary || 'Salary not disclosed'),
    sourceUrl: primaryJob.sourceUrl || secondaryJob.sourceUrl,
    secondarySourceUrl: secondaryJob.sourceUrl || undefined,
    applicationUrl: primaryJob.applicationUrl || secondaryJob.applicationUrl,
    deadlineDate: primaryJob.deadlineDate || secondaryJob.deadlineDate,
    isGovtJob: primaryJob.isGovtJob || secondaryJob.isGovtJob,
    govtScale: primaryJob.govtScale || secondaryJob.govtScale,
    govtDepartment: primaryJob.govtDepartment || secondaryJob.govtDepartment,
    mergedAt: new Date().toISOString(),
    isMerged: true,
    mergedFromJobId: secondaryJob.id
  };
}
