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
export function tokenize(str: string): Set<string> {
  const safeStr = typeof str === 'string' ? str : (str ? String(str) : '');
  return new Set(
    safeStr
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

// Helper to get or memoize token set on job object for high-volume deduplication
function getOrComputeTokens(job: any, field: 'title' | 'company'): Set<string> {
  if (!job || typeof job !== 'object') return new Set<string>();
  if (field === 'title') {
    if (!(job._titleTokens instanceof Set)) {
      if (Array.isArray(job._titleTokens)) {
        job._titleTokens = new Set(job._titleTokens.filter((t: any) => typeof t === 'string' && t.length > 2));
      } else {
        job._titleTokens = tokenize(job.title);
      }
    }
    return job._titleTokens;
  } else {
    if (!(job._companyTokens instanceof Set)) {
      if (Array.isArray(job._companyTokens)) {
        job._companyTokens = new Set(job._companyTokens.filter((t: any) => typeof t === 'string' && t.length > 2));
      } else {
        job._companyTokens = tokenize(job.company);
      }
    }
    return job._companyTokens;
  }
}

// High-performance token similarity utilizing pre-computed/memoized token Sets
function calculateTokenSimilarityFast(
  str1: string,
  tokens1: Set<string>,
  str2: string,
  tokens2: Set<string>
): number {
  if (!str1 || !str2) return 0;
  const s1 = (typeof str1 === 'string' ? str1 : String(str1)).trim().toLowerCase();
  const s2 = (typeof str2 === 'string' ? str2 : String(str2)).trim().toLowerCase();
  if (s1 === s2) return 1.0;

  const set1 = (tokens1 instanceof Set)
    ? tokens1
    : (Array.isArray(tokens1) ? new Set<string>(tokens1) : tokenize(s1));
  const set2 = (tokens2 instanceof Set)
    ? tokens2
    : (Array.isArray(tokens2) ? new Set<string>(tokens2) : tokenize(s2));

  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  if (set1.size <= set2.size) {
    set1.forEach(t => {
      if (set2.has(t)) intersection++;
    });
  } else {
    set2.forEach(t => {
      if (set1.has(t)) intersection++;
    });
  }

  return (2 * intersection) / (set1.size + set2.size);
}

// Dice-Sorensen token similarity
export function calculateTokenSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = (typeof str1 === 'string' ? str1 : String(str1)).trim().toLowerCase();
  const s2 = (typeof str2 === 'string' ? str2 : String(str2)).trim().toLowerCase();
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

/**
 * High-performance reusable duplicate index for high-volume scraper runs.
 * Avoids O(N^2) temporary array allocations, spreads, and repetitive tokenizations.
 */
export class DuplicateIndex {
  private existingJobs: any[];
  private batchJobs: any[] = [];
  private bySourceJobId = new Map<string, { job: any; isBatch: boolean }>();
  private bySourceUrl = new Map<string, { job: any; isBatch: boolean }>();
  private tokenIndex = new Map<string, Array<{ job: any; isBatch: boolean }>>();
  private companyIndex = new Map<string, Array<{ job: any; isBatch: boolean }>>();

  constructor(existingJobs: any[] = []) {
    this.existingJobs = existingJobs || [];
    for (let i = 0; i < this.existingJobs.length; i++) {
      this.indexJob(this.existingJobs[i], false);
    }
  }

  private indexJob(job: any, isBatch: boolean) {
    if (!job || typeof job !== 'object') return;
    const entry = { job, isBatch };

    try {
      if (job.sourceJobId) {
        const key = String(job.sourceJobId).trim().toLowerCase();
        if (!this.bySourceJobId.has(key)) {
          this.bySourceJobId.set(key, entry);
        }
      }
      if (job.sourceUrl) {
        const key = String(job.sourceUrl).trim().toLowerCase();
        if (!this.bySourceUrl.has(key)) {
          this.bySourceUrl.set(key, entry);
        }
      }

      const titleTokens = getOrComputeTokens(job, 'title');
      if (titleTokens && typeof titleTokens.forEach === 'function') {
        titleTokens.forEach(t => {
          if (typeof t === 'string' && t) {
            let list = this.tokenIndex.get(t);
            if (!list) {
              list = [];
              this.tokenIndex.set(t, list);
            }
            list.push(entry);
          }
        });
      }

      if (job.company) {
        const compKey = String(job.company).trim().toLowerCase();
        let compList = this.companyIndex.get(compKey);
        if (!compList) {
          compList = [];
          this.companyIndex.set(compKey, compList);
        }
        compList.push(entry);
      }
    } catch (err) {
      // Safely ignore index error on individual malformed record
    }
  }

  addBatchJob(job: any) {
    this.batchJobs.push(job);
    this.indexJob(job, true);
  }

  getCandidatesForJob(candidateJob: any): Array<{ job: any; isBatch: boolean }> {
    const candTitleTokens = getOrComputeTokens(candidateJob, 'title');
    const seen = new Set<any>();
    const candidates: Array<{ job: any; isBatch: boolean }> = [];

    const addEntry = (entry: { job: any; isBatch: boolean }) => {
      if (entry && entry.job && !seen.has(entry.job)) {
        seen.add(entry.job);
        candidates.push(entry);
      }
    };

    if (candidateJob.sourceJobId) {
      const key = String(candidateJob.sourceJobId).trim().toLowerCase();
      const match = this.bySourceJobId.get(key);
      if (match) addEntry(match);
    }
    if (candidateJob.sourceUrl) {
      const key = String(candidateJob.sourceUrl).trim().toLowerCase();
      const match = this.bySourceUrl.get(key);
      if (match) addEntry(match);
    }

    if (candTitleTokens && typeof candTitleTokens.forEach === 'function') {
      candTitleTokens.forEach(t => {
        if (typeof t === 'string' && t) {
          const list = this.tokenIndex.get(t);
          if (list) {
            for (let j = 0; j < list.length; j++) {
              addEntry(list[j]);
            }
          }
        }
      });
    }

    if (candidateJob.company) {
      const compKey = String(candidateJob.company).trim().toLowerCase();
      const compList = this.companyIndex.get(compKey);
      if (compList) {
        for (let j = 0; j < compList.length; j++) {
          addEntry(compList[j]);
        }
      }
    }

    // If candidate has very short title or no tokens, and candidate pool is empty, fall back to testing all
    if (candidates.length === 0 && (this.existingJobs.length + this.batchJobs.length) < 200) {
      for (let i = 0; i < this.existingJobs.length; i++) addEntry({ job: this.existingJobs[i], isBatch: false });
      for (let i = 0; i < this.batchJobs.length; i++) addEntry({ job: this.batchJobs[i], isBatch: true });
    }

    return candidates;
  }

  getExactMatch(candidateJob: any): { job: any; isBatch: boolean; matchType: 'sourceJobId' | 'sourceUrl' } | null {
    if (candidateJob.sourceJobId) {
      const key = String(candidateJob.sourceJobId).trim().toLowerCase();
      const match = this.bySourceJobId.get(key);
      if (match && match.job && match.job.id !== candidateJob.id) {
        return { ...match, matchType: 'sourceJobId' };
      }
    }
    if (candidateJob.sourceUrl) {
      const key = String(candidateJob.sourceUrl).trim().toLowerCase();
      const match = this.bySourceUrl.get(key);
      if (match && match.job && match.job.id !== candidateJob.id) {
        return { ...match, matchType: 'sourceUrl' };
      }
    }
    return null;
  }

  getExistingJobs(): any[] {
    return this.existingJobs;
  }

  getBatchJobs(): any[] {
    return this.batchJobs;
  }
}

function buildDuplicateMatchResult(
  candidateJob: any,
  existing: any,
  isBatch: boolean,
  sameSourceJobId: boolean,
  sameUrl: boolean,
  titleSim: number,
  companySim: number,
  sameCity: boolean,
  sameGovtScale: boolean,
  score: number,
  signals: string[]
): DuplicateMatchResult {
  const confidence = Math.min(100, Math.round(score));
  const tags: string[] = [];

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

  return {
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

// Authoritative multi-signal duplicate detector
export function detectJobDuplicate(
  candidateJob: any,
  poolOfExistingJobs: any[] | DuplicateIndex,
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

  // Fast path 1 & 2: If using DuplicateIndex, test O(1) exact map lookup first
  if (poolOfExistingJobs instanceof DuplicateIndex) {
    const exact = poolOfExistingJobs.getExactMatch(candidateJob);
    if (exact) {
      if (exact.matchType === 'sourceJobId') {
        return buildDuplicateMatchResult(
          candidateJob,
          exact.job,
          exact.isBatch,
          true,
          false,
          1.0,
          1.0,
          true,
          true,
          100,
          ['Identical Source Job ID']
        );
      } else if (exact.matchType === 'sourceUrl') {
        return buildDuplicateMatchResult(
          candidateJob,
          exact.job,
          exact.isBatch,
          false,
          true,
          1.0,
          1.0,
          true,
          true,
          100,
          ['Identical Source Canonical URL']
        );
      }
    }
  }

  const candTitleTokens = getOrComputeTokens(candidateJob, 'title');
  const candCompanyTokens = getOrComputeTokens(candidateJob, 'company');

  // Helper to evaluate a candidate against an existing record without object cloning
  const evaluateJob = (existing: any, isBatch: boolean): boolean => {
    if (existing.id === candidateJob.id) return false;

    let score = 0;
    const signals: string[] = [];

    const sameSourceJobId = !!(
      candidateJob.sourceJobId &&
      existing.sourceJobId &&
      String(candidateJob.sourceJobId) === String(existing.sourceJobId)
    );
    const sameUrl = !!(
      candidateJob.sourceUrl &&
      existing.sourceUrl &&
      candidateJob.sourceUrl.toLowerCase() === existing.sourceUrl.toLowerCase()
    );

    const sameCity = !!(
      candidateJob.city &&
      existing.city &&
      candidateJob.city.toLowerCase() === existing.city.toLowerCase()
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

    let titleSim = 0;
    let companySim = 0;

    // Exact Source Job ID or Source URL match = 100% duplicate
    if (sameSourceJobId) {
      score = 100;
      signals.push('Identical Source Job ID');
      titleSim = 1.0;
      companySim = 1.0;
    } else if (sameUrl) {
      score = 100;
      signals.push('Identical Source Canonical URL');
      titleSim = 1.0;
      companySim = 1.0;
    } else {
      titleSim = calculateTokenSimilarityFast(candidateJob.title, candTitleTokens, existing.title, getOrComputeTokens(existing, 'title'));
      companySim = calculateTokenSimilarityFast(candidateJob.company, candCompanyTokens, existing.company, getOrComputeTokens(existing, 'company'));

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
      highestMatch = buildDuplicateMatchResult(
        candidateJob,
        existing,
        isBatch,
        sameSourceJobId,
        sameUrl,
        titleSim,
        companySim,
        sameCity,
        sameGovtScale,
        score,
        signals
      );

      // If maximum possible confidence is reached, can stop early
      if (confidence === 100) return true;
    }

    return false;
  };

  if (poolOfExistingJobs instanceof DuplicateIndex) {
    const candidates = poolOfExistingJobs.getCandidatesForJob(candidateJob);
    for (let i = 0; i < candidates.length; i++) {
      if (evaluateJob(candidates[i].job, candidates[i].isBatch)) return highestMatch;
    }
  } else {
    const existingList = poolOfExistingJobs || [];
    for (let i = 0; i < existingList.length; i++) {
      if (evaluateJob(existingList[i], false)) return highestMatch;
    }

    const batchList = currentBatchJobs || [];
    for (let i = 0; i < batchList.length; i++) {
      if (evaluateJob(batchList[i], true)) return highestMatch;
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
