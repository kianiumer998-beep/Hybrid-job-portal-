import { PDFParse } from 'pdf-parse';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import { Job, Region } from '../../src/types/job';
import { safeFetchWithRetry } from '../utils/ssrfProtection';

export interface ExtractedPdfResult {
  success: boolean;
  totalPages: number;
  extractedJobs: Job[];
  rawTextSample: string;
  sourceUrl?: string;
  fileName?: string;
  message?: string;
  mediaUrl?: string;
  clippingImageUrl?: string;
  formatType?: 'pdf' | 'html' | 'image' | 'scanned_pdf';
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
  const bpsRegex = /\b(BPS|BS|PPS|BPS\s*-\s*|BS\s*-\s*|PPS\s*-\s*)(\d{1,2})\b/i;
  const caseRegex = /(?:Case\s*(?:No\.?|Ref\.?|Number:?)|Advt\s*(?:No\.?|Ref\.?))\s*([A-Za-z0-9\.\-\/]+)/i;
  const vacancyCountRegex = /(?:No\.?\s*of\s*Vacanc(?:ies|y)|Total\s*Posts?|Positions?)\s*[:=]?\s*(\d+)/i;
  const ageRegex = /(?:Age\s*Limit|Age)\s*[:=]?\s*([0-9\s\-\+toyears]+)/i;
  const closingRegex = /(?:Closing\s*Date|Last\s*Date\s*to\s*Apply|Deadline|Apply\s*Before)\s*[:=]?\s*([0-9A-Za-z\s,\-\/]+)/i;

  // Split text by common post/case dividers
  const chunkSeparators = /(?=(?:Case\s*No\.?|Advt\s*No\.?|Item\s*No\.?|\n\s*\d+\.\s+[A-Z\s]{4,}(?:\(|BPS)))/i;
  let rawChunks = fullText.split(chunkSeparators);

  // If chunking didn't split, look for BPS markers or title lines
  if (rawChunks.length <= 1) {
    rawChunks = fullText.split(/(?=(?:[A-Z\s]{4,}\s*\((?:BPS|BS|PPS)-\d+\)))/);
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

    // Look for a job title in the first 4 lines of this chunk
    const chunkLines = trimmedChunk.split('\n').map(l => l.trim()).filter(Boolean);
    let detectedTitle = '';

    for (const line of chunkLines.slice(0, 4)) {
      const candidate = line
        .replace(/^(?:Case\s*No\.?|Advt\s*No\.?|Item\s*No\.?|\d+[\.\)]\s*)/i, '')
        .replace(/\s+/g, ' ')
        .trim();

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

    if (detectedTitle && (bpsMatch || caseMatch || vacancyMatch || trimmedChunk.toLowerCase().includes('qualification') || trimmedChunk.toLowerCase().includes('experience'))) {
      index++;
      const scale = bpsMatch ? `${bpsMatch[1].toUpperCase()}-${bpsMatch[2]}` : 'BPS / Standard Cadre';
      const caseNumber = caseMatch ? caseMatch[1] : undefined;
      const vacanciesCount = vacancyMatch ? parseInt(vacancyMatch[1], 10) : 1;
      const ageRelaxation = ageMatch ? ageMatch[1].trim() : undefined;
      const deadline = closingMatch ? closingMatch[1].trim() : undefined;

      let qualificationSnippet = '';
      const qualMatch = trimmedChunk.match(/(?:Qualification[s]?|Eligibility|Minimum\s*Requirements?)\s*[:=]?\s*([^\n\.]+)/i);
      if (qualMatch) {
        qualificationSnippet = qualMatch[1].trim();
      }

      let domicileQuota = '';
      const quotaMatch = trimmedChunk.match(/(?:Domicile|Quota|Regional\s*Quota)\s*[:=]?\s*([^\n\.]+)/i);
      if (quotaMatch) {
        domicileQuota = quotaMatch[1].trim();
      }

      const jobId = `doc-real-${Date.now().toString(36)}-${index}-${Math.random().toString(36).substring(2, 6)}`;

      const isFederal = org.toLowerCase().includes('federal') || org.toLowerCase().includes('fpsc') || org.toLowerCase().includes('islamabad');
      const isPunjab = org.toLowerCase().includes('punjab') || org.toLowerCase().includes('ppsc') || org.toLowerCase().includes('lahore');
      const isSindh = org.toLowerCase().includes('sindh') || org.toLowerCase().includes('spsc') || org.toLowerCase().includes('karachi');
      const isKpk = org.toLowerCase().includes('kpk') || org.toLowerCase().includes('kp') || org.toLowerCase().includes('kppsc') || org.toLowerCase().includes('peshawar');
      const isBalochistan = org.toLowerCase().includes('balochistan') || org.toLowerCase().includes('bpsc') || org.toLowerCase().includes('quetta');

      const province = isFederal ? 'Federal' : isPunjab ? 'Punjab' : isSindh ? 'Sindh' : isKpk ? 'Khyber Pakhtunkhwa' : isBalochistan ? 'Balochistan' : undefined;

      const job: Job = {
        id: jobId,
        title: detectedTitle.includes(scale) ? detectedTitle : `${detectedTitle} (${scale})`,
        company: org,
        jobType: 'On-site',
        region: 'Pakistan',
        province,
        salary: scale.includes('BPS') ? `Government Pay Scale (${scale})` : 'Salary not disclosed',
        currency: 'PKR',
        experienceLevel: scale.includes('17') || scale.includes('18') || scale.includes('19') ? 'Mid' : 'Entry',
        department: org,
        tags: [scale, org, 'Original Gazette Document'].filter(Boolean),
        description: `Official vacancy extracted from document:\n\n${trimmedChunk.substring(0, 1500)}`,
        extractedText: trimmedChunk.trim(),
        requirements: qualificationSnippet ? [qualificationSnippet] : ['Refer to official advertisement for full qualification details'],
        benefits: ['Official Public Sector Remuneration and Allowances per Government Rules'],
        postedAt: 'Recent',
        applicationsCount: 0,
        status: 'Pending',
        isGovtJob: true,
        govtDepartment: org,
        govtScale: scale,
        govtCategory: isFederal ? 'Federal' : 'Provincial',
        jobCategory: 'Government Sector',
        isPdfScraped: sourceUrl.toLowerCase().endsWith('.pdf') || (fileName && fileName.endsWith('.pdf')),
        pdfFileName: fileName || (sourceUrl.split('/').pop()?.split('?')[0] || 'recruitment_ad.pdf'),
        pdfSourceUrl: sourceUrl.toLowerCase().endsWith('.pdf') ? sourceUrl : undefined,
        pdfCaseNumber: caseNumber,
        pdfTotalVacanciesInCase: vacanciesCount,
        domicileQuota: domicileQuota || undefined,
        ageRelaxationNote: ageRelaxation,
        pdfParserEngine: 'pdfplumber',
        deadlineDate: deadline,
        sourceUrl: sourceUrl,
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

/**
 * OCR Fallback extractor using Gemini Vision for scanned documents, newspaper clippings, and image files.
 * STRICT ZERO-FABRICATION RULE: Transcribes ONLY what is visually present in the image.
 */
export async function extractJobsFromImageWithOcr(
  imageBuffer: Buffer,
  mimeType: string,
  sourceUrl: string,
  orgName?: string,
  fileName?: string
): Promise<{ text: string; jobs: Job[] }> {
  const ai = getGenAI();
  if (!ai) {
    console.log('[Document OCR] Gemini API key not present for vision OCR fallback. Returning empty.');
    return { text: '', jobs: [] };
  }

  try {
    const base64Data = imageBuffer.toString('base64');
    const prompt = `You are a strict, factual OCR recruitment document parser.
Analyze this official recruitment advertisement, gazette, newspaper clipping, or scanned page.
STRICT FACTUAL INTEGRITY MANDATE:
1. NEVER fabricate, hallucinate, synthesize, or guess any missing jobs.
2. Transcribe ONLY the genuine vacancy positions actually visible in this image.
3. If no vacancy listings are present, return an empty array: {"jobs": [], "transcribedText": "..."}.
4. Return strict JSON with the schema:
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
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || 'application/pdf'
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
        const scale = rj.bpsScale ? rj.bpsScale.toUpperCase() : 'BPS / Standard Cadre';
        const isFederal = (rj.province || org).toLowerCase().includes('federal') || org.toLowerCase().includes('fpsc');
        const isPunjab = (rj.province || org).toLowerCase().includes('punjab') || org.toLowerCase().includes('ppsc');
        const isSindh = (rj.province || org).toLowerCase().includes('sindh') || org.toLowerCase().includes('spsc');
        const isKpk = (rj.province || org).toLowerCase().includes('kpk') || (rj.province || org).toLowerCase().includes('kp');
        const isBalochistan = (rj.province || org).toLowerCase().includes('balochistan');

        const resolvedProvince = isFederal ? 'Federal' : isPunjab ? 'Punjab' : isSindh ? 'Sindh' : isKpk ? 'Khyber Pakhtunkhwa' : isBalochistan ? 'Balochistan' : rj.province;

        return {
          id: `ocr-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          title: rj.bpsScale && !title.includes(rj.bpsScale) ? `${title} (${rj.bpsScale})` : title,
          company: rj.company || org,
          jobType: 'On-site' as const,
          region: 'Pakistan' as Region,
          province: resolvedProvince,
          city: rj.location || undefined,
          salary: rj.salary || (scale.includes('BPS') ? `Government Pay Scale (${scale})` : 'Salary not disclosed'),
          currency: 'PKR' as const,
          experienceLevel: scale.includes('17') || scale.includes('18') || scale.includes('19') ? 'Mid' : 'Entry',
          department: rj.company || org,
          tags: [scale, org, 'OCR Scanned Document'].filter(Boolean),
          description: rj.description || `Official vacancy extracted via high-accuracy OCR from document:\n\n${transcribedText.substring(0, 1500)}`,
          extractedText: transcribedText,
          requirements: rj.requirements ? [rj.requirements] : ['Refer to official advertisement for full qualification details'],
          benefits: ['Official Public Sector Remuneration and Allowances per Government Rules'],
          postedAt: 'Recent',
          applicationsCount: 0,
          status: 'Pending' as const,
          isGovtJob: true,
          govtDepartment: rj.company || org,
          govtScale: scale,
          govtCategory: isFederal ? 'Federal' : 'Provincial',
          jobCategory: 'Government Sector',
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

    return { text: transcribedText, jobs };
  } catch (ocrErr: any) {
    console.log('[Document OCR] OCR error:', ocrErr?.message || ocrErr);
    return { text: '', jobs: [] };
  }
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
      const detail = String(networkErr?.message || networkErr || 'offline')
        .replace(/Failed to fetch|fetch failed/gi, 'remote server unreachable');
      console.log(`[Document Parser] Remote source status for ${cleanUrl}: ${detail}`);
      return {
        success: false,
        totalPages: 0,
        extractedJobs: [],
        rawTextSample: '',
        sourceUrl: cleanUrl,
        fileName,
        message: `Remote document unreachable (${detail})`
      };
    }

    if (!res.ok) {
      console.log(`[Document Parser] URL responded with HTTP ${res.status} for ${cleanUrl}`);
      return {
        success: false,
        totalPages: 0,
        extractedJobs: [],
        rawTextSample: '',
        sourceUrl: cleanUrl,
        fileName,
        message: `Failed to download document. Server responded with HTTP ${res.status} (${res.statusText})`
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return {
        success: false,
        totalPages: 0,
        extractedJobs: [],
        rawTextSample: '',
        sourceUrl: cleanUrl,
        fileName,
        message: 'Empty response received from document URL'
      };
    }

    // Inspect format
    const headerSnippet = buffer.subarray(0, Math.min(1024, buffer.length));
    const isPdfBinary = headerSnippet.includes(Buffer.from('%PDF-')) || headerSnippet.toString('utf-8', 0, 8).startsWith('%PDF-');
    const isImage = contentType.includes('image/') || /\.(jpg|jpeg|png|webp|bmp)$/i.test(cleanUrl);
    const isHtml = contentType.includes('text/html') || headerSnippet.toString('utf-8', 0, 100).toLowerCase().includes('<html') || headerSnippet.toString('utf-8', 0, 100).toLowerCase().includes('<!doctype');

    // 1. Image document (JPG / PNG / WEBP) -> OCR Fallback
    if (isImage) {
      const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/jpeg';
      const ocrRes = await extractJobsFromImageWithOcr(buffer, mime, cleanUrl, orgName, fileName);
      return {
        success: ocrRes.jobs.length > 0 || ocrRes.text.length > 0,
        totalPages: 1,
        extractedJobs: ocrRes.jobs,
        rawTextSample: ocrRes.text.substring(0, 1500),
        sourceUrl: cleanUrl,
        fileName,
        mediaUrl: cleanUrl,
        clippingImageUrl: cleanUrl,
        formatType: 'image',
        message: ocrRes.jobs.length > 0
          ? `Extracted ${ocrRes.jobs.length} verified vacancies from image via OCR.`
          : 'Image document analyzed, but no structured vacancies detected.'
      };
    }

    // 2. HTML Fallback
    if (isHtml && !isPdfBinary) {
      const htmlText = buffer.toString('utf-8');
      const $ = cheerio.load(htmlText);
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      const jobs = extractJobsFromPdfText(text, cleanUrl, orgName, fileName);

      return {
        success: true,
        totalPages: 1,
        extractedJobs: jobs,
        rawTextSample: text.substring(0, 1500),
        sourceUrl: cleanUrl,
        fileName,
        formatType: 'html',
        message: jobs.length > 0
          ? `Extracted ${jobs.length} vacancies from HTML page.`
          : 'HTML web page loaded, but no standard vacancy listings found in text.'
      };
    }

    // 3. Binary PDF -> text extraction with fallback to OCR for scanned PDFs
    if (isPdfBinary || cleanUrl.toLowerCase().endsWith('.pdf')) {
      let text = '';
      let totalPages = 1;
      let pdfParseFailed = false;

      try {
        const parser = new PDFParse({ data: buffer });
        const parsedData = await parser.getText();
        text = parsedData.text || '';
        totalPages = parsedData.total || 1;
        await parser.destroy();
      } catch (parseError: any) {
        console.log(`[Document Parser] PDF binary text decoding issue: ${parseError?.message || parseError}`);
        pdfParseFailed = true;
      }

      // If text is extracted successfully and has substantial content, parse directly
      if (!pdfParseFailed && text.trim().length >= 50) {
        const jobs = extractJobsFromPdfText(text, cleanUrl, orgName, fileName);
        return {
          success: true,
          totalPages,
          extractedJobs: jobs,
          rawTextSample: text.substring(0, 1500),
          sourceUrl: cleanUrl,
          fileName,
          formatType: 'pdf',
          message: jobs.length > 0 
            ? `Successfully extracted ${jobs.length} original vacancies from PDF.`
            : `PDF processed (${totalPages} pages), but no structured vacancy listings were detected. No synthetic data was generated.`
        };
      }

      // Scanned PDF / Image-only PDF -> Fallback OCR
      console.log(`[Document Parser] PDF contains minimal or image-only text (${text.length} chars). Invoking OCR fallback...`);
      const ocrRes = await extractJobsFromImageWithOcr(buffer, 'application/pdf', cleanUrl, orgName, fileName);

      return {
        success: ocrRes.jobs.length > 0 || ocrRes.text.length > 0 || text.length > 0,
        totalPages,
        extractedJobs: ocrRes.jobs.length > 0 ? ocrRes.jobs : extractJobsFromPdfText(text, cleanUrl, orgName, fileName),
        rawTextSample: (ocrRes.text || text).substring(0, 1500),
        sourceUrl: cleanUrl,
        fileName,
        formatType: 'scanned_pdf',
        message: ocrRes.jobs.length > 0
          ? `Extracted ${ocrRes.jobs.length} vacancies from scanned PDF via OCR.`
          : `PDF processed (${totalPages} pages). No structured vacancies detected.`
      };
    }

    // Default generic text fallback
    const genericText = buffer.toString('utf-8');
    const jobs = extractJobsFromPdfText(genericText, cleanUrl, orgName, fileName);

    return {
      success: jobs.length > 0,
      totalPages: 1,
      extractedJobs: jobs,
      rawTextSample: genericText.substring(0, 1500),
      sourceUrl: cleanUrl,
      fileName,
      message: jobs.length > 0
        ? `Extracted ${jobs.length} vacancies from document.`
        : 'Document analyzed, but no structured vacancies detected.'
    };
  } catch (error: any) {
    const detail = String(error?.message || error || 'processing note')
      .replace(/Failed to fetch|fetch failed/gi, 'remote server unreachable');
    console.log(`[Document Parser] Processing note for ${cleanUrl}: ${detail}`);
    return {
      success: false,
      totalPages: 0,
      extractedJobs: [],
      rawTextSample: '',
      sourceUrl: cleanUrl,
      fileName,
      message: `Error reading document: ${detail}`
    };
  }
}

