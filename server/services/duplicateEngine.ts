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
  duplicateTags: string[];
  matchingSignals: string[];
  reason: string;
  source?: string;
  comparisonDetails: {
    titleSimilarity: number;
    companySimilarity: number;
    locationMatch: boolean;
    salaryMatch: boolean;
    sourceUrlMatch: boolean;
    sourceJobIdMatch?: boolean;
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

// Authoritative multi-signal duplicate detector
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
    duplicateTags: [],
    matchingSignals: [],
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
    const signals: string[] = [];
    const tags: string[] = [];

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
    const sameSourceJobId = !!(
      candidateJob.sourceJobId &&
      existing.sourceJobId &&
      String(candidateJob.sourceJobId) === String(existing.sourceJobId)
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

    // Exact Source Job ID or Source URL match = 100% duplicate
    if (sameSourceJobId) {
      score = 100;
      signals.push('Identical Source Job ID');
    } else if (sameUrl) {
      score = 100;
      signals.push('Identical Source Canonical URL');
    } else {
      if (titleSim > 0.8) {
        score += titleSim * 45;
        signals.push(`Title Match (${Math.round(titleSim * 100)}%)`);
      } else if (titleSim > 0.6) {
        score += titleSim * 35;
        signals.push(`Partial Title Similarity (${Math.round(titleSim * 100)}%)`);
      }

      if (companySim > 0.8) {
        score += companySim * 30;
        signals.push('Identical Company Name');
      } else if (companySim > 0.6) {
        score += companySim * 20;
        signals.push('Similar Company Name');
      }

      if (sameCity) {
        score += 10;
        signals.push(`Matching City: ${candidateJob.city}`);
      }

      if (candidateJob.isGovtJob && existing.isGovtJob && sameGovtScale) {
        score += 15;
        signals.push(`Matching Govt Scale: ${candidateJob.govtScale}`);
      } else if (sameDept) {
        score += 10;
        signals.push(`Matching Department: ${candidateJob.department}`);
      }
    }

    const confidence = Math.min(100, Math.round(score));

    if (confidence >= 65 && confidence > highestMatch.confidence) {
      // Retain BOTH status and duplicate classification
      const isBatch = existing._pool === 'batch';
      const isApproved = existing.status === 'Approved' || (!existing.status && !existing.isSuspended);
      const isPending = existing.status === 'Pending';
      const isExpired = existing.status === 'Expired' || existing.isExpired;

      if (isBatch) tags.push('CURRENT-SCRAPE');
      if (isApproved) tags.push('LIVE');
      if (isPending) tags.push('PENDING');
      if (isExpired) tags.push('EXPIRED');

      const isSameSource = !!(
        existing.scraperSourceId &&
        candidateJob.scraperSourceId &&
        existing.scraperSourceId === candidateJob.scraperSourceId
      );
      const isCrossSource = !!(
        (existing.scrapedSourceDomain && candidateJob.scrapedSourceDomain && existing.scrapedSourceDomain !== candidateJob.scrapedSourceDomain) ||
        (existing.sourceUrl && candidateJob.sourceUrl && existing.scraperSourceId !== candidateJob.scraperSourceId)
      );

      if (isSameSource) tags.push('SAME-SOURCE DUPLICATE');
      if (isCrossSource) tags.push('CROSS-SOURCE DUPLICATE');

      // Primary classification
      let primaryCategory: DuplicateMatchResult['duplicateCategory'] = 'POSSIBLE DUPLICATE';
      if (isBatch) {
        primaryCategory = 'CURRENT-SCRAPE DUPLICATE';
      } else if (isSameSource) {
        primaryCategory = 'SAME-SOURCE DUPLICATE';
      } else if (isCrossSource) {
        primaryCategory = 'CROSS-SOURCE DUPLICATE';
      } else if (isApproved) {
        primaryCategory = 'LIVE DUPLICATE';
      } else if (isPending) {
        primaryCategory = 'PENDING DUPLICATE';
      } else if (isExpired) {
        primaryCategory = 'EXPIRED DUPLICATE';
      }

      highestMatch = {
        isDuplicate: true,
        confidence,
        matchedExistingJob: {
          id: existing.id,
          title: existing.title,
          company: existing.company,
          status: existing.status || 'Approved',
          city: existing.city,
          sourceUrl: existing.sourceUrl,
          scraperSourceName: existing.scraperSourceName || existing.sourceUrl,
          postedAt: existing.postedAt || existing.createdAt
        },
        duplicateCategory: primaryCategory,
        duplicateTags: tags,
        matchingSignals: signals,
        reason: sameSourceJobId
          ? `Identical source ID (${candidateJob.sourceJobId}) matches: "${existing.title}" at ${existing.company}`
          : sameUrl
          ? `Canonical source URL matches existing vacancy: "${existing.title}"`
          : `High similarity (${confidence}%) to existing "${existing.title}" at "${existing.company}" (${tags.join(' + ')})`,
        source: existing.scraperSourceName || existing.scrapedSourceDomain || existing.sourceUrl,
        comparisonDetails: {
          titleSimilarity: Math.round(titleSim * 100),
          companySimilarity: Math.round(companySim * 100),
          locationMatch: sameCity,
          salaryMatch: candidateJob.salary === existing.salary,
          sourceUrlMatch: sameUrl,
          sourceJobIdMatch: sameSourceJobId,
          govtDetailsMatch: sameGovtScale
        }
      };
    }
  }

  return highestMatch;
}

// Intelligent Merge Utility for duplicates - preserves the best information and never overwrites with empty
export function mergeJobRecords(primaryJob: any, secondaryJob: any): any {
  const mergedDescription = (primaryJob.description?.length >= (secondaryJob.description?.length || 0))
    ? primaryJob.description
    : (secondaryJob.description || primaryJob.description);

  const cleanSalary = (primaryJob.salary && primaryJob.salary !== 'Salary not disclosed')
    ? primaryJob.salary
    : (secondaryJob.salary && secondaryJob.salary !== 'Salary not disclosed')
    ? secondaryJob.salary
    : (primaryJob.salary || 'Salary not disclosed');

  return {
    ...primaryJob,
    title: (primaryJob.title?.length >= secondaryJob.title?.length) ? primaryJob.title : secondaryJob.title,
    company: primaryJob.company || secondaryJob.company,
    description: mergedDescription,
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
    salary: cleanSalary,
    sourceUrl: primaryJob.sourceUrl || secondaryJob.sourceUrl,
    secondarySourceUrl: (secondaryJob.sourceUrl && secondaryJob.sourceUrl !== primaryJob.sourceUrl)
      ? secondaryJob.sourceUrl
      : primaryJob.secondarySourceUrl,
    applicationUrl: primaryJob.applicationUrl || secondaryJob.applicationUrl,
    deadlineDate: primaryJob.deadlineDate || secondaryJob.deadlineDate || primaryJob.deadline || secondaryJob.deadline,
    deadline: primaryJob.deadline || secondaryJob.deadline || primaryJob.deadlineDate || secondaryJob.deadlineDate,
    isGovtJob: primaryJob.isGovtJob || secondaryJob.isGovtJob,
    govtScale: primaryJob.govtScale || secondaryJob.govtScale,
    govtDepartment: primaryJob.govtDepartment || secondaryJob.govtDepartment,
    mergedAt: new Date().toISOString(),
    isMerged: true,
    mergedFromJobId: secondaryJob.id,
    isDuplicate: false,
    duplicateScore: 0,
    duplicateCategory: 'NONE',
    duplicateMatchReason: `Merged with job ${secondaryJob.id} on ${new Date().toISOString().substring(0, 10)}`
  };
}
