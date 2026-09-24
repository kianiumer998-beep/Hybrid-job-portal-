import { Job, Region } from '../types/job';
import { isScrapedJob } from './jobValidation';

export interface LocationSuggestion {
  city?: string;
  province?: string;
  district?: string;
  region: Region;
}

export interface JobSuggestionResult {
  isScrapedJob: boolean;
  detectedLocation: LocationSuggestion;
  suggestedRegion: Region;
  suggestedProvince?: string;
  suggestedCity?: string;
  suggestedDistrict?: string;
  existingLocationStr?: string;
  suggestedLocationStr?: string;
  suggestedCategory: string;
  suggestedGovtCategory?: 'Federal' | 'Provincial' | 'Defense' | 'Healthcare' | 'Education' | 'Public Sector';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  hasConflict: boolean;
  conflictDetails?: string;
  reasons: string[];
  missingFields: string[];
}

// ============================================================================
// PAKISTAN GEOGRAPHY MAP (PROVINCE & CITY)
// ============================================================================

interface CityProvinceMap {
  [city: string]: {
    province: string;
  };
}

const PAKISTAN_CITY_MAP: CityProvinceMap = {
  // Punjab
  'lahore': { province: 'Punjab' },
  'rawalpindi': { province: 'Punjab' },
  'faisalabad': { province: 'Punjab' },
  'multan': { province: 'Punjab' },
  'gujranwala': { province: 'Punjab' },
  'sialkot': { province: 'Punjab' },
  'bahawalpur': { province: 'Punjab' },
  'sargodha': { province: 'Punjab' },
  'sheikhupura': { province: 'Punjab' },
  'jhang': { province: 'Punjab' },
  'rahim yar khan': { province: 'Punjab' },
  'gujrat': { province: 'Punjab' },
  'kasur': { province: 'Punjab' },
  'sahiwal': { province: 'Punjab' },
  'okara': { province: 'Punjab' },
  'attock': { province: 'Punjab' },
  'chakwal': { province: 'Punjab' },
  'jhelum': { province: 'Punjab' },
  'dera ghazi khan': { province: 'Punjab' },
  'dg khan': { province: 'Punjab' },
  'muzaffargarh': { province: 'Punjab' },
  'layyah': { province: 'Punjab' },
  'mianwali': { province: 'Punjab' },
  'bhakkar': { province: 'Punjab' },
  'khushab': { province: 'Punjab' },
  'chiniot': { province: 'Punjab' },
  'toba tek singh': { province: 'Punjab' },
  'vehari': { province: 'Punjab' },
  'khanewal': { province: 'Punjab' },
  'lodhran': { province: 'Punjab' },
  'bahawalnagar': { province: 'Punjab' },
  'nankana sahib': { province: 'Punjab' },
  'narowal': { province: 'Punjab' },
  'hafizabad': { province: 'Punjab' },
  'mandi bahauddin': { province: 'Punjab' },
  'murree': { province: 'Punjab' },

  // Sindh
  'karachi': { province: 'Sindh' },
  'hyderabad': { province: 'Sindh' },
  'sukkur': { province: 'Sindh' },
  'larkana': { province: 'Sindh' },
  'nawabshah': { province: 'Sindh' },
  'shaheed benazirabad': { province: 'Sindh' },
  'mirpurkhas': { province: 'Sindh' },
  'thatta': { province: 'Sindh' },
  'badin': { province: 'Sindh' },
  'jacobabad': { province: 'Sindh' },
  'shikarpur': { province: 'Sindh' },
  'khairpur': { province: 'Sindh' },
  'ghotki': { province: 'Sindh' },
  'dadu': { province: 'Sindh' },
  'jamshoro': { province: 'Sindh' },
  'umerkot': { province: 'Sindh' },
  'sanghar': { province: 'Sindh' },
  'naushahro feroze': { province: 'Sindh' },
  'tando allahyar': { province: 'Sindh' },
  'tando muhammad khan': { province: 'Sindh' },
  'sujawal': { province: 'Sindh' },
  'kashmore': { province: 'Sindh' },

  // Khyber Pakhtunkhwa (KP)
  'peshawar': { province: 'Khyber Pakhtunkhwa' },
  'mardan': { province: 'Khyber Pakhtunkhwa' },
  'mingora': { province: 'Khyber Pakhtunkhwa' },
  'swat': { province: 'Khyber Pakhtunkhwa' },
  'kohat': { province: 'Khyber Pakhtunkhwa' },
  'abbottabad': { province: 'Khyber Pakhtunkhwa' },
  'bannu': { province: 'Khyber Pakhtunkhwa' },
  'dera ismail khan': { province: 'Khyber Pakhtunkhwa' },
  'di khan': { province: 'Khyber Pakhtunkhwa' },
  'charsadda': { province: 'Khyber Pakhtunkhwa' },
  'swabi': { province: 'Khyber Pakhtunkhwa' },
  'nowshera': { province: 'Khyber Pakhtunkhwa' },
  'mansehra': { province: 'Khyber Pakhtunkhwa' },
  'haripur': { province: 'Khyber Pakhtunkhwa' },
  'dir': { province: 'Khyber Pakhtunkhwa' },
  'chitral': { province: 'Khyber Pakhtunkhwa' },
  'malakand': { province: 'Khyber Pakhtunkhwa' },
  'tank': { province: 'Khyber Pakhtunkhwa' },
  'lakki marwat': { province: 'Khyber Pakhtunkhwa' },
  'karak': { province: 'Khyber Pakhtunkhwa' },
  'hangu': { province: 'Khyber Pakhtunkhwa' },
  'bajaur': { province: 'Khyber Pakhtunkhwa' },
  'khyber': { province: 'Khyber Pakhtunkhwa' },
  'kurram': { province: 'Khyber Pakhtunkhwa' },
  'waziristan': { province: 'Khyber Pakhtunkhwa' },

  // Balochistan
  'quetta': { province: 'Balochistan' },
  'turbat': { province: 'Balochistan' },
  'kech': { province: 'Balochistan' },
  'khuzdar': { province: 'Balochistan' },
  'hub': { province: 'Balochistan' },
  'chaman': { province: 'Balochistan' },
  'gwadar': { province: 'Balochistan' },
  'sibi': { province: 'Balochistan' },
  'zhob': { province: 'Balochistan' },
  'loralai': { province: 'Balochistan' },
  'nushki': { province: 'Balochistan' },
  'kalat': { province: 'Balochistan' },
  'mastung': { province: 'Balochistan' },
  'pishin': { province: 'Balochistan' },
  'jaffarabad': { province: 'Balochistan' },
  'nasirabad': { province: 'Balochistan' },

  // Federal / ICT
  'islamabad': { province: 'Federal' },
  'ict': { province: 'Federal' },

  // Azad Jammu & Kashmir (AJK)
  'muzaffarabad': { province: 'AJK' },
  'mirpur': { province: 'AJK' },
  'rawalakot': { province: 'AJK' },
  'kotli': { province: 'AJK' },
  'bhimber': { province: 'AJK' },
  'bagh': { province: 'AJK' },

  // Gilgit-Baltistan (GB)
  'gilgit': { province: 'Gilgit-Baltistan' },
  'skardu': { province: 'Gilgit-Baltistan' },
  'hunza': { province: 'Gilgit-Baltistan' }
};

// ============================================================================
// INTERNATIONAL CITY TO REGION MAP
// ============================================================================

interface InternationalCityMap {
  [city: string]: {
    region: Region;
    cityName: string;
  };
}

const INTERNATIONAL_CITY_MAP: InternationalCityMap = {
  // UAE
  'dubai': { region: 'UAE', cityName: 'Dubai' },
  'abu dhabi': { region: 'UAE', cityName: 'Abu Dhabi' },
  'sharjah': { region: 'UAE', cityName: 'Sharjah' },
  'ajman': { region: 'UAE', cityName: 'Ajman' },
  'ras al khaimah': { region: 'UAE', cityName: 'Ras Al Khaimah' },

  // UK
  'london': { region: 'UK', cityName: 'London' },
  'manchester': { region: 'UK', cityName: 'Manchester' },
  'birmingham': { region: 'UK', cityName: 'Birmingham' },
  'edinburgh': { region: 'UK', cityName: 'Edinburgh' },
  'glasgow': { region: 'UK', cityName: 'Glasgow' },
  'leeds': { region: 'UK', cityName: 'Leeds' },

  // US
  'new york': { region: 'US', cityName: 'New York' },
  'los angeles': { region: 'US', cityName: 'Los Angeles' },
  'chicago': { region: 'US', cityName: 'Chicago' },
  'san francisco': { region: 'US', cityName: 'San Francisco' },
  'washington': { region: 'US', cityName: 'Washington' },
  'austin': { region: 'US', cityName: 'Austin' },
  'seattle': { region: 'US', cityName: 'Seattle' },
  'boston': { region: 'US', cityName: 'Boston' },

  // Saudi Arabia
  'riyadh': { region: 'Saudi Arabia', cityName: 'Riyadh' },
  'jeddah': { region: 'Saudi Arabia', cityName: 'Jeddah' },
  'dammam': { region: 'Saudi Arabia', cityName: 'Dammam' },
  'mecca': { region: 'Saudi Arabia', cityName: 'Mecca' },
  'medina': { region: 'Saudi Arabia', cityName: 'Medina' },

  // Canada
  'toronto': { region: 'Canada', cityName: 'Toronto' },
  'vancouver': { region: 'Canada', cityName: 'Vancouver' },
  'montreal': { region: 'Canada', cityName: 'Montreal' },
  'calgary': { region: 'Canada', cityName: 'Calgary' },

  // Europe
  'berlin': { region: 'Europe', cityName: 'Berlin' },
  'paris': { region: 'Europe', cityName: 'Paris' },
  'amsterdam': { region: 'Europe', cityName: 'Amsterdam' },
  'dublin': { region: 'Europe', cityName: 'Dublin' },
  'frankfurt': { region: 'Europe', cityName: 'Frankfurt' },
  'zurich': { region: 'Europe', cityName: 'Zurich' },
  'madrid': { region: 'Europe', cityName: 'Madrid' },

  // Australia
  'sydney': { region: 'Australia', cityName: 'Sydney' },
  'melbourne': { region: 'Australia', cityName: 'Melbourne' },
  'brisbane': { region: 'Australia', cityName: 'Brisbane' },
  'perth': { region: 'Australia', cityName: 'Perth' }
};

// ============================================================================
// GOVERNMENT SOURCE JURISDICTIONS (PAKISTAN)
// ============================================================================

interface SourceJurisdiction {
  province: string;
  name: string;
}

const SOURCE_JURISDICTION_MAP: Record<string, SourceJurisdiction> = {
  fpsc: { province: 'Federal', name: 'Federal Public Service Commission' },
  ppsc: { province: 'Punjab', name: 'Punjab Public Service Commission' },
  spsc: { province: 'Sindh', name: 'Sindh Public Service Commission' },
  kppsc: { province: 'Khyber Pakhtunkhwa', name: 'Khyber Pakhtunkhwa Public Service Commission' },
  kpsc: { province: 'Khyber Pakhtunkhwa', name: 'Khyber Pakhtunkhwa Public Service Commission' },
  bpsc: { province: 'Balochistan', name: 'Balochistan Public Service Commission' },
  ajkpsc: { province: 'AJK', name: 'Azad Jammu & Kashmir Public Service Commission' },
  nts: { province: 'Federal', name: 'National Testing Service (National)' },
  pts: { province: 'Federal', name: 'Pakistan Testing Service (National)' },
  ots: { province: 'Federal', name: 'Open Testing Service (National)' },
  uts: { province: 'Federal', name: 'Universal Testing Service (National)' },
  wapda: { province: 'Federal', name: 'WAPDA (Federal Agency)' },
  fbr: { province: 'Federal', name: 'Federal Board of Revenue' },
  nadra: { province: 'Federal', name: 'NADRA (Federal Agency)' },
  fia: { province: 'Federal', name: 'FIA (Federal Agency)' }
};

// ============================================================================
// MAIN PURE SUGGESTION ENGINE FUNCTION
// ============================================================================

/**
 * Pure, read-only analyzer for scraped or user-submitted job records.
 * Maintains international Region hierarchy while extracting Pakistani Province and City.
 *
 * Region = 'Pakistan' | 'US' | 'UK' | 'UAE' | 'Saudi Arabia' | 'Canada' | 'Europe' | 'Australia' | 'Global'
 * Province = 'Punjab' | 'Sindh' | 'Khyber Pakhtunkhwa' | 'Balochistan' | 'AJK' | 'Gilgit-Baltistan' | 'Federal'
 * City = 'Rawalpindi' | 'Lahore' | 'Karachi' | 'Peshawar' | 'Quetta' | 'Islamabad' etc.
 */
export function suggestJobMetadata(job: Partial<Job> | null | undefined): JobSuggestionResult {
  const isScraped = isScrapedJob(job);
  const reasons: string[] = [];
  const missingFields: string[] = [];

  if (!job) {
    return {
      isScrapedJob: false,
      detectedLocation: { region: 'Pakistan' },
      suggestedRegion: 'Pakistan',
      suggestedCategory: 'Government Sector',
      confidence: 'UNKNOWN',
      hasConflict: false,
      reasons: ['No job record provided'],
      missingFields: ['Missing Complete Job Object']
    };
  }

  // -------------------------------------------------------------------------
  // 1. MISSING FIELDS CHECK
  // -------------------------------------------------------------------------
  if (!job.title || !job.title.trim() || job.title.toLowerCase().includes('untitled')) {
    missingFields.push('Missing Job Title');
  }
  if (!job.company || !job.company.trim()) {
    missingFields.push('Missing Company / Organization');
  }
  if (!job.description || job.description.trim().length < 20) {
    missingFields.push('Missing Full Job Description');
  }
  if (!job.city && !job.province) {
    missingFields.push('Missing Specific City / Province Location');
  }
  if (!job.jobCategory) {
    missingFields.push('Missing Job Category');
  }
  if (!job.sourceUrl && !job.applicationUrl && !job.contactEmailOrPhone && !job.externalApplyUrl) {
    missingFields.push('Missing Apply URL or Contact Details');
  }
  if (!job.salary || job.salary === 'Not Specified' || job.salary === 'Market Competitive') {
    missingFields.push('Missing Salary Details');
  }

  // -------------------------------------------------------------------------
  // 2. COMPILE TEXT INPUT BUFFERS FOR MULTI-SIGNAL ANALYSIS
  // -------------------------------------------------------------------------
  const rawLocation = typeof (job as Record<string, unknown>)?.location === 'string'
    ? ((job as Record<string, unknown>).location as string)
    : '';

  const titleText = (job.title || '').toLowerCase();
  const companyText = (job.company || '').toLowerCase();
  const deptText = (job.department || job.govtDepartment || '').toLowerCase();
  const locText = rawLocation.toLowerCase();
  const cityText = (job.city || '').toLowerCase();
  const provText = (job.province || '').toLowerCase();
  const descText = (job.description || '').toLowerCase();
  const reqText = Array.isArray(job.requirements)
    ? job.requirements.join(' ').toLowerCase()
    : typeof job.requirements === 'string'
    ? (job.requirements as string).toLowerCase()
    : '';
  const tagsText = Array.isArray(job.tags) ? job.tags.join(' ').toLowerCase() : '';
  const quotaText = (job.domicileQuota || '').toLowerCase();
  const extractedText = (job.extractedText || '').toLowerCase();

  const combinedBodyText = `${titleText} ${companyText} ${deptText} ${locText} ${cityText} ${provText} ${descText} ${reqText} ${tagsText} ${quotaText} ${extractedText}`;

  // -------------------------------------------------------------------------
  // 3. INTERNATIONAL REGION CHECK
  // -------------------------------------------------------------------------
  const validInternationalRegions: Region[] = ['US', 'UK', 'UAE', 'Saudi Arabia', 'Canada', 'Europe', 'Australia', 'Global'];
  
  // A. Direct Region property on Job
  if (job.region && validInternationalRegions.includes(job.region)) {
    reasons.push(`Job explicitly set to international region: "${job.region}"`);
    return buildInternationalResult(job, job.region, job.province, job.city, isScraped, reasons, missingFields, combinedBodyText);
  }

  // B. International City Detection in Text
  for (const [intlCityKey, intlInfo] of Object.entries(INTERNATIONAL_CITY_MAP)) {
    if (cityText.includes(intlCityKey) || locText.includes(intlCityKey) || titleText.includes(intlCityKey)) {
      reasons.push(`Matched international city "${intlInfo.cityName}" in region "${intlInfo.region}"`);
      return buildInternationalResult(job, intlInfo.region, job.province, intlInfo.cityName, isScraped, reasons, missingFields, combinedBodyText);
    }
  }

  // C. International Country Keyword Detection in Text
  if (combinedBodyText.includes('united arab emirates') || combinedBodyText.includes(' uae ')) {
    reasons.push('Matched UAE country keywords in job text');
    return buildInternationalResult(job, 'UAE', job.province, job.city, isScraped, reasons, missingFields, combinedBodyText);
  }
  if (combinedBodyText.includes('united kingdom') || combinedBodyText.includes(' england ') || combinedBodyText.includes(' london ')) {
    reasons.push('Matched UK country keywords in job text');
    return buildInternationalResult(job, 'UK', job.province, job.city, isScraped, reasons, missingFields, combinedBodyText);
  }
  if (combinedBodyText.includes('united states') || combinedBodyText.includes(' usa ') || combinedBodyText.includes(' america ')) {
    reasons.push('Matched US country keywords in job text');
    return buildInternationalResult(job, 'US', job.province, job.city, isScraped, reasons, missingFields, combinedBodyText);
  }
  if (combinedBodyText.includes('saudi arabia') || combinedBodyText.includes(' ksa ')) {
    reasons.push('Matched Saudi Arabia country keywords in job text');
    return buildInternationalResult(job, 'Saudi Arabia', job.province, job.city, isScraped, reasons, missingFields, combinedBodyText);
  }

  // -------------------------------------------------------------------------
  // 4. PAKISTAN MULTI-SIGNAL ANALYSIS (Region = 'Pakistan')
  // -------------------------------------------------------------------------
  const suggestedRegion: Region = 'Pakistan';

  // Detect Source Jurisdiction (Signal B)
  const rawSourceKey = (job.scraperSourceId || job.scraperSourceName || '').toLowerCase().trim();
  let sourceJurisdiction: SourceJurisdiction | null = null;

  for (const [key, jurisdiction] of Object.entries(SOURCE_JURISDICTION_MAP)) {
    if (rawSourceKey.includes(key) || (job.sourceUrl && job.sourceUrl.toLowerCase().includes(key))) {
      sourceJurisdiction = jurisdiction;
      break;
    }
  }

  // Detect Explicit City & Province (Signal A & C)
  let explicitCity: string | undefined = undefined;
  let explicitProvince: string | undefined = undefined;

  // Check explicit city field or match city in combined text
  if (job.city && PAKISTAN_CITY_MAP[cityText]) {
    explicitCity = job.city;
    explicitProvince = PAKISTAN_CITY_MAP[cityText].province;
    reasons.push(`Explicit city field specifies "${job.city}" (${explicitProvince}, Pakistan)`);
  } else {
    for (const [cityName, info] of Object.entries(PAKISTAN_CITY_MAP)) {
      if (titleText.includes(cityName) || deptText.includes(cityName) || locText.includes(cityName) || cityText.includes(cityName)) {
        explicitCity = cityName.charAt(0).toUpperCase() + cityName.slice(1);
        explicitProvince = info.province;
        reasons.push(`Explicit location text matched city "${explicitCity}" in ${info.province}, Pakistan`);
        break;
      }
    }
  }

  // Check explicit province wording if no city match yet
  if (!explicitProvince) {
    if (combinedBodyText.includes('sindh') || provText.includes('sindh')) {
      explicitProvince = 'Sindh';
      reasons.push('Text mentions Sindh province/government');
    } else if (combinedBodyText.includes('punjab') || provText.includes('punjab')) {
      explicitProvince = 'Punjab';
      reasons.push('Text mentions Punjab province/government');
    } else if (combinedBodyText.includes('khyber pakhtunkhwa') || combinedBodyText.includes('kpk') || provText.includes('khyber')) {
      explicitProvince = 'Khyber Pakhtunkhwa';
      reasons.push('Text mentions Khyber Pakhtunkhwa (KP) province/government');
    } else if (combinedBodyText.includes('balochistan') || provText.includes('balochistan')) {
      explicitProvince = 'Balochistan';
      reasons.push('Text mentions Balochistan province/government');
    } else if (combinedBodyText.includes('azad jammu') || combinedBodyText.includes('ajk') || provText.includes('ajk')) {
      explicitProvince = 'AJK';
      reasons.push('Text mentions AJK region');
    } else if (combinedBodyText.includes('gilgit') || provText.includes('gilgit')) {
      explicitProvince = 'Gilgit-Baltistan';
      reasons.push('Text mentions Gilgit-Baltistan region');
    } else if (combinedBodyText.includes('islamabad') || combinedBodyText.includes('federal capital') || combinedBodyText.includes('government of pakistan')) {
      explicitProvince = 'Federal';
      reasons.push('Text references Federal Government / Islamabad ICT');
    }
  }

  // Determine Suggested Province and Conflict Evaluation
  let suggestedProvince: string | undefined = explicitProvince;
  let suggestedCity: string | undefined = explicitCity;
  let hasConflict = false;
  let conflictDetails: string | undefined = undefined;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' = 'LOW';

  if (sourceJurisdiction) {
    reasons.push(`Source is identified as ${sourceJurisdiction.name}`);
  }

  if (explicitProvince && sourceJurisdiction) {
    if (explicitProvince === sourceJurisdiction.province) {
      // Signals Agree -> HIGH confidence
      suggestedProvince = explicitProvince;
      confidence = 'HIGH';
      reasons.push(`Source jurisdiction province (${sourceJurisdiction.province}) agrees with ad text location (${explicitProvince})`);
    } else {
      // CONFLICT DISCOVERED -> Explicit advertisement text takes priority over portal jurisdiction default
      hasConflict = true;
      suggestedProvince = explicitProvince; // Prefer explicit ad text
      confidence = 'HIGH';
      conflictDetails = `Source portal is ${sourceJurisdiction.name} (${sourceJurisdiction.province}), but advertisement text explicitly specifies ${explicitProvince}${explicitCity ? ` (${explicitCity})` : ''}. Advertisement province prioritized.`;
      reasons.push(`CONFLICT: Portal jurisdiction is ${sourceJurisdiction.province}, but ad text explicitly specifies ${explicitProvince}`);
    }
  } else if (explicitProvince) {
    suggestedProvince = explicitProvince;
    confidence = explicitCity ? 'HIGH' : 'MEDIUM';
    reasons.push(`Suggested province set to "${explicitProvince}" based on advertisement text signals`);
  } else if (sourceJurisdiction) {
    suggestedProvince = sourceJurisdiction.province;
    confidence = 'MEDIUM';
    reasons.push(`Suggested province set to "${sourceJurisdiction.province}" based on source jurisdiction (${sourceJurisdiction.name})`);
  } else if (job.isGovtJob || companyText.includes('ministry') || companyText.includes('department') || titleText.includes('bps-')) {
    suggestedProvince = 'Federal';
    confidence = 'LOW';
    reasons.push('Identified as Pakistani Government opportunity without specific province; defaulting province to Federal');
  } else {
    suggestedProvince = job.province || undefined;
    confidence = 'UNKNOWN';
    reasons.push('Insufficient location signals; region set to Pakistan');
  }

  // Check for Conflict with Existing Confirmed / Manually-Corrected Location
  const isProtected = Boolean(
    job.isLocationConfirmed ||
    job.isManuallyCorrected ||
    job.metadata?.isLocationConfirmed ||
    job.metadata?.isManuallyCorrected
  );

  const existingParts = [job.region || 'Pakistan', job.province?.trim(), job.city?.trim(), job.district?.trim()].filter(Boolean);
  const existingLocationStr = existingParts.length > 0 ? existingParts.join(' / ') : 'Unspecified';

  const suggestedParts = ['Pakistan', suggestedProvince?.trim(), suggestedCity?.trim(), job.district?.trim()].filter(Boolean);
  const suggestedLocationStr = suggestedParts.length > 0 ? suggestedParts.join(' / ') : 'Unspecified';

  if (isProtected) {
    let protectionConflict = false;
    if (job.region && job.region !== 'Pakistan') {
      protectionConflict = true;
    }
    if (suggestedProvince && job.province && suggestedProvince.trim().toLowerCase() !== job.province.trim().toLowerCase()) {
      protectionConflict = true;
    }
    if (suggestedCity && job.city && suggestedCity.trim().toLowerCase() !== job.city.trim().toLowerCase()) {
      protectionConflict = true;
    }

    if (protectionConflict) {
      hasConflict = true;
      conflictDetails = `Confirmed existing location (${existingLocationStr}) conflicts with new scraped location (${suggestedLocationStr}). Admin decision required.`;
      reasons.push(`LOCATION CONFLICT: Confirmed location (${existingLocationStr}) differs from scraped location (${suggestedLocationStr})`);
    }
  }

  // Category Extraction
  const { suggestedCategory, suggestedGovtCategory } = extractCategory(job, combinedBodyText, suggestedProvince, sourceJurisdiction, companyText, titleText, reasons);

  return {
    isScrapedJob: isScraped,
    detectedLocation: {
      city: suggestedCity || job.city,
      province: suggestedProvince || job.province,
      district: job.district,
      region: 'Pakistan'
    },
    suggestedRegion: 'Pakistan',
    suggestedProvince,
    suggestedCity,
    suggestedDistrict: job.district,
    existingLocationStr,
    suggestedLocationStr,
    suggestedCategory,
    suggestedGovtCategory,
    confidence,
    hasConflict,
    conflictDetails,
    reasons,
    missingFields
  };
}

// Helper for International Results
function buildInternationalResult(
  job: Partial<Job>,
  region: Region,
  province: string | undefined,
  city: string | undefined,
  isScraped: boolean,
  reasons: string[],
  missingFields: string[],
  combinedBodyText: string
): JobSuggestionResult {
  const { suggestedCategory } = extractCategory(job, combinedBodyText, undefined, null, (job.company || '').toLowerCase(), (job.title || '').toLowerCase(), reasons);

  const existingParts = [job.region, job.province?.trim(), job.city?.trim(), job.district?.trim()].filter(Boolean);
  const existingLocationStr = existingParts.length > 0 ? existingParts.join(' / ') : 'Unspecified';

  const suggestedParts = [region, (province || job.province)?.trim(), (city || job.city)?.trim(), job.district?.trim()].filter(Boolean);
  const suggestedLocationStr = suggestedParts.length > 0 ? suggestedParts.join(' / ') : 'Unspecified';

  return {
    isScrapedJob: isScraped,
    detectedLocation: {
      city: city || job.city,
      province: province || job.province,
      region
    },
    suggestedRegion: region,
    suggestedProvince: province || job.province,
    suggestedCity: city || job.city,
    existingLocationStr,
    suggestedLocationStr,
    suggestedCategory,
    confidence: 'HIGH',
    hasConflict: false,
    reasons,
    missingFields
  };
}

// Category Extraction Helper
function extractCategory(
  job: Partial<Job>,
  combinedBodyText: string,
  province: string | undefined,
  sourceJurisdiction: SourceJurisdiction | null,
  companyText: string,
  titleText: string,
  reasons: string[]
) {
  let suggestedCategory = 'Government Sector';
  let suggestedGovtCategory: 'Federal' | 'Provincial' | 'Defense' | 'Healthcare' | 'Education' | 'Public Sector' | undefined = undefined;

  if (province === 'Federal') {
    suggestedGovtCategory = 'Federal';
  } else if (['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'AJK', 'Gilgit-Baltistan'].includes(String(province))) {
    suggestedGovtCategory = 'Provincial';
  }

  if (combinedBodyText.includes('education') || combinedBodyText.includes('teacher') || combinedBodyText.includes('lecturer') || combinedBodyText.includes('professor') || combinedBodyText.includes('school') || combinedBodyText.includes('university') || combinedBodyText.includes('hec')) {
    suggestedCategory = 'Education';
    suggestedGovtCategory = 'Education';
    reasons.push('Detected Education domain in title/department/text');
  } else if (combinedBodyText.includes('health') || combinedBodyText.includes('hospital') || combinedBodyText.includes('doctor') || combinedBodyText.includes('nurse') || combinedBodyText.includes('medical') || combinedBodyText.includes('mbbs') || combinedBodyText.includes('pharmacist')) {
    suggestedCategory = 'Healthcare';
    suggestedGovtCategory = 'Healthcare';
    reasons.push('Detected Healthcare/Medical domain in title/department/text');
  } else if (combinedBodyText.includes('police') || combinedBodyText.includes('defense') || combinedBodyText.includes('army') || combinedBodyText.includes('navy') || combinedBodyText.includes('air force') || combinedBodyText.includes('rangers') || combinedBodyText.includes('security') || combinedBodyText.includes('fia') || combinedBodyText.includes('constable')) {
    suggestedCategory = 'Defense & Law Enforcement';
    suggestedGovtCategory = 'Defense';
    reasons.push('Detected Defense/Security/Police domain');
  } else if (combinedBodyText.includes('software') || combinedBodyText.includes('developer') || combinedBodyText.includes('it officer') || combinedBodyText.includes('computer operator') || combinedBodyText.includes('data analyst') || combinedBodyText.includes('programmer') || combinedBodyText.includes('cyber')) {
    suggestedCategory = 'IT & Software';
    reasons.push('Detected IT/Software domain in title/text');
  } else if (combinedBodyText.includes('engineer') || combinedBodyText.includes('sub engineer') || combinedBodyText.includes('wapda') || combinedBodyText.includes('sdo') || combinedBodyText.includes('civil') || combinedBodyText.includes('electrical') || combinedBodyText.includes('mechanical')) {
    suggestedCategory = 'Engineering';
    reasons.push('Detected Engineering domain in title/text');
  } else if (combinedBodyText.includes('finance') || combinedBodyText.includes('accountant') || combinedBodyText.includes('audit') || combinedBodyText.includes('fbr') || combinedBodyText.includes('banking') || combinedBodyText.includes('cashier') || combinedBodyText.includes('tax')) {
    suggestedCategory = 'Banking & Finance';
    reasons.push('Detected Finance/Audit/Accounting domain');
  } else if (combinedBodyText.includes('judge') || combinedBodyText.includes('lawyer') || combinedBodyText.includes('legal') || combinedBodyText.includes('prosecutor') || combinedBodyText.includes('judicial') || combinedBodyText.includes('court')) {
    suggestedCategory = 'Law & Legal';
    reasons.push('Detected Legal/Judiciary domain');
  } else if (job.isNewspaperAd || combinedBodyText.includes('classified') || combinedBodyText.includes('newspaper')) {
    suggestedCategory = 'Newspaper Classified';
    reasons.push('Detected Newspaper Classified origin');
  } else if (job.isGovtJob || sourceJurisdiction || companyText.includes('commission') || companyText.includes('ministry') || companyText.includes('department')) {
    suggestedCategory = 'Government Sector';
    suggestedGovtCategory = suggestedGovtCategory || 'Public Sector';
    reasons.push('Detected Government Sector vacancy');
  } else {
    suggestedCategory = job.jobCategory || 'Private Corporate';
    reasons.push(`Used default category: "${suggestedCategory}"`);
  }

  return { suggestedCategory, suggestedGovtCategory };
}
