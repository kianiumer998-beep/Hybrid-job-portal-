import { PDFParse } from 'pdf-parse';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import { Job, Region } from '../../src/types/job';
import { safeFetchWithRetry } from '../utils/ssrfProtection';

export type DiagnosticCode =
  | 'PDF_TEXT_SUCCESS'
  | 'PDF_TEXT_ZERO_VACANCIES'
  | 'PDF_SCANNED_FALLBACK_SUCCESS'
  | 'PDF_SCANNED_FALLBACK_NO_VACANCIES'
  | 'PDF_SCANNED_OCR_KEY_MISSING'
  | 'PDF_SCANNED_OCR_FAILED'
  | 'IMAGE_OCR_SUCCESS'
  | 'IMAGE_OCR_NO_VACANCIES'
  | 'IMAGE_OCR_KEY_MISSING'
  | 'IMAGE_OCR_FAILED'
  | 'HTML_TEXT_SUCCESS'
  | 'HTML_TEXT_NO_VACANCIES'
  | 'GENERIC_TEXT_SUCCESS'
  | 'GENERIC_TEXT_NO_VACANCIES'
  | 'INVALID_MEDIA_TYPE'
  | 'OVERSIZED_DOCUMENT'
  | 'EMPTY_RESPONSE'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'SSRF_BLOCKED';

export interface ExtractedPdfResult {
  success: boolean;
  totalPages: number;
  extractedJobs: Job[];
  rawTextSample: string;
  fullExtractedText?: string;
  sourceUrl?: string;
  fileName?: string;
  message?: string;
  mediaUrl?: string;
  clippingImageUrl?: string;
  formatType?: 'pdf' | 'html' | 'image' | 'scanned_pdf';
  diagnosticCode?: DiagnosticCode | string;
  diagnosticDetails?: string;
}

/**
 * Formats a 2D array of extracted PDF table cells into a clean, alignment-preserving Markdown table.
 * Preserves multi-column data (Post, BPS Scale, Vacancies, Quota, Qualifications, Age, Deadlines).
 */
export function formatTableToMarkdown(rows: string[][]): string {
  if (!rows || rows.length === 0) return '';
  const cleanRows = rows.map(r => (Array.isArray(r) ? r.map(c => String(c || '').replace(/\r?\n+/g, ' ').trim()) : []));
  const validRows = cleanRows.filter(r => r.some(c => c.length > 0));
  if (validRows.length === 0) return '';

  const colCount = Math.max(...validRows.map(r => r.length));
  if (colCount <= 1 && validRows.length <= 1) return '';

  const normalizedRows = validRows.map(r => {
    const pad = [...r];
    while (pad.length < colCount) pad.push('');
    return pad;
  });

  const header = normalizedRows[0];
  const separator = Array(colCount).fill('---');
  const body = normalizedRows.slice(1);

  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map(r => `| ${r.join(' | ')} |`)
  ];
  return lines.join('\n');
}

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

/**
 * Parses raw text extracted from a recruitment document/gazette to detect genuine job vacancies.
 * STRICT POLICY: NEVER invent, fabricate, or synthesize fake/demo jobs.
 * If no recognizable job listings are present in the text, returns an empty array.
 */
export function extractJobsFromPdfText(
  fullText: string,
  sourceUrl: string,
  orgName?: string,
  fileName?: string,
  mediaUrl?: string
): Job[] {
  if (!fullText || fullText.trim().length < 40) {
    return [];
  }

  const jobs: Job[] = [];
  const domain = sourceUrl.startsWith('http') ? new URL(sourceUrl).hostname : 'official-source';
  const org = orgName || domain.replace('www.', '').split('.')[0].toUpperCase();

  // Normalize text lines
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  // Common Pakistani and International government/corporate recruitment indicators
  const bpsRegex = /\b(BPS|BS|PPS)\s*[-–—]?\s*(\d{1,2})\b/i;
  const caseRegex = /(?:Case\s*(?:No\.?|Ref\.?|Number:?)|Advt\s*(?:No\.?|Ref\.?)|Item\s*(?:No\.?|Ref\.?))\s*[:=]?\s*([A-Za-z0-9\.\-\/]+)/i;
  const vacancyCountRegex = /(?:No\.?\s*of\s*Vacanc(?:ies|y)|Total\s*Posts?|Total\s*Vacancies|Positions?|Vacancies)\s*[:=]?\s*(\d+)/i;
  const ageRegex = /(?:Age\s*Limit|Age)\s*[:=]?\s*([0-9\s\-\+toyears]+)/i;
  const closingRegex = /(?:Closing\s*Date|Last\s*Date\s*to\s*Apply|Deadline|Apply\s*Before)\s*[:=]?\s*([0-9A-Za-z\s,\-\/]+)/i;

  // Split text by common post/case dividers
  const chunkSeparators = /(?=(?:\n\s*(?:Case\s*No\.?|Advt\s*No\.?|Item\s*No\.?)|\n\s*\d+\.\s+[A-Z\s]{4,}(?:\(|BPS)))/i;
  let rawChunks = fullText.split(chunkSeparators);

  // If chunking didn't split, look for clean BPS markers or numbered title lines
  if (rawChunks.length <= 1) {
    rawChunks = fullText.split(/(?=(?:\n\s*[A-Z][A-Za-z\s]{2,}\s*\((?:BPS|BS|PPS)[-\s]?\d+\)))/);
  }
  if (rawChunks.length <= 1) {
    rawChunks = fullText.split(/\n\s*(?=\d+[\.\)]\s+[A-Z])/);
  }

  let index = 0;
  for (const chunk of rawChunks) {
    const trimmedChunk = chunk.trim();
    if (trimmedChunk.length < 35) continue;

    // Check if chunk contains genuine job attributes
    const bpsMatch = trimmedChunk.match(bpsRegex);
    const caseMatch = trimmedChunk.match(caseRegex);
    const vacancyMatch = trimmedChunk.match(vacancyCountRegex);
    const ageMatch = trimmedChunk.match(ageRegex);
    const closingMatch = trimmedChunk.match(closingRegex);

    // Look for a job title in the first 6 lines of this chunk
    const chunkLines = trimmedChunk.split('\n').map(l => l.trim()).filter(Boolean);
    let detectedTitle = '';

    for (const line of chunkLines.slice(0, 6)) {
      // Skip case / advt reference lines when identifying the job title
      if (/^(?:Case\s*(?:No\.?|Ref\.?|Number:?)|Advt\s*(?:No\.?|Ref\.?)|Item\s*(?:No\.?|Ref\.?))/i.test(line)) {
        continue;
      }

      const candidate = line
        .replace(/^(?:\d+[\.\)]\s*)/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (
        candidate.length >= 4 &&
        candidate.length <= 120 &&
        !/^(?:Government|Ministry|Federal|Provincial|Notice|Advertisement|Closing|Date|Page|Important|General|Rules|Total|Domicile|Quota|Merit|Qualification|Eligibility|Fee|Challan)/i.test(candidate) &&
        (/[A-Za-z]/.test(candidate))
      ) {
        detectedTitle = candidate;
        break;
      }
    }

    if (detectedTitle && (bpsMatch || caseMatch || vacancyMatch || trimmedChunk.toLowerCase().includes('qualification') || trimmedChunk.toLowerCase().includes('experience'))) {
      index++;
      const scale = bpsMatch ? `${bpsMatch[1].toUpperCase()}-${bpsMatch[2]}` : 'BPS / Standard Cadre';
      const caseNumber = caseMatch ? caseMatch[1] : undefined;
      const vacanciesCount = vacancyMatch ? parseInt(vacancyMatch[1], 10) : undefined;

      const empTypeMatch = trimmedChunk.match(/\b(Permanent|Contract|Regular|Temporary|Adhoc|Probation|Part[- ]time|Full[- ]time)\b/i);
      const explicitEmploymentType = empTypeMatch ? empTypeMatch[0] : undefined;

      const deadline = closingMatch ? closingMatch[1].trim() : undefined;

      let qualificationSnippet: string | undefined;
      const qualMatch = trimmedChunk.match(/(?:Qualification[s]?|Eligibility|Minimum\s*Requirements?)\s*[:=]?\s*([^\n\.]+)/i);
      if (qualMatch) {
        qualificationSnippet = qualMatch[1].trim();
      }

      let domicileQuota: string | undefined;
      const quotaMatch = trimmedChunk.match(/(?:Domicile|Quota|Regional\s*Quota)\s*[:=]?\s*([^\n\.]+)/i);
      if (quotaMatch) {
        domicileQuota = quotaMatch[1].trim();
      }

      const emailMatch = trimmedChunk.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

      let minAge: number | undefined;
      let maxAge: number | undefined;
      let ageLimitText: string | undefined;

      const explicitAgeRangeMatch = trimmedChunk.match(/(?:Age\s*(?:Limit)?|Age\s*Range)\s*[:=]?\s*(\d{2})\s*(?:to|-|–)\s*(\d{2})\s*(?:years|yrs)?/i);
      if (explicitAgeRangeMatch) {
        minAge = parseInt(explicitAgeRangeMatch[1], 10);
        maxAge = parseInt(explicitAgeRangeMatch[2], 10);
        ageLimitText = `${minAge}-${maxAge} years`;
      } else if (ageMatch && !/relaxation/i.test(ageMatch[1])) {
        ageLimitText = ageMatch[1].trim();
      }

      let ageRelaxationNote: string | undefined;
      const relaxationMatch = trimmedChunk.match(/(?:age\s*relaxation|general\s*age\s*relaxation|relaxation\s*in\s*upper\s*age\s*limit)\s*[:=]?\s*([^\n\.]+)/i);
      if (relaxationMatch) {
        ageRelaxationNote = relaxationMatch[1].trim();
      } else if (ageMatch && /relaxation/i.test(ageMatch[1])) {
        ageRelaxationNote = ageMatch[1].trim();
      }

      let explicitApplyUrl: string | undefined;
      const applyUrlMatch = trimmedChunk.match(/https?:\/\/[^\s\)\>]+(?:apply|online|registration|portal)[^\s\)\>]*/i);
      if (applyUrlMatch) {
        explicitApplyUrl = applyUrlMatch[0];
      }

      const jobId = `doc-real-${Date.now().toString(36)}-${index}-${Math.random().toString(36).substring(2, 6)}`;

      const isFederal = org.toLowerCase().includes('federal') || org.toLowerCase().includes('fpsc') || org.toLowerCase().includes('islamabad');
      const isPunjab = org.toLowerCase().includes('punjab') || org.toLowerCase().includes('ppsc') || org.toLowerCase().includes('lahore');
      const isSindh = org.toLowerCase().includes('sindh') || org.toLowerCase().includes('spsc') || org.toLowerCase().includes('karachi');
      const isKpk = org.toLowerCase().includes('kpk') || org.toLowerCase().includes('kp') || org.toLowerCase().includes('kppsc') || org.toLowerCase().includes('peshawar');
      const isBalochistan = org.toLowerCase().includes('balochistan') || org.toLowerCase().includes('bpsc') || org.toLowerCase().includes('quetta');

      const province = isFederal ? 'Federal' : isPunjab ? 'Punjab' : isSindh ? 'Sindh' : isKpk ? 'Khyber Pakhtunkhwa' : isBalochistan ? 'Balochistan' : undefined;
      const isProvincial = isPunjab || isSindh || isKpk || isBalochistan || org.toLowerCase().includes('provincial');
      const govtCategory = isFederal ? 'Federal' : isProvincial ? 'Provincial' : undefined;

      const job: Job = {
        id: jobId,
        title: detectedTitle.includes(scale) ? detectedTitle : `${detectedTitle} (${scale})`,
        company: org,
        jobType: 'On-site',
        region: 'Pakistan',
        province,
        salary: undefined,
        currency: 'PKR',
        experienceLevel: undefined,
        department: org,
        tags: [scale, org, 'Original Gazette Document'].filter(Boolean),
        description: `Official vacancy extracted from document:\n\n${trimmedChunk.trim()}`,
        extractedText: trimmedChunk.trim(),
        requirements: qualificationSnippet ? [qualificationSnippet] : ['Refer to official advertisement for full qualification details'],
        benefits: ['Official Public Sector Remuneration and Allowances per Government Rules'],
        postedAt: 'Recent',
        applicationsCount: 0,
        status: 'Pending',
        isGovtJob: true,
        govtDepartment: org,
        govtScale: scale,
        govtCategory,
        jobCategory: 'Government Sector',
        isPdfScraped: sourceUrl.toLowerCase().endsWith('.pdf') || (fileName && fileName.endsWith('.pdf')),
        pdfFileName: fileName || (sourceUrl.split('/').pop()?.split('?')[0] || 'recruitment_ad.pdf'),
        pdfSourceUrl: sourceUrl.toLowerCase().endsWith('.pdf') ? sourceUrl : undefined,
        pdfCaseNumber: caseNumber,
        pdfTotalVacanciesInCase: vacanciesCount,
        // Structured extraction fields (STEP 66-A.3)
        advertisedPositions: [detectedTitle],
        totalVacancies: vacanciesCount,
        employmentType: explicitEmploymentType,
        ageLimit: ageLimitText,
        minimumAge: minAge,
        maximumAge: maxAge,
        qualificationSummary: qualificationSnippet,
        domicile: domicileQuota,
        contactEmail: emailMatch ? emailMatch[0] : undefined,
        domicileQuota: domicileQuota,
        ageRelaxationNote: ageRelaxationNote,
        pdfParserEngine: 'pdfplumber',
        deadlineDate: deadline,
        sourceUrl: sourceUrl,
        originalApplyUrl: explicitApplyUrl,
        applicationUrl: explicitApplyUrl,
        clippingImageUrl: mediaUrl,
        mediaUrl: mediaUrl,
        scrapedSourceDomain: domain,
        scraperSourceName: `${org} Document Engine`,
        scrapedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        paymentStatus: 'Exempt'
      };

      jobs.push(job);
    }
  }

  return jobs;
}

export interface OcrExtractionResult {
  text: string;
  jobs: Job[];
  diagnosticCode: 'OCR_SUCCESS' | 'OCR_NO_VACANCIES' | 'OCR_KEY_MISSING' | 'OCR_FAILED';
  diagnosticMessage: string;
}

/**
 * OCR Fallback extractor using Gemini Vision for scanned documents, newspaper clippings, and image files.
 * STRICT ZERO-FABRICATION RULE: Transcribes ONLY what is visually present in the image.
 */
export function classifyExtractedJobEvidence(
  rj: { title?: string; company?: string; description?: string; requirements?: string | string[]; province?: string; location?: string; bpsScale?: string }
) {
  const title = (rj.title || '').trim();
  const scale = rj.bpsScale
    ? (rj.bpsScale.toUpperCase().startsWith('BPS') ? rj.bpsScale.toUpperCase() : `BPS-${rj.bpsScale}`)
    : (title.match(/\b(BPS[- ]?\d+)\b/i)?.[1]?.toUpperCase() || undefined);

  const reqText = Array.isArray(rj.requirements) ? rj.requirements.join(' ') : (rj.requirements || '');
  const jobTextContext = `${title} ${rj.description || ''} ${reqText} ${rj.company || ''} ${rj.province || ''} ${rj.location || ''}`.toLowerCase();
  
  const hasJobSpecificGovtSignal = Boolean(
    scale ||
    /bps[- ]?\d+/i.test(jobTextContext) ||
    /(?:government|ministry|commission|fpsc|ppsc|spsc|bpsc|kppsc|wapda|nadra|public service|gazette|civil service)/i.test(jobTextContext) ||
    /(?:government|ministry|department|bureau|authority|commission)/i.test(rj.company || '')
  );

  const isGovtJob = hasJobSpecificGovtSignal ? true : undefined;

  // Derive federal/provincial strictly from job-specific evidence (title, description, company, province, location), NEVER from document-level source org
  const combinedEvidence = `${jobTextContext} ${rj.company || ''} ${rj.province || ''} ${rj.location || ''}`.toLowerCase();

  const isFederal = isGovtJob ? /(?:federal|fpsc|pakistan public service commission|cabinet secretariat|federal government)/i.test(combinedEvidence) : false;
  const isPunjab = isGovtJob ? ((rj.province || '').toLowerCase().includes('punjab') || /punjab|lahore|ppsc/i.test(combinedEvidence)) : false;
  const isSindh = isGovtJob ? ((rj.province || '').toLowerCase().includes('sindh') || /sindh|karachi|spsc/i.test(combinedEvidence)) : false;
  const isKpk = isGovtJob ? ((rj.province || '').toLowerCase().includes('kpk') || (rj.province || '').toLowerCase().includes('kp') || /kpk|khyber|peshawar|kppsc/i.test(combinedEvidence)) : false;
  const isBalochistan = isGovtJob ? ((rj.province || '').toLowerCase().includes('balochistan') || /balochistan|quetta|bpsc/i.test(combinedEvidence)) : false;

  const isProvincial = isPunjab || isSindh || isKpk || isBalochistan;

  const govtCategory: Job['govtCategory'] = isGovtJob && isFederal
    ? 'Federal'
    : isGovtJob && isProvincial
    ? 'Provincial'
    : undefined;

  const resolvedProvince = isGovtJob && isFederal
    ? 'Federal'
    : isGovtJob && isPunjab
    ? 'Punjab'
    : isGovtJob && isSindh
    ? 'Sindh'
    : isGovtJob && isKpk
    ? 'Khyber Pakhtunkhwa'
    : isGovtJob && isBalochistan
    ? 'Balochistan'
    : rj.province;

  return {
    isGovtJob,
    scale,
    govtScale: scale,
    govtCategory,
    resolvedProvince,
    jobCategory: isGovtJob ? 'Government Sector' : undefined
  };
}

export async function extractJobsFromImageWithOcr(
  imageBuffer: Buffer,
  mimeType: string,
  sourceUrl: string,
  orgName?: string,
  fileName?: string
): Promise<OcrExtractionResult> {
  const ai = getGenAI();
  if (!ai) {
    console.log('[Document OCR] Gemini API key not present for vision OCR fallback. Returning empty.');
    return {
      text: '',
      jobs: [],
      diagnosticCode: 'OCR_KEY_MISSING',
      diagnosticMessage: 'Gemini Vision API key is not configured for OCR extraction'
    };
  }

  try {
    const base64Data = imageBuffer.toString('base64');
    const prompt = `You are a strict, factual OCR recruitment document parser.
Analyze this official recruitment advertisement, gazette, newspaper clipping, or scanned page.
STRICT FACTUAL INTEGRITY MANDATE:
1. NEVER fabricate, hallucinate, synthesize, or guess any missing jobs.
2. Transcribe ONLY the genuine vacancy positions actually visible in this image.
3. Transcribe the full text verbatim, preserving headings, table structures, eligibility, quota allocations, age relaxation, and notes.
4. If no vacancy listings are present, return an empty array: {"jobs": [], "transcribedText": "..."}.
5. Return strict JSON with the schema:
{
  "transcribedText": "full raw text extracted from image",
  "jobs": [
    {
      "title": "Exact position title",
      "company": "Hiring department/organization if stated",
      "bpsScale": "e.g. BPS-17 or BS-16 if stated",
      "vacancies": 1,
      "location": "City or jurisdiction if stated",
      "province": "e.g. Federal, Punjab, Sindh, KPK, Balochistan if stated",
      "salary": "Salary or scale if stated",
      "deadline": "Application deadline if stated (e.g. 15-10-2025)",
      "requirements": "Qualifications or experience required",
      "description": "Short excerpt of details"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText);
    const transcribedText = parsed.transcribedText || '';
    const rawJobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];

    const domain = sourceUrl.startsWith('http') ? new URL(sourceUrl).hostname : 'official-source';
    const org = orgName || domain.replace('www.', '').split('.')[0].toUpperCase();

    const jobs: Job[] = rawJobs
      .filter((rj: any) => rj && rj.title && rj.title.trim().length >= 3)
      .map((rj: any, idx: number) => {
        const title = rj.title.trim();
        const classification = classifyExtractedJobEvidence(rj);
        const { isGovtJob, scale, govtCategory, resolvedProvince } = classification;

        return {
          id: `ocr-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          title: scale && !title.includes(scale) ? `${title} (${scale})` : title,
          company: rj.company || org,
          jobType: 'On-site' as const,
          region: 'Pakistan' as Region,
          province: resolvedProvince,
          city: rj.location || undefined,
          salary: rj.salary || undefined,
          currency: 'PKR' as const,
          experienceLevel: undefined,
          department: rj.company || org,
          tags: [scale, org, 'OCR Scanned Document'].filter(Boolean) as string[],
          description: rj.description || `Official vacancy extracted via high-accuracy OCR from document:\n\n${transcribedText.trim()}`,
          extractedText: transcribedText.trim(),
          requirements: rj.requirements ? [rj.requirements] : ['Refer to official advertisement for full qualification details'],
          benefits: isGovtJob ? ['Official Public Sector Remuneration and Allowances per Government Rules'] : [],
          postedAt: 'Recent',
          applicationsCount: 0,
          status: 'Pending' as const,
          isGovtJob,
          govtDepartment: isGovtJob ? (rj.company || org) : undefined,
          govtScale: scale,
          govtCategory,
          jobCategory: isGovtJob ? 'Government Sector' : undefined,
          isPdfScraped: sourceUrl.toLowerCase().endsWith('.pdf') || (fileName && fileName.endsWith('.pdf')),
          pdfFileName: fileName || (sourceUrl.split('/').pop()?.split('?')[0] || 'scanned_document.pdf'),
          pdfSourceUrl: sourceUrl.toLowerCase().endsWith('.pdf') ? sourceUrl : undefined,
          clippingImageUrl: sourceUrl,
          mediaUrl: sourceUrl,
          pdfParserEngine: 'gemini-ocr-vision',
          deadlineDate: rj.deadline || undefined,
          sourceUrl: sourceUrl,
          scrapedSourceDomain: domain,
          scraperSourceName: `${org} Document OCR Engine`,
          scrapedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          paymentStatus: 'Exempt' as const
        };
      });

    return {
      text: transcribedText,
      jobs,
      diagnosticCode: jobs.length > 0 ? 'OCR_SUCCESS' : 'OCR_NO_VACANCIES',
      diagnosticMessage: jobs.length > 0
        ? `Successfully extracted ${jobs.length} vacancies via vision OCR`
        : 'Vision OCR completed, but no vacancies were detected in the image'
    };
  } catch (ocrErr: any) {
    const rawError = String(ocrErr?.message || ocrErr || 'OCR error');
    const safeError = sanitizeSecretString(rawError);
    console.log('[Document OCR] OCR error:', safeError);
    return {
      text: '',
      jobs: [],
      diagnosticCode: 'OCR_FAILED',
      diagnosticMessage: `Vision OCR extraction failed: ${safeError}`
    };
  }
}

/**
 * Sanitizes URLs for logging and diagnostic outputs:
 * - Redacts query parameters that look like secrets, tokens, keys, passwords.
 * - Scrubs username/password credentials from URL authority.
 */
export function sanitizeUrlForLog(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    const sensitiveParamNames = [
      'key', 'apikey', 'api_key', 'token', 'auth', 'authorization',
      'secret', 'password', 'pwd', 'sig', 'signature', 'access_token'
    ];
    const keysToRedact: string[] = [];
    for (const [key, val] of Array.from(parsed.searchParams.entries())) {
      if (
        sensitiveParamNames.includes(key.toLowerCase()) ||
        /AIza[0-9A-Za-z-_]{35}/i.test(val) ||
        (val.length > 20 && /^[a-zA-Z0-9_\-\.]+$/.test(val))
      ) {
        keysToRedact.push(key);
      }
    }
    for (const key of keysToRedact) {
      parsed.searchParams.set(key, '[REDACTED]');
    }
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return sanitizeSecretString(rawUrl);
  }
}

/**
 * Sanitizes sensitive tokens, API keys, passwords, and bearer tokens from error and diagnostic strings.
 */
export function sanitizeSecretString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/([?&](?:key|api_key|apikey|token|auth|secret|signature|sig)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/(?:password|passwd|secret)[:=]\s*([^\s,;]+)/gi, 'secret=[REDACTED]');
}

export type SupportedMediaFormat = 'pdf' | 'jpeg' | 'png' | 'webp' | 'bmp' | 'html' | 'unknown';

/**
 * Robust media format detector enforcing strict binary magic bytes.
 * STRICT SAFETY RULES:
 * - A MIME header alone MUST NOT establish that arbitrary bytes are a valid supported image.
 * - Requires valid binary signatures for JPEG, PNG, WEBP, BMP, and PDF.
 * - Rejects HTML, JSON, plain text error responses, and corrupt image binaries even if server labels them image/*.
 * - Content-Type and URL extension act as supporting hints, never substitutes for binary validation.
 */
export function detectMediaFormat(
  buffer: Buffer,
  contentType: string = '',
  url: string = ''
): { format: SupportedMediaFormat; mimeType: string; isSupportedMedia: boolean } {
  const cleanType = (contentType || '').toLowerCase().split(';')[0].trim();

  if (!buffer || buffer.length === 0) {
    return { format: 'unknown', mimeType: cleanType || 'application/octet-stream', isSupportedMedia: false };
  }

  // 1. Binary Magic Bytes (Authority for binary media)

  // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D) within first 1024 bytes (standard offset tolerance)
  const headerLimit = Math.min(1024, buffer.length);
  const headerSlice = buffer.subarray(0, headerLimit);
  const pdfOffset = headerSlice.indexOf(Buffer.from('%PDF-'));
  if (pdfOffset !== -1) {
    return { format: 'pdf', mimeType: 'application/pdf', isSupportedMedia: true };
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { format: 'jpeg', mimeType: 'image/jpeg', isSupportedMedia: true };
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { format: 'png', mimeType: 'image/png', isSupportedMedia: true };
  }

  // WEBP: "RIFF" at 0..3 and "WEBP" at 8..11
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { format: 'webp', mimeType: 'image/webp', isSupportedMedia: true };
  }

  // BMP: "BM" at 0..1 (0x42 0x4D)
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return { format: 'bmp', mimeType: 'image/bmp', isSupportedMedia: true };
  }

  // 2. HTML detection (if header snippet has html tags or content-type is text/html)
  const snippet = headerSlice.toString('utf-8').toLowerCase();
  if (
    cleanType.includes('text/html') ||
    snippet.includes('<html') ||
    snippet.includes('<!doctype html') ||
    snippet.includes('<head') ||
    snippet.includes('<body')
  ) {
    return { format: 'html', mimeType: 'text/html', isSupportedMedia: true };
  }

  // 3. Reject non-image text, JSON, or invalid binary payloads even if labeled image/*
  return {
    format: 'unknown',
    mimeType: cleanType || 'application/octet-stream',
    isSupportedMedia: false
  };
}

/**
 * Downloads a document (PDF, HTML, JPG, PNG, Scanned PDF) from a URL and extracts factual job vacancies.
 * Handles transient network timeouts, non-PDF/HTML responses, and corrupt streams gracefully.
 */
export async function parsePdfFromUrl(url: string, orgName?: string): Promise<ExtractedPdfResult> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return {
      success: false,
      totalPages: 0,
      extractedJobs: [],
      rawTextSample: '',
      sourceUrl: url,
      diagnosticCode: 'INVALID_URL',
      message: 'Invalid or missing document URL'
    };
  }

  const cleanUrl = url.trim();
  const fileName = cleanUrl.split('/').pop()?.split('?')[0] || 'recruitment_ad.pdf';

  try {
    let res: Response | null = null;
    try {
      res = await safeFetchWithRetry(
        cleanUrl,
        {
          headers: {
            'Accept': 'application/pdf,image/jpeg,image/png,image/webp,text/html,application/xhtml+xml,*/*'
          }
        },
        15000,
        1
      );
    } catch (networkErr: any) {
      const detail = sanitizeSecretString(
        String(networkErr?.message || networkErr || 'offline')
          .replace(/Failed to fetch|fetch failed/gi, 'remote server unreachable')
      );
      console.log(`[Document Parser] Remote source status for ${sanitizeUrlForLog(cleanUrl)}: ${detail}`);
      return {
        success: false,
        totalPages: 0,
        extractedJobs: [],
        rawTextSample: '',
        sourceUrl: cleanUrl,
        fileName,
        diagnosticCode: 'NETWORK_ERROR',
        diagnosticDetails: detail,
        message: `Remote document unreachable (${detail})`
      };
    }

    if (!res.ok) {
      try {
        if (res.body && !res.bodyUsed && typeof res.body.cancel === 'function') {
          await res.body.cancel();
        }
      } catch {
        // Ignore stream cancel errors so HTTP error is preserved
      }
      console.log(`[Document Parser] URL responded with HTTP ${res.status} for ${sanitizeUrlForLog(cleanUrl)}`);
      return {
        success: false,
        totalPages: 0,
        extractedJobs: [],
        rawTextSample: '',
        sourceUrl: cleanUrl,
        fileName,
        diagnosticCode: 'HTTP_ERROR',
        diagnosticDetails: `HTTP ${res.status} ${res.statusText}`,
        message: `Failed to download document. Server responded with HTTP ${res.status} (${res.statusText})`
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const MAX_REMOTE_PDF_BYTES = 15 * 1024 * 1024;

    const contentLengthHeader = res.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(contentLength) && contentLength > MAX_REMOTE_PDF_BYTES) {
        try {
          if (res.body && !res.bodyUsed && typeof res.body.cancel === 'function') {
            await res.body.cancel();
          }
        } catch {
          // Ignore stream cancel errors
        }
        return {
          success: false,
          totalPages: 0,
          extractedJobs: [],
          rawTextSample: '',
          sourceUrl: cleanUrl,
          fileName,
          diagnosticCode: 'OVERSIZED_DOCUMENT',
          message: 'Document exceeds maximum supported size (15 MB)'
        };
      }
    }

    let buffer: Buffer;
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let streamClosedOrCancelled = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamClosedOrCancelled = true;
            break;
          }
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > MAX_REMOTE_PDF_BYTES) {
              streamClosedOrCancelled = true;
              try {
                await reader.cancel('Document exceeded maximum supported size (15 MB)');
              } catch {
                // Ignore stream cancel errors
              }
              return {
                success: false,
                totalPages: 0,
                extractedJobs: [],
                rawTextSample: '',
                sourceUrl: cleanUrl,
                fileName,
                diagnosticCode: 'OVERSIZED_DOCUMENT',
                message: 'Document exceeds maximum supported size (15 MB)'
              };
            }
            chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
          }
        }
      } catch (readErr) {
        if (!streamClosedOrCancelled) {
          streamClosedOrCancelled = true;
          try {
            await reader.cancel();
          } catch {
            // Ignore stream cancel errors so original read error is preserved
          }
        }
        throw readErr;
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Ignore lock release errors
        }
      }

      buffer = Buffer.concat(chunks, totalBytes);
    } else {
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_REMOTE_PDF_BYTES) {
        return {
          success: false,
          totalPages: 0,
          extractedJobs: [],
          rawTextSample: '',
          sourceUrl: cleanUrl,
          fileName,
          diagnosticCode: 'OVERSIZED_DOCUMENT',
          message: 'Document exceeds maximum supported size (15 MB)'
        };
      }
      buffer = Buffer.from(arrayBuffer);
    }

    if (buffer.length === 0) {
      return {
        success: false,
        totalPages: 0,
        extractedJobs: [],
        rawTextSample: '',
        sourceUrl: cleanUrl,
        fileName,
        diagnosticCode: 'EMPTY_RESPONSE',
        message: 'Empty response received from document URL'
      };
    }

    // Inspect media format accurately via magic bytes & headers
    const detected = detectMediaFormat(buffer, contentType, cleanUrl);
    const headerSnippet = buffer.subarray(0, Math.min(1024, buffer.length));
    const isPdfBinary = detected.format === 'pdf' || headerSnippet.includes(Buffer.from('%PDF-'));

    // Check if the requested document URL was expected to be an image
    const isExpectedImage = /\.(jpg|jpeg|png|webp|bmp)$/i.test(cleanUrl.split('?')[0]);
    if (isExpectedImage && !['jpeg', 'png', 'webp', 'bmp'].includes(detected.format)) {
      // Remote server returned an HTML error page, JSON, or corrupt binary for an image URL
      return {
        success: false,
        totalPages: 0,
        extractedJobs: [],
        rawTextSample: '',
        sourceUrl: cleanUrl,
        fileName,
        formatType: 'image',
        diagnosticCode: 'INVALID_MEDIA_TYPE',
        diagnosticDetails: `Expected image binary for ${fileName} but received ${detected.format === 'html' ? 'HTML page' : detected.mimeType || 'unknown format'}`,
        message: 'Unsupported document format. Server returned non-image content for image URL.'
      };
    }

    // 1. Image document (JPG / JPEG / PNG / WEBP / BMP) -> Vision OCR
    if (['jpeg', 'png', 'webp', 'bmp'].includes(detected.format)) {
      const ocrRes = await extractJobsFromImageWithOcr(buffer, detected.mimeType, cleanUrl, orgName, fileName);
      if (ocrRes.diagnosticCode === 'OCR_KEY_MISSING') {
        return {
          success: false,
          totalPages: 1,
          extractedJobs: [],
          rawTextSample: '',
          fullExtractedText: '',
          sourceUrl: cleanUrl,
          fileName,
          mediaUrl: cleanUrl,
          clippingImageUrl: cleanUrl,
          formatType: 'image',
          diagnosticCode: 'IMAGE_OCR_KEY_MISSING',
          diagnosticDetails: ocrRes.diagnosticMessage,
          message: 'Image document requires vision OCR, but Gemini API key is not configured.'
        };
      }

      if (ocrRes.diagnosticCode === 'OCR_FAILED') {
        return {
          success: false,
          totalPages: 1,
          extractedJobs: [],
          rawTextSample: '',
          fullExtractedText: '',
          sourceUrl: cleanUrl,
          fileName,
          mediaUrl: cleanUrl,
          clippingImageUrl: cleanUrl,
          formatType: 'image',
          diagnosticCode: 'IMAGE_OCR_FAILED',
          diagnosticDetails: ocrRes.diagnosticMessage,
          message: `Image OCR processing failed: ${ocrRes.diagnosticMessage}`
        };
      }

      return {
        success: ocrRes.jobs.length > 0,
        totalPages: 1,
        extractedJobs: ocrRes.jobs,
        rawTextSample: ocrRes.text,
        fullExtractedText: ocrRes.text,
        sourceUrl: cleanUrl,
        fileName,
        mediaUrl: cleanUrl,
        clippingImageUrl: cleanUrl,
        formatType: 'image',
        diagnosticCode: ocrRes.jobs.length > 0 ? 'IMAGE_OCR_SUCCESS' : 'IMAGE_OCR_NO_VACANCIES',
        diagnosticDetails: ocrRes.diagnosticMessage,
        message: ocrRes.jobs.length > 0
          ? `Extracted ${ocrRes.jobs.length} verified vacancies from image via OCR.`
          : 'Image document analyzed via OCR, but no structured vacancies detected.'
      };
    }

    // 2. HTML Fallback
    if (detected.format === 'html' && !isPdfBinary) {
      const htmlText = buffer.toString('utf-8');
      const $ = cheerio.load(htmlText);
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      const jobs = extractJobsFromPdfText(text, cleanUrl, orgName, fileName);

      return {
        success: jobs.length > 0,
        totalPages: 1,
        extractedJobs: jobs,
        rawTextSample: text,
        fullExtractedText: text,
        sourceUrl: cleanUrl,
        fileName,
        formatType: 'html',
        diagnosticCode: jobs.length > 0 ? 'HTML_TEXT_SUCCESS' : 'HTML_TEXT_NO_VACANCIES',
        message: jobs.length > 0
          ? `Extracted ${jobs.length} vacancies from HTML page.`
          : 'HTML web page loaded, but no standard vacancy listings found in text.'
      };
    }

    // 3. Binary PDF -> text extraction with fallback to OCR for scanned PDFs
    if (isPdfBinary || cleanUrl.toLowerCase().split('?')[0].endsWith('.pdf')) {
      let text = '';
      let totalPages = 1;
      let pdfParseFailed = false;
      let formattedTablesText = '';

      try {
        const parser = new PDFParse({ data: buffer });
        const parsedData = await parser.getText();
        text = parsedData.text || '';
        totalPages = parsedData.total || 1;

        // Extract and format multi-column PDF tables to preserve row/column relationships
        try {
          const tableData = await parser.getTable();
          if (tableData && Array.isArray((tableData as any).pages)) {
            const tableSnippets: string[] = [];
            for (const page of (tableData as any).pages) {
              if (Array.isArray(page.tables) && page.tables.length > 0) {
                for (let tIdx = 0; tIdx < page.tables.length; tIdx++) {
                  const mdTable = formatTableToMarkdown(page.tables[tIdx]);
                  if (mdTable) {
                    tableSnippets.push(`[Page ${page.num} - Table ${tIdx + 1}]\n${mdTable}`);
                  }
                }
              }
            }
            if (tableSnippets.length > 0) {
              formattedTablesText = '\n\n### Extracted Document Tables\n\n' + tableSnippets.join('\n\n');
            }
          }
        } catch (tableErr) {
          console.log('[Document Parser] Structured table parsing note:', tableErr);
        }

        await parser.destroy();
      } catch (parseError: any) {
        console.log(`[Document Parser] PDF binary text decoding issue: ${parseError?.message || parseError}`);
        pdfParseFailed = true;
      }

      const fullCombinedText = (text + formattedTablesText).trim();

      // If text is extracted successfully and has substantial content, parse directly
      if (!pdfParseFailed && fullCombinedText.length >= 50) {
        const jobs = extractJobsFromPdfText(fullCombinedText, cleanUrl, orgName, fileName);
        return {
          success: true,
          totalPages,
          extractedJobs: jobs,
          rawTextSample: fullCombinedText,
          fullExtractedText: fullCombinedText,
          sourceUrl: cleanUrl,
          fileName,
          formatType: 'pdf',
          diagnosticCode: jobs.length > 0 ? 'PDF_TEXT_SUCCESS' : 'PDF_TEXT_ZERO_VACANCIES',
          message: jobs.length > 0 
            ? `Successfully extracted ${jobs.length} original vacancies from PDF.`
            : `PDF processed (${totalPages} pages), but no structured vacancy listings were detected. No synthetic data was generated.`
        };
      }

      // Scanned PDF / Image-only PDF -> Fallback OCR
      console.log(`[Document Parser] PDF contains minimal or image-only text (${text.length} chars). Invoking OCR fallback...`);
      const ocrRes = await extractJobsFromImageWithOcr(buffer, 'application/pdf', cleanUrl, orgName, fileName);

      if (ocrRes.diagnosticCode === 'OCR_KEY_MISSING') {
        return {
          success: false,
          totalPages,
          extractedJobs: [],
          rawTextSample: fullCombinedText,
          fullExtractedText: fullCombinedText,
          sourceUrl: cleanUrl,
          fileName,
          formatType: 'scanned_pdf',
          diagnosticCode: 'PDF_SCANNED_OCR_KEY_MISSING',
          diagnosticDetails: ocrRes.diagnosticMessage,
          message: 'Scanned PDF requires vision OCR, but Gemini API key is not configured.'
        };
      }

      if (ocrRes.diagnosticCode === 'OCR_FAILED') {
        return {
          success: false,
          totalPages,
          extractedJobs: [],
          rawTextSample: fullCombinedText,
          fullExtractedText: fullCombinedText,
          sourceUrl: cleanUrl,
          fileName,
          formatType: 'scanned_pdf',
          diagnosticCode: 'PDF_SCANNED_OCR_FAILED',
          diagnosticDetails: ocrRes.diagnosticMessage,
          message: `Scanned PDF OCR processing failed: ${ocrRes.diagnosticMessage}`
        };
      }

      const combinedOcrText = (ocrRes.text || fullCombinedText).trim();
      const extractedJobs = ocrRes.jobs.length > 0 ? ocrRes.jobs : extractJobsFromPdfText(combinedOcrText, cleanUrl, orgName, fileName);

      return {
        success: extractedJobs.length > 0 || combinedOcrText.length > 0,
        totalPages,
        extractedJobs,
        rawTextSample: combinedOcrText,
        fullExtractedText: combinedOcrText,
        sourceUrl: cleanUrl,
        fileName,
        formatType: 'scanned_pdf',
        diagnosticCode: extractedJobs.length > 0 ? 'PDF_SCANNED_FALLBACK_SUCCESS' : 'PDF_SCANNED_FALLBACK_NO_VACANCIES',
        diagnosticDetails: ocrRes.diagnosticMessage,
        message: extractedJobs.length > 0
          ? `Extracted ${extractedJobs.length} vacancies from scanned PDF via OCR.`
          : `PDF processed (${totalPages} pages). No structured vacancies detected.`
      };
    }

    // Default: unsupported or unknown binary format
    return {
      success: false,
      totalPages: 0,
      extractedJobs: [],
      rawTextSample: '',
      sourceUrl: cleanUrl,
      fileName,
      diagnosticCode: 'INVALID_MEDIA_TYPE',
      message: 'Unsupported document format. Only PDF, JPG, PNG, WEBP, and BMP are supported.'
    };
  } catch (error: any) {
    const detail = sanitizeSecretString(
      String(error?.message || error || 'processing note')
        .replace(/Failed to fetch|fetch failed/gi, 'remote server unreachable')
    );
    console.log(`[Document Parser] Processing note for ${sanitizeUrlForLog(cleanUrl)}: ${detail}`);
    return {
      success: false,
      totalPages: 0,
      extractedJobs: [],
      rawTextSample: '',
      sourceUrl: cleanUrl,
      fileName,
      diagnosticCode: 'NETWORK_ERROR',
      diagnosticDetails: detail,
      message: `Error reading document: ${detail}`
    };
  }
}

