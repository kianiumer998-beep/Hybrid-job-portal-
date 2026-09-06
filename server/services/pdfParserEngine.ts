import { PDFParse } from 'pdf-parse';
import { Job } from '../../src/types/job';

export interface ExtractedPdfResult {
  success: boolean;
  totalPages: number;
  extractedJobs: Job[];
  rawTextSample: string;
  sourceUrl?: string;
  fileName?: string;
  message?: string;
}

/**
 * Parses raw text extracted from a recruitment PDF to detect genuine job vacancies.
 * STRICT POLICY: NEVER invent, fabricate, or synthesize fake/demo jobs.
 * If no recognizable job listings are present in the text, returns an empty array.
 */
export function extractJobsFromPdfText(
  fullText: string,
  sourceUrl: string,
  orgName?: string,
  fileName?: string
): Job[] {
  if (!fullText || fullText.trim().length < 50) {
    return [];
  }

  const jobs: Job[] = [];
  const domain = sourceUrl.startsWith('http') ? new URL(sourceUrl).hostname : 'official-source';
  const org = orgName || domain.replace('www.', '').split('.')[0].toUpperCase();

  // Normalize text lines
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  // Common Pakistani and International government/corporate recruitment indicators
  const bpsRegex = /\b(BPS|BS|PPS|BPS\s*-\s*|BS\s*-\s*|PPS\s*-\s*)(\d{1,2})\b/i;
  const caseRegex = /(?:Case\s*(?:No\.?|Ref\.?|Number:?)|Advt\s*(?:No\.?|Ref\.?))\s*([A-Za-z0-9\.\-\/]+)/i;
  const vacancyCountRegex = /(?:No\.?\s*of\s*Vacanc(?:ies|y)|Total\s*Posts?|Positions?)\s*[:=]?\s*(\d+)/i;
  const ageRegex = /(?:Age\s*Limit|Age)\s*[:=]?\s*([0-9\s\-\+toyears]+)/i;
  const closingRegex = /(?:Closing\s*Date|Last\s*Date\s*to\s*Apply|Deadline)\s*[:=]?\s*([0-9A-Za-z\s,]+)/i;

  // Split text by common post/case dividers
  // e.g., "Case No.", "Sr. No.", "Item No.", or numbered bullet points preceding job titles
  const chunkSeparators = /(?=(?:Case\s*No\.?|Advt\s*No\.?|Item\s*No\.?|\n\s*\d+\.\s+[A-Z\s]{4,}(?:\(|BPS)))/i;
  let rawChunks = fullText.split(chunkSeparators);

  // If chunking didn't split (e.g. no standard divider), look for BPS markers or title lines
  if (rawChunks.length <= 1) {
    // Try splitting by BPS or BS occurrences
    rawChunks = fullText.split(/(?=(?:[A-Z\s]{4,}\s*\((?:BPS|BS|PPS)-\d+\)))/);
  }

  let index = 0;
  for (const chunk of rawChunks) {
    const trimmedChunk = chunk.trim();
    if (trimmedChunk.length < 40) continue;

    // Check if chunk contains genuine job attributes
    const bpsMatch = trimmedChunk.match(bpsRegex);
    const caseMatch = trimmedChunk.match(caseRegex);
    const vacancyMatch = trimmedChunk.match(vacancyCountRegex);
    const ageMatch = trimmedChunk.match(ageRegex);
    const closingMatch = trimmedChunk.match(closingRegex);

    // Look for a job title in the first 3 lines of this chunk
    const chunkLines = trimmedChunk.split('\n').map(l => l.trim()).filter(Boolean);
    let detectedTitle = '';

    for (const line of chunkLines.slice(0, 4)) {
      // Clean candidate title
      const candidate = line
        .replace(/^(?:Case\s*No\.?|Advt\s*No\.?|Item\s*No\.?|\d+[\.\)]\s*)/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Check if line looks like a job title (contains alphabetic chars, not just dates or numbers)
      if (
        candidate.length >= 4 &&
        candidate.length <= 120 &&
        !/^(?:Government|Ministry|Federal|Provincial|Notice|Advertisement|Closing|Date|Page|Important|General|Rules)/i.test(candidate) &&
        (/[A-Za-z]/.test(candidate))
      ) {
        detectedTitle = candidate;
        break;
      }
    }

    // Only create a job if there is a detected title AND either a BPS scale, case number, or vacancy count
    if (detectedTitle && (bpsMatch || caseMatch || vacancyMatch || trimmedChunk.toLowerCase().includes('qualification'))) {
      index++;
      const scale = bpsMatch ? `${bpsMatch[1].toUpperCase()}-${bpsMatch[2]}` : 'BPS / Standard Cadre';
      const caseNumber = caseMatch ? caseMatch[1] : undefined;
      const vacanciesCount = vacancyMatch ? parseInt(vacancyMatch[1], 10) : 1;
      const ageRelaxation = ageMatch ? ageMatch[1].trim() : undefined;
      const deadline = closingMatch ? closingMatch[1].trim() : undefined;

      // Extract qualification snippet if available
      let qualificationSnippet = '';
      const qualMatch = trimmedChunk.match(/(?:Qualification[s]?|Eligibility|Minimum\s*Requirements?)\s*[:=]?\s*([^\n\.]+)/i);
      if (qualMatch) {
        qualificationSnippet = qualMatch[1].trim();
      }

      // Check domicile/quota mentions
      let domicileQuota = '';
      const quotaMatch = trimmedChunk.match(/(?:Domicile|Quota|Regional\s*Quota)\s*[:=]?\s*([^\n\.]+)/i);
      if (quotaMatch) {
        domicileQuota = quotaMatch[1].trim();
      }

      const jobId = `pdf-real-${Date.now().toString(36)}-${index}-${Math.random().toString(36).substring(2, 6)}`;

      const job: Job = {
        id: jobId,
        title: detectedTitle.includes(scale) ? detectedTitle : `${detectedTitle} (${scale})`,
        company: org,
        jobType: 'On-site',
        region: 'Pakistan',
        salary: scale.includes('BPS') ? `Government Pay Scale (${scale})` : 'Salary not disclosed',
        currency: 'PKR',
        experienceLevel: scale.includes('17') || scale.includes('18') || scale.includes('19') ? 'Mid' : 'Entry',
        department: org,
        tags: [scale, org, 'Original Gazette Job', 'Extracted from PDF'].filter(Boolean),
        description: `Official vacancy extracted from document:\n\n${trimmedChunk.substring(0, 1200)}`,
        requirements: qualificationSnippet ? [qualificationSnippet] : ['Refer to official advertisement for full qualification details'],
        benefits: ['Official Public Sector Remuneration and Allowances per Government Rules'],
        postedAt: 'Recent',
        applicationsCount: 0,
        status: 'Pending',
        isGovtJob: true,
        govtDepartment: org,
        govtScale: scale,
        govtCategory: org.toLowerCase().includes('federal') || org.toLowerCase().includes('fpsc') ? 'Federal' : 'Provincial',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: fileName || (sourceUrl.split('/').pop()?.split('?')[0] || 'recruitment_ad.pdf'),
        pdfSourceUrl: sourceUrl,
        pdfCaseNumber: caseNumber,
        pdfTotalVacanciesInCase: vacanciesCount,
        domicileQuota: domicileQuota || undefined,
        ageRelaxationNote: ageRelaxation,
        pdfParserEngine: 'pdfplumber',
        deadlineDate: deadline,
        sourceUrl: sourceUrl,
        scrapedSourceDomain: domain,
        scraperSourceName: `${org} PDF Engine`,
        scrapedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        paymentStatus: 'Exempt'
      };

      jobs.push(job);
    }
  }

  // Factual integrity: If no jobs match, return empty array. NEVER fabricate jobs!
  return jobs;
}

/**
 * Downloads a PDF file from a URL and extracts factual job vacancies.
 */
export async function parsePdfFromUrl(url: string, orgName?: string): Promise<ExtractedPdfResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,application/octet-stream,*/*'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        success: false,
        totalPages: 0,
        extractedJobs: [],
        rawTextSample: '',
        sourceUrl: url,
        message: `Failed to download PDF. Server responded with HTTP ${res.status} (${res.statusText})`
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF binary data using pdf-parse
    const parser = new PDFParse({ data: buffer });
    const parsedData = await parser.getText();
    const text = parsedData.text || '';
    const totalPages = parsedData.total || 1;
    await parser.destroy();
    const fileName = url.split('/').pop()?.split('?')[0] || 'ad.pdf';

    const jobs = extractJobsFromPdfText(text, url, orgName, fileName);

    return {
      success: true,
      totalPages,
      extractedJobs: jobs,
      rawTextSample: text.substring(0, 1500),
      sourceUrl: url,
      fileName,
      message: jobs.length > 0 
        ? `Successfully extracted ${jobs.length} original vacancies from PDF.`
        : `PDF processed (${totalPages} pages), but no structured vacancy listings were detected. No synthetic data was generated.`
    };
  } catch (error: any) {
    console.error(`[PDF Parser] Error parsing PDF from ${url}:`, error?.message || error);
    return {
      success: false,
      totalPages: 0,
      extractedJobs: [],
      rawTextSample: '',
      sourceUrl: url,
      message: `Error reading PDF document: ${error?.message || 'Unknown error'}`
    };
  }
}
