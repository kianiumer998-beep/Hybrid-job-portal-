import { ConsolidatedPdfGazette, Job } from '../types/job';

export interface OfficialGovtPdfPortal {
  id: string;
  name: string;
  shortName: string;
  portalUrl: string;
  pdfUrl?: string;
  organization: string;
  category: 'National / Federal Portal' | 'Public Service Commission' | 'Defence & Armed Forces' | 'Autonomous / Public Sector' | 'Federal Ministry' | 'Testing & Assessment Service';
  badge: string;
  description: string;
  typicalScales: string;
  defaultDeadline: string;
  sampleAdvtNo: string;
}

export const OFFICIAL_GOVT_SCRAPER_PORTALS: OfficialGovtPdfPortal[] = [
  {
    id: 'portal-njp',
    name: 'National Job Portal (NJP)',
    shortName: 'NJP',
    portalUrl: 'https://njp.gov.pk',
    pdfUrl: 'https://njp.gov.pk/advertisements/NJP_Federal_Ministries_Consolidated_2026.pdf',
    organization: 'National Information Technology Board (NITB) / Federal Government',
    category: 'National / Federal Portal',
    badge: '🏛️ Central Federal Portal',
    description: 'Pakistan Government centralized employment repository hosting federal ministries, divisions, autonomous corporations, and special pay scale (PPS/BPS) vacancies.',
    typicalScales: 'BPS-14 to BPS-21 / PPS-06 to PPS-11',
    defaultDeadline: '15th November 2026',
    sampleAdvtNo: 'NJP-FED-2026/09'
  },
  {
    id: 'portal-fpsc',
    name: 'Federal Public Service Commission (FPSC)',
    shortName: 'FPSC',
    portalUrl: 'https://fpsc.gov.pk',
    pdfUrl: 'https://fpsc.gov.pk/advertisements/Consolidated_Advt_No_08_2026.pdf',
    organization: 'Federal Public Service Commission (FPSC)',
    category: 'Public Service Commission',
    badge: '📜 Federal Constitutional Body',
    description: 'Apex federal recruitment authority publishing monthly consolidated multi-page gazettes for gazetted BPS-16 through BPS-20 appointments.',
    typicalScales: 'BPS-16 to BPS-20 Gazetted',
    defaultDeadline: '22nd September 2026',
    sampleAdvtNo: 'Consolidated Advt. No. 08/2026'
  },
  {
    id: 'portal-pakarmy',
    name: 'Join Pak Army Portal',
    shortName: 'Pak Army',
    portalUrl: 'https://joinpakarmy.gov.pk',
    pdfUrl: 'https://joinpakarmy.gov.pk/notifications/Army_Recruitment_Direct_Short_Service_Commission_2026.pdf',
    organization: 'Pakistan Army (GHQ Rawalpindi)',
    category: 'Defence & Armed Forces',
    badge: '⚔️ Armed Forces & Defence',
    description: 'Official portal for Technical Cadet Course (TCC), Short Service Regular Commission (SSRC), ICTO, EME, Signals, Medical & Legal Officer Commissions.',
    typicalScales: 'Captain (BPS-17 Equivalent) / Major (BPS-18)',
    defaultDeadline: '25th October 2026',
    sampleAdvtNo: 'GHQ-PA-SSRC-2026/B'
  },
  {
    id: 'portal-mes',
    name: 'Military Engineer Services (MES)',
    shortName: 'MES',
    portalUrl: 'https://mes.gov.pk',
    pdfUrl: 'https://mes.gov.pk/careers/MES_Engineering_Cadre_Consolidated_Advt_2026.pdf',
    organization: 'Military Engineer Services (E-in-C Branch GHQ / Ministry of Defence)',
    category: 'Defence & Armed Forces',
    badge: '🏗️ Cantonment & Military Eng',
    description: 'Technical civil, electrical, mechanical engineering and cantonment maintenance cadres under the Engineer-in-Chief Branch.',
    typicalScales: 'BPS-11 to BPS-18',
    defaultDeadline: '10th November 2026',
    sampleAdvtNo: 'MES/E-in-C/2026-Recruit'
  },
  {
    id: 'portal-wapda',
    name: 'WAPDA Careers',
    shortName: 'WAPDA',
    portalUrl: 'https://wapda.gov.pk',
    pdfUrl: 'https://wapda.gov.pk/careers/Adv_WAPDA_Phase_II_2026.pdf',
    organization: 'Water & Power Development Authority (WAPDA)',
    category: 'Autonomous / Public Sector',
    badge: '⚡ Hydel Power & Water Wing',
    description: 'Mega hydroelectric dams and water reservoir engineering, financial audit, and operational staff recruitment notices.',
    typicalScales: 'BPS-14 to BPS-19',
    defaultDeadline: '30th September 2026',
    sampleAdvtNo: 'WAPDA/PR/2026/04'
  },
  {
    id: 'portal-pakrail',
    name: 'Pakistan Railways',
    shortName: 'Pak Railways',
    portalUrl: 'https://pakrail.gov.pk',
    pdfUrl: 'https://pakrail.gov.pk/careers/Pakistan_Railways_Operational_Staff_Advt_2026.pdf',
    organization: 'Pakistan Railways (Headquarters Office Lahore)',
    category: 'Autonomous / Public Sector',
    badge: '🚆 Railway Operations & Fleet',
    description: 'Locomotive engineers, station masters, traffic officers, track civil supervisors, and train electrical engineers.',
    typicalScales: 'BPS-11 to BPS-17',
    defaultDeadline: '18th November 2026',
    sampleAdvtNo: 'PR-HQ-LHR-2026/07'
  },
  {
    id: 'portal-railways-mod',
    name: 'Ministry of Railways',
    shortName: 'Ministry Railways',
    portalUrl: 'https://railways.gov.pk',
    pdfUrl: 'https://railways.gov.pk/vacancies/Ministry_of_Railways_Project_Staff_2026.pdf',
    organization: 'Ministry of Railways (Government of Pakistan, Islamabad)',
    category: 'Federal Ministry',
    badge: '🏛️ Federal Secretariat Ministry',
    description: 'Federal policy, infrastructure planning, track upgrading (ML-1 project management unit), and legal advisory positions.',
    typicalScales: 'BPS-17 to BPS-20 / MP-II & MP-III',
    defaultDeadline: '20th November 2026',
    sampleAdvtNo: 'MoR-FED-PMU-2026/02'
  },
  {
    id: 'portal-mod',
    name: 'Ministry of Defence (MoD)',
    shortName: 'MoD',
    portalUrl: 'https://mod.gov.pk',
    pdfUrl: 'https://mod.gov.pk/careers/Ministry_of_Defence_Consolidated_Notice_2026.pdf',
    organization: 'Ministry of Defence (Federal Government Rawalpindi)',
    category: 'Federal Ministry',
    badge: '🛡️ Federal Defence Ministry',
    description: 'Federal security wings, research specialists, administration officers, protocol, and cantonment executive staff.',
    typicalScales: 'BPS-12 to BPS-19',
    defaultDeadline: '28th October 2026',
    sampleAdvtNo: 'MoD-ADMIN-2026/05'
  },
  {
    id: 'portal-nts',
    name: 'National Testing Service (NTS)',
    shortName: 'NTS',
    portalUrl: 'https://nts.org.pk',
    pdfUrl: 'https://nts.org.pk/projects/Consolidated_NTS_Screening_Projects_2026.pdf',
    organization: 'National Testing Service - Pakistan (NTS)',
    category: 'Testing & Assessment Service',
    badge: '📝 Testing Agency (National)',
    description: 'Pakistan premier recruitment testing agency conducting screening tests for DISCOs, autonomous bodies, police, and educational cadres.',
    typicalScales: 'BPS-07 to BPS-17 Screening',
    defaultDeadline: '12th November 2026',
    sampleAdvtNo: 'NTS-PROJECT-2026/410'
  },
  {
    id: 'portal-ots',
    name: 'Open Testing Service (OTS)',
    shortName: 'OTS',
    portalUrl: 'https://ots.org.pk',
    pdfUrl: 'https://ots.org.pk/advertisements/OTS_Federal_Provincial_Recruitment_2026.pdf',
    organization: 'Open Testing Service (OTS)',
    category: 'Testing & Assessment Service',
    badge: '📝 Testing Agency (Federal/Prov)',
    description: 'Screening partner for FIA, FBR, WASA, health boards, and provincial municipal departments.',
    typicalScales: 'BPS-09 to BPS-16 Screening',
    defaultDeadline: '16th November 2026',
    sampleAdvtNo: 'OTS-RECRUIT-2026/88'
  },
  {
    id: 'portal-sts-siba',
    name: 'SIBA / Sukkur IBA Testing Service (STS)',
    shortName: 'SIBA / STS',
    portalUrl: 'https://sts.net.pk',
    pdfUrl: 'https://sts.net.pk/projects/Sindh_Education_and_Revenue_Testing_Project_2026.pdf',
    organization: 'Sukkur IBA University Testing Service (STS)',
    category: 'Testing & Assessment Service',
    badge: '🎓 University Assessment Board',
    description: 'Merit assessment service managing Sindh School Education (JEST, PST, HST) and Sindh Revenue Board (SRB) merit recruitments.',
    typicalScales: 'BPS-14 to BPS-17 Merit Tests',
    defaultDeadline: '24th October 2026',
    sampleAdvtNo: 'STS-SIBA-2026/03'
  },
  {
    id: 'portal-sts-pak',
    name: 'Sindh Testing Service (STS-Pak)',
    shortName: 'STS-Pak',
    portalUrl: 'https://sts.org.pk',
    pdfUrl: 'https://sts.org.pk/projects/STS_Pak_Sindh_Police_and_Health_2026.pdf',
    organization: 'Sindh Testing Service (STS-Pakistan)',
    category: 'Testing & Assessment Service',
    badge: '📝 Testing Agency (Sindh)',
    description: 'Conducting physical, written, and screening tests for Sindh Police, Allied Health Services, and municipal corporation vacancies.',
    typicalScales: 'BPS-05 to BPS-14 Cadres',
    defaultDeadline: '30th October 2026',
    sampleAdvtNo: 'STS-PAK-POL-2026/19'
  },
  {
    id: 'portal-ctsp',
    name: 'Career Testing Services Pakistan (CTSP)',
    shortName: 'CTSP',
    portalUrl: 'https://ctsp.com.pk',
    pdfUrl: 'https://ctsp.com.pk/projects/CTSP_KPK_Police_Forest_Rescue_2026.pdf',
    organization: 'Career Testing Services Pakistan (CTSP)',
    category: 'Testing & Assessment Service',
    badge: '📝 Testing Agency (KPK/Fed)',
    description: 'Testing service conducting recruitment exams for KPK Police, Forest Department, Rescue 1122, and district administrations.',
    typicalScales: 'BPS-07 to BPS-16 Cadres',
    defaultDeadline: '5th November 2026',
    sampleAdvtNo: 'CTSP-KP-RECRUIT-2026/55'
  }
];

export const MOCK_CONSOLIDATED_PDF_GAZETTES: ConsolidatedPdfGazette[] = [
  // 1. FPSC Consolidated
  {
    id: 'pdf-gazette-fpsc-08-2026',
    title: 'FPSC Consolidated Advertisement No. 08/2026',
    organization: 'Federal Public Service Commission (FPSC)',
    pdfFileName: 'FPSC_Consolidated_Advt_No_08_2026.pdf',
    pdfUrl: 'https://fpsc.gov.pk/advertisements/Consolidated_Advt_No_08_2026.pdf',
    fileSizeFormatted: '3.4 MB',
    totalPages: 8,
    gazetteIssueNumber: 'Consolidated Advt. No. 08/2026',
    publicationDate: '2026-08-01',
    closingDeadline: '22nd September 2026',
    rawTextSample: `FEDERAL PUBLIC SERVICE COMMISSION
Aga Khan Road, Sector F-5/1, Islamabad
Website: https://fpsc.gov.pk | UAN: 051-111-000-248
CONSOLIDATED ADVERTISEMENT NO. 08/2026
Closing Date: 22nd September, 2026

Case No. F.4-118/2026-R [8/2026] ASSISTANT DIRECTOR (SYSTEMS / IT) (BPS-17), TEMPORARY, LIKELY TO CONTINUE, MINISTRY OF INFORMATION TECHNOLOGY & TELECOMMUNICATION.
MINIMUM QUALIFICATION: Second Class or Grade 'C' Master's Degree in Computer Science / Information Technology / Software Engineering or 4-years Bachelor's degree (BS/BE) from HEC recognized University.
AGE LIMIT: 22-30 years plus five (5) years general relaxation in upper age limit (Total = 35 years).
NUMBER OF VACANCIES = 14.
DOMICILE / QUOTA: Merit = 01, Punjab = 07 (Open Merit = 06, Women Quota = 01), Sindh (Rural) = 02, Khyber Pakhtunkhwa = 02, Balochistan = 01, Ex-FATA = 01.
PLACE OF POSTING: Islamabad with liability to serve anywhere in Pakistan.
Challan Fee: Rs. 300/- for BPS-17.

Case No. F.4-120/2026-R [8/2026] INSPECTOR CUSTOMS / PREVENTIVE OFFICER (BPS-16), PERMANENT, REVENUE DIVISION, FEDERAL BOARD OF REVENUE (FBR).
MINIMUM QUALIFICATION: Second Class Bachelor's degree with Economics, Commerce, Statistics, Accounting, Computer Science, Law, Pharmacy, Chemistry or Physics.
NUMBER OF VACANCIES = 45.
DOMICILE / QUOTA: Merit = 04, Punjab = 22, Sindh (R) = 05, Sindh (U) = 04, KPK = 05, Balochistan = 03.
Challan Fee: Rs. 300/- for BPS-16.`,
    extractedVacancies: [
      {
        id: 'pdf-fpsc-118',
        title: 'Assistant Director (Systems / IT) - BPS-17',
        company: 'Ministry of Information Technology & Telecommunication (FPSC Gazette)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Federal Capital Territory',
        city: 'Islamabad',
        district: 'F-5/1 (Constitution Avenue)',
        salary: 'PKR 185,000 - PKR 260,000 / month (BPS-17 Pay Scale)',
        salaryNumericMin: 185000,
        currency: 'PKR',
        experienceLevel: 'Mid',
        department: 'Information Technology & Systems Cadre',
        tags: ['FPSC Gazette', 'BPS-17', 'Case F.4-118/2026-R', 'Federal Govt', 'IT Officer'],
        description: `Federal Government gazetted post extracted from FPSC Consolidated Advertisement No. 08/2026.\n\n• Case Reference: Case No. F.4-118/2026-R [8/2026]\n• Position Scale: BPS-17 Gazetted\n• Number of Vacancies: 14 Posts\n• Domicile Quotas: Merit = 01, Punjab = 07 (Open: 06, Women: 01), Sindh (Rural) = 02, KPK = 02, Balochistan = 01, Ex-FATA = 01\n• Minimum Qualification: BS/BE (4-Years) or Master's in CS / IT / Software Engineering from HEC recognized university.\n• Age Limits: 22-30 years + 5 years general relaxation (Up to 35 Years).\n• Challan Fee: Rs. 300/- payable via National Bank of Pakistan (NBP).\n• Closing Date: 22nd September 2026.`,
        requirements: [
          "Second Class or Grade 'C' Master's Degree or BS/BE in CS/IT/SE (HEC Recognized)",
          'Age: 22 to 30 years (+ 5 Years General Age Relaxation = 35 Max)',
          'Quota Allocation: Merit (1), Punjab (7), Sindh-R (2), KPK (2), Balochistan (1), Ex-FATA (1)',
          'Original FPSC Treasury Challan Receipt (Rs. 300/-) deposited in NBP'
        ],
        benefits: [
          'Federal Government Regular Pension & Benevolent Fund',
          'BPS-17 House Rent & Utilities Allowance',
          'Official Medical Care in Federal Govt Hospitals for family',
          'Accelerated Promotion Cadre to BPS-18/19'
        ],
        postedAt: '2 days ago',
        applicationsCount: 184,
        isGovtJob: true,
        govtDepartment: 'Ministry of Information Technology & Telecommunication',
        govtScale: 'BPS-17',
        govtCategory: 'Federal',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'FPSC_Consolidated_Advt_No_08_2026.pdf',
        pdfSourceUrl: 'https://fpsc.gov.pk/advertisements/Consolidated_Advt_No_08_2026.pdf',
        pdfCaseNumber: 'Case No. F.4-118/2026-R [8/2026]',
        pdfTotalVacanciesInCase: 14,
        domicileQuota: 'Punjab: 7 (Open: 6, Women: 1), Sindh (R): 2, KPK: 2, Balochistan: 1, Merit: 1, Ex-FATA: 1',
        challanFee: 'Rs. 300/- for BPS-17 (Payable at NBP Head Account C02101)',
        ageRelaxationNote: '22-30 years plus 5 years general age relaxation (Max 35 Years)',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '22nd September 2026',
        sourceUrl: 'https://fpsc.gov.pk/jobs/gr/current-vacancies/case-f4-118-2026-r',
        scrapedSourceDomain: 'fpsc.gov.pk',
        scraperSourceName: 'FPSC Official Consolidated Gazette PDF Scraper',
        scrapedAt: '2026-08-25 09:30:00',
        paymentStatus: 'Exempt'
      },
      {
        id: 'pdf-fpsc-120',
        title: 'Inspector Customs / Preventive Officer (BPS-16)',
        company: 'Federal Board of Revenue (FBR Revenue Division)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Federal Capital Territory',
        city: 'Islamabad',
        salary: 'PKR 150,000 - PKR 210,000 / month (BPS-16 + Special Customs Allowance)',
        salaryNumericMin: 150000,
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'Customs & Anti-Smuggling Cadre',
        tags: ['FPSC Gazette', 'BPS-16', 'Case F.4-120/2026-R', 'FBR Customs', 'Preventive Officer'],
        description: `45 Openings for Inspector Customs / Preventive Officer (BPS-16) under FPSC Consolidated Advertisement No. 08/2026.\n\n• Reference: Case No. F.4-120/2026-R [8/2026]\n• Department: Federal Board of Revenue (FBR)\n• Scale: BPS-16\n• Total Vacancies: 45 Posts\n• Provincial Quota: Merit = 04, Punjab = 22, Sindh (R) = 05, Sindh (U) = 04, KPK = 05, Balochistan = 03\n• Physical Standards: Height: 5'-6" (Male), 5'-2" (Female); Chest: 32"-33.5" (Male)\n• Challan: Rs. 300/-`,
        requirements: [
          "Bachelor's Degree (14 or 16 Years) with Economics/Commerce/Stats/Law/CS/Physics/Chemistry",
          "Physical Fitness: Height 5'-6\" (Male), 5'-2\" (Female), Chest 32\"-33.5\"",
          'Age: 20-28 years + 5 years general relaxation (Up to 33 Years)',
          'NBP Challan receipt (Rs. 300/-)'
        ],
        benefits: [
          'Federal Customs Executive Allowance (100% Basic Pay Incentive)',
          'Uniform & Anti-Smuggling Seizure Reward Rewards',
          'Free Accommodation at Port / Collectorate premises'
        ],
        postedAt: '2 days ago',
        applicationsCount: 420,
        isGovtJob: true,
        govtDepartment: 'Federal Board of Revenue (FBR)',
        govtScale: 'BPS-16',
        govtCategory: 'Federal',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'FPSC_Consolidated_Advt_No_08_2026.pdf',
        pdfSourceUrl: 'https://fpsc.gov.pk/advertisements/Consolidated_Advt_No_08_2026.pdf',
        pdfCaseNumber: 'Case No. F.4-120/2026-R [8/2026]',
        pdfTotalVacanciesInCase: 45,
        domicileQuota: 'Merit: 4, Punjab: 22, Sindh-R: 5, Sindh-U: 4, KPK: 5, Balochistan: 3',
        challanFee: 'Rs. 300/- (Payable at NBP)',
        ageRelaxationNote: '20-28 years + 5 years general relaxation (Max 33 Years)',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '22nd September 2026',
        sourceUrl: 'https://fpsc.gov.pk/jobs/gr/current-vacancies/case-f4-120-2026-r',
        scrapedSourceDomain: 'fpsc.gov.pk',
        scraperSourceName: 'FPSC Official Consolidated Gazette PDF Scraper',
        scrapedAt: '2026-08-25 09:30:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 2. National Job Portal (NJP)
  {
    id: 'pdf-gazette-njp-2026',
    title: 'National Job Portal (NJP) Federal Ministries Consolidated Ingestion 2026',
    organization: 'National Information Technology Board (NITB) / Federal Government',
    pdfFileName: 'NJP_Federal_Ministries_Consolidated_2026.pdf',
    pdfUrl: 'https://njp.gov.pk/advertisements/NJP_Federal_Ministries_Consolidated_2026.pdf',
    fileSizeFormatted: '4.2 MB',
    totalPages: 6,
    gazetteIssueNumber: 'NJP-FED-2026/09',
    publicationDate: '2026-08-18',
    closingDeadline: '15th November 2026',
    rawTextSample: `GOVERNMENT OF PAKISTAN - NATIONAL JOB PORTAL (NJP)
Website: https://njp.gov.pk | Managed by NITB / Ministry of IT & Telecom
CONSOLIDATED VACANCIES ACROSS FEDERAL MINISTRIES & AUTONOMOUS DIVISIONS

Position 1: SENIOR CLOUD ARCHITECT / TECH LEAD (PPS-09 / BPS-19 EQUIVALENT) - 06 POSTS
Organization: National Information Technology Board (NITB)
Qualifications: BS/MS in Computer Science/SE with 8+ years hands-on experience in AWS/Azure/OpenStack architectures.
Salary: PKR 350,000 - 450,000 (PPS-09 Scale)
Posting: Islamabad (National Data Center)

Position 2: ASSISTANT DIRECTOR (DIGITAL IDENTITY & PUBLIC INFRASTRUCTURE) (BPS-17) - 12 POSTS
Organization: Ministry of Planning, Development & Special Initiatives
Qualifications: Master's / BS (4-Years) in Information Management / Telecom / Software.
Domicile: Punjab (06), Sindh (02), KPK (02), Balochistan (01), Merit (01).
Apply Online Exclusively at https://njp.gov.pk (No physical forms required).`,
    extractedVacancies: [
      {
        id: 'pdf-njp-lead-01',
        title: 'Senior Cloud Architect / Tech Lead (PPS-09 / BPS-19)',
        company: 'National Information Technology Board (National Job Portal NJP)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Federal Capital Territory',
        city: 'Islamabad',
        salary: 'PKR 350,000 - PKR 450,000 / month (PPS-09 Special Pay Scale)',
        salaryNumericMin: 350000,
        currency: 'PKR',
        experienceLevel: 'Lead',
        department: 'Federal Digital Infrastructure Wing (NITB)',
        tags: ['NJP Portal', 'PPS-09', 'Cloud Architect', 'Federal Govt', 'Islamabad'],
        description: `Parsed from National Job Portal (njp.gov.pk) Consolidated Federal Ingestion.\n\n• Reference: NJP-NITB-2026/01\n• Scale: PPS-09 (BPS-19 Equivalent)\n• Total Posts: 6 Vacancies\n• Requirements: 8+ years experience in Enterprise Cloud deployments, Kubernetes, and Sovereign Data Security.\n• Apply online via https://njp.gov.pk`,
        requirements: [
          'BS / MS in Computer Science / Software Engineering / Telecom',
          '8+ years cloud engineering experience with Kubernetes & OpenStack',
          'Age: 30-45 years'
        ],
        benefits: [
          'Federal Project Pay Scale Package with Market Competitive Incentive',
          'Official Medical Insurance',
          'Federal Secretariat IT allowance'
        ],
        postedAt: '1 day ago',
        applicationsCount: 92,
        isGovtJob: true,
        govtDepartment: 'National Information Technology Board (NITB)',
        govtScale: 'BPS-19',
        govtCategory: 'Federal',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'NJP_Federal_Ministries_Consolidated_2026.pdf',
        pdfSourceUrl: 'https://njp.gov.pk/advertisements/NJP_Federal_Ministries_Consolidated_2026.pdf',
        pdfCaseNumber: 'NJP-NITB-2026/01',
        pdfTotalVacanciesInCase: 6,
        domicileQuota: 'All Pakistan Merit: 2, Punjab: 2, Sindh: 1, KPK: 1',
        challanFee: 'Nil (Free Online Application at njp.gov.pk)',
        ageRelaxationNote: '30-45 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '15th November 2026',
        sourceUrl: 'https://njp.gov.pk/jobs/senior-cloud-architect',
        scrapedSourceDomain: 'njp.gov.pk',
        scraperSourceName: 'National Job Portal (NJP) Official Scraper',
        scrapedAt: '2026-08-26 14:00:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 3. Join Pak Army Portal
  {
    id: 'pdf-gazette-pakarmy-2026',
    title: 'Join Pak Army Portal Direct Short Service Commission (SSRC/ICTO) 2026',
    organization: 'Pakistan Army (GHQ Rawalpindi)',
    pdfFileName: 'Army_Recruitment_Direct_Short_Service_Commission_2026.pdf',
    pdfUrl: 'https://joinpakarmy.gov.pk/notifications/Army_Recruitment_Direct_Short_Service_Commission_2026.pdf',
    fileSizeFormatted: '5.1 MB',
    totalPages: 4,
    gazetteIssueNumber: 'GHQ-PA-SSRC-2026/B',
    publicationDate: '2026-08-15',
    closingDeadline: '25th October 2026',
    rawTextSample: `PAKISTAN ARMY - GENERAL HEADQUARTERS (GHQ), RAWALPINDI
JOIN PAK ARMY AS COMMISSIONED OFFICER THROUGH DIRECT SHORT SERVICE COMMISSION (SSRC-2026)
Website: https://joinpakarmy.gov.pk

1. INFORMATION, COMMUNICATION & TECHNOLOGY OFFICERS (ICTO) - CAPTAIN (BPS-17 EQUIVALENT)
Corps: Corps of Signals / C4I Directorate
Qualification: BE / BS (16-Years) in Software Engineering, Cyber Security, Artificial Intelligence, Telecommunication with min CGPA 3.0/4.0.
Gender: Male / Female. Age: 21-28 Years. Marital Status: Married / Unmarried.

2. ELECTRICAL & MECHANICAL ENGINEERS (EME) - CAPTAIN
Corps: Corps of EME
Qualification: BE in Mechatronics, Avionics, Mechanical or Electrical Engineering.
Testing: Initial intelligence & academic online test at AS&RC centers followed by ISSB / Physical screening.`,
    extractedVacancies: [
      {
        id: 'pdf-army-icto-01',
        title: 'Information, Communication & Tech Officer (ICTO) - Captain Rank',
        company: 'Pakistan Army (Join Pak Army Portal)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Rawalpindi (GHQ)',
        salary: 'PKR 190,000 - PKR 270,000 / month (Captain Armed Forces Pay Scale + Special Tech Pay)',
        salaryNumericMin: 190000,
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'Corps of Signals / C4I Cyber Warfare Cadre',
        tags: ['Pak Army', 'Captain Rank', 'JoinPakArmy', 'ICTO', 'BPS-17 Equiv', 'Defence'],
        description: `Extracted from Join Pak Army Portal (joinpakarmy.gov.pk) Direct Commission Notification.\n\n• Commission: Direct Short Service Regular Commission (SSRC)\n• Rank: Captain (BPS-17 Equivalent)\n• Qualifications: BE/BS in Computer Science, Cyber Security, Software Engineering (min 3.0 CGPA).\n• Physical Standards: Height 5'-4" (Male), 5'-0" (Female).\n• Apply online at https://joinpakarmy.gov.pk`,
        requirements: [
          'BE / BS in Computer Science, Cyber Security or Telecom (PEC / HEC Recognized)',
          'Age: 21 to 28 Years on 1st November 2026',
          'Physical Fitness: 1.6 KM run in 8 mins, 15 pushups, 20 situps, 3 chin-ups',
          'Online registration at joinpakarmy.gov.pk'
        ],
        benefits: [
          'Military Commissioned Officer Privileges & Free Messing',
          'Full Free Military Healthcare for self and family (CMH/MH)',
          'Defence Housing Authority (DHA) Plot Allocation Scheme',
          'Foreign training courses and United Nations (UN) Peacekeeping Missions'
        ],
        postedAt: '2 days ago',
        applicationsCount: 650,
        isGovtJob: true,
        govtDepartment: 'Pakistan Army (GHQ Rawalpindi)',
        govtScale: 'BPS-17',
        govtCategory: 'Defense',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'Army_Recruitment_Direct_Short_Service_Commission_2026.pdf',
        pdfSourceUrl: 'https://joinpakarmy.gov.pk/notifications/Army_Recruitment_Direct_Short_Service_Commission_2026.pdf',
        pdfCaseNumber: 'GHQ-PA-SSRC-2026/B',
        pdfTotalVacanciesInCase: 40,
        domicileQuota: 'All Pakistan Open Competition (Merit Based)',
        challanFee: 'Rs. 100/- Prospectus fee at Army Selection & Recruitment Center (AS&RC)',
        ageRelaxationNote: '21-28 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '25th October 2026',
        sourceUrl: 'https://joinpakarmy.gov.pk/courses/icto-ssrc',
        scrapedSourceDomain: 'joinpakarmy.gov.pk',
        scraperSourceName: 'Join Pak Army Portal Official Ingestion',
        scrapedAt: '2026-08-25 16:30:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 4. Military Engineer Services (MES)
  {
    id: 'pdf-gazette-mes-2026',
    title: 'Military Engineer Services (MES) Engineering & Technical Cadre Notice 2026',
    organization: 'Military Engineer Services (MES)',
    pdfFileName: 'MES_Engineering_Cadre_Consolidated_Advt_2026.pdf',
    pdfUrl: 'https://mes.gov.pk/careers/MES_Engineering_Cadre_Consolidated_Advt_2026.pdf',
    fileSizeFormatted: '3.6 MB',
    totalPages: 5,
    gazetteIssueNumber: 'MES/E-in-C/2026-Recruit',
    publicationDate: '2026-08-10',
    closingDeadline: '10th November 2026',
    rawTextSample: `MILITARY ENGINEER SERVICES (MES) - ENGINEER-IN-CHIEF'S BRANCH, GHQ RAWALPINDI
Website: https://mes.gov.pk | Recruitment Cell: 051-9271882
ADVERTISEMENT FOR RECRUITMENT IN MILITARY ENGINEER SERVICES (2026)

Sr. 1: ASSISTANT EXECUTIVE ENGINEER (CIVIL / B&R) (BPS-17) - 18 POSTS
Qualification: B.Sc / B.E in Civil Engineering with active PEC registration. Age: 21-30 + 5 Years = 35 Years.
Quota: Merit = 02, Punjab = 09, Sindh = 03, KPK = 02, Balochistan = 01, AJK = 01.

Sr. 2: SUB-ENGINEER (BUILDINGS & ROADS / ELECTRICAL / MECHANICAL) (BPS-14) - 64 POSTS
Qualification: 3-Years Diploma of Associate Engineer (DAE) in Civil / Electrical / Mechanical Technology (1st Div).
Age: 18-30 Years.
Posting: Military Cantonments (Rawalpindi, Lahore, Karachi, Peshawar, Quetta, Gujranwala, Multan).
Online Challan Fee: Rs. 500/- via 1Link / NBP.`,
    extractedVacancies: [
      {
        id: 'pdf-mes-aee-01',
        title: 'Assistant Executive Engineer (Civil / B&R) - BPS-17',
        company: 'Military Engineer Services (MES - Ministry of Defence)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Rawalpindi (Cantonment HQ)',
        salary: 'PKR 180,000 - PKR 255,000 / month (BPS-17 + Defence Allowance)',
        salaryNumericMin: 180000,
        currency: 'PKR',
        experienceLevel: 'Mid',
        department: 'E-in-C Branch Building & Roads (B&R) Directorate',
        tags: ['MES', 'BPS-17', 'Civil Engineer', 'PEC Registered', 'Cantonment'],
        description: `Parsed from Military Engineer Services official recruitment portal (mes.gov.pk).\n\n• Case Ref: MES-ENG-2026/01\n• Scale: BPS-17 Gazetted\n• Total Vacancies: 18 Posts\n• Responsibilities: Supervision of defence cantonment infrastructure, airbases, and military engineering projects.\n• Apply online at https://mes.gov.pk`,
        requirements: [
          'B.Sc / B.E in Civil Engineering with valid Pakistan Engineering Council (PEC) license',
          'Age: 21-35 years (including 5-year federal relaxation)',
          'Domicile: Punjab, Sindh, KPK, Balochistan, Merit'
        ],
        benefits: [
          'Ministry of Defence Regular Gazetted Civil Cadre Pension',
          'Free Cantonment Family Accommodation / House Rent Allowance',
          'CMH Medical Facilities'
        ],
        postedAt: '3 days ago',
        applicationsCount: 210,
        isGovtJob: true,
        govtDepartment: 'Military Engineer Services (MES)',
        govtScale: 'BPS-17',
        govtCategory: 'Defense',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'MES_Engineering_Cadre_Consolidated_Advt_2026.pdf',
        pdfSourceUrl: 'https://mes.gov.pk/careers/MES_Engineering_Cadre_Consolidated_Advt_2026.pdf',
        pdfCaseNumber: 'MES-ENG-2026/01',
        pdfTotalVacanciesInCase: 18,
        domicileQuota: 'Merit: 2, Punjab: 9, Sindh: 3, KPK: 2, Balochistan: 1, AJK: 1',
        challanFee: 'Rs. 500/- (Payable via 1Link / NBP)',
        ageRelaxationNote: '21-35 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '10th November 2026',
        sourceUrl: 'https://mes.gov.pk/jobs/aee-civil-2026',
        scrapedSourceDomain: 'mes.gov.pk',
        scraperSourceName: 'Military Engineer Services (MES) Official Scraper',
        scrapedAt: '2026-08-25 15:00:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 5. WAPDA Careers
  {
    id: 'pdf-gazette-wapda-phase2-2026',
    title: 'WAPDA Official Recruitment Notice Phase II 2026',
    organization: 'Water & Power Development Authority (WAPDA)',
    pdfFileName: 'WAPDA_Recruitment_Notice_Phase_II_2026.pdf',
    pdfUrl: 'https://wapda.gov.pk/careers/Adv_WAPDA_Phase_II_2026.pdf',
    fileSizeFormatted: '4.8 MB',
    totalPages: 5,
    gazetteIssueNumber: 'WAPDA/PR/2026/04',
    publicationDate: '2026-08-10',
    closingDeadline: '30th September 2026',
    rawTextSample: `PAKISTAN WATER & POWER DEVELOPMENT AUTHORITY (WAPDA)
WAPDA House, The Mall, Lahore
RECRUITMENT NOTICE - MEGA HYDROELECTRIC POWER PROJECTS (PHASE-II 2026)

Sr. No. 1: JUNIOR ENGINEER (CIVIL) (BPS-17) - 38 POSTS
Pay Scale: BPS-17 | Age Limit: 21-33 Years (including general age relaxation)
Qualification: B.Sc / B.E in Civil Engineering from HEC recognized University with valid PEC Registration.
Quota: Open Merit = 03, Punjab = 19 (Open: 16, Women: 02, Minorities: 01), Sindh (U) = 03, Sindh (R) = 04, KPK = 04, Balochistan = 03, Ex-FATA = 01, GB = 01.
Posting: Dasu Hydel Project / Diamer Bhasha Dam Site.

Sr. No. 2: JUNIOR ENGINEER (ELECTRICAL / MECHANICAL) (BPS-17) - 24 POSTS
Pay Scale: BPS-17 | Qualification: B.Sc Engineering Electrical / Mechanical with PEC.
Quota: Open Merit = 02, Punjab = 12, Sindh = 04, KPK = 03, Balochistan = 02.`,
    extractedVacancies: [
      {
        id: 'pdf-wapda-eng-01',
        title: 'Junior Engineer (Civil) - BPS-17 (Mega Dam Projects)',
        company: 'Water & Power Development Authority (WAPDA)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Khyber Pakhtunkhwa',
        city: 'Kohistan (Dasu Dam)',
        salary: 'PKR 195,000 - PKR 275,000 / month (BPS-17 + 50% Project Site Allowance)',
        salaryNumericMin: 195000,
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'Water Wing (Diamer Bhasha & Dasu Hydel Projects)',
        tags: ['WAPDA PDF Gazette', 'BPS-17', 'Civil Engineer', 'PEC Registered', 'Hydel Dam'],
        description: `Extracted from WAPDA Recruitment Notice Phase II 2026 PDF Advertisement.\n\n• Position: Junior Engineer (Civil) - BPS-17\n• Total Vacancies: 38 Posts\n• Organization: WAPDA Water Wing\n• Posting: Dasu Dam / Diamer Bhasha / Mohmand Dam Project Sites\n• Quotas: Merit = 03, Punjab = 19, Sindh (U) = 03, Sindh (R) = 04, KPK = 04, Balochistan = 03, Ex-FATA = 01, GB = 01\n• Qualifications: B.Sc in Civil Engineering with valid PEC registration.\n• Closing Date: 30th September 2026.`,
        requirements: [
          'B.Sc / B.E in Civil Engineering with valid PEC Registration',
          'Age: 21 to 33 years',
          'Willingness to serve at mega dam project sites'
        ],
        benefits: [
          '50% Project Site Hardship Allowance & Free Furnished Accommodation at Colony',
          'WAPDA Pension Scheme, Gratuity & Free Electricity Units Quota',
          'Free Medical Treatment at WAPDA Central Hospital Lahore'
        ],
        postedAt: '3 days ago',
        applicationsCount: 310,
        isGovtJob: true,
        govtDepartment: 'Water & Power Development Authority (WAPDA)',
        govtScale: 'BPS-17',
        govtCategory: 'Public Sector',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'WAPDA_Recruitment_Notice_Phase_II_2026.pdf',
        pdfSourceUrl: 'https://wapda.gov.pk/careers/Adv_WAPDA_Phase_II_2026.pdf',
        pdfCaseNumber: 'WAPDA-ENGR-2026/01',
        pdfTotalVacanciesInCase: 38,
        domicileQuota: 'Merit: 3, Punjab: 19, Sindh (U): 3, Sindh (R): 4, KPK: 4, Balochistan: 3, Ex-FATA: 1, GB: 1',
        challanFee: 'Rs. 450/- via NTS / 1Link Portal',
        ageRelaxationNote: '21-33 years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '30th September 2026',
        sourceUrl: 'https://wapda.gov.pk/careers/junior-engineer-civil-phase-2',
        scrapedSourceDomain: 'wapda.gov.pk',
        scraperSourceName: 'WAPDA Official Recruitment PDF Ingestion',
        scrapedAt: '2026-08-25 11:15:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 6. Pakistan Railways
  {
    id: 'pdf-gazette-pakrail-2026',
    title: 'Pakistan Railways Operational & Technical Cadre Notice 2026',
    organization: 'Pakistan Railways (Headquarters Office Lahore)',
    pdfFileName: 'Pakistan_Railways_Operational_Staff_Advt_2026.pdf',
    pdfUrl: 'https://pakrail.gov.pk/careers/Pakistan_Railways_Operational_Staff_Advt_2026.pdf',
    fileSizeFormatted: '3.1 MB',
    totalPages: 4,
    gazetteIssueNumber: 'PR-HQ-LHR-2026/07',
    publicationDate: '2026-08-14',
    closingDeadline: '18th November 2026',
    rawTextSample: `PAKISTAN RAILWAYS - HEADQUARTERS OFFICE, EMPRESS ROAD, LAHORE
Website: https://pakrail.gov.pk
RECRUITMENT FOR CRITICAL OPERATIONAL & TRAFFIC CADRES (2026)

1. ASSISTANT EXECUTIVE MECHANICAL ENGINEER (LOCOMOTIVE WING) (BPS-17) - 12 POSTS
Pay Scale: BPS-17 | Qualification: B.Sc Mechanical / Mechatronics Engineering (PEC Registered).
Posting: Carriage Factory Islamabad / Locomotive Factory Risalpur / Diesel Shed Lahore.

2. ASSISTANT STATION MASTER / TRAFFIC SUPERVISOR (BPS-14) - 45 POSTS
Pay Scale: BPS-14 | Qualification: Graduate (BA/B.Sc/B.Com) with 2nd Division from HEC recognized university.
Age: 18-30 Years.
Quota: Open Merit = 04, Punjab = 22, Sindh = 08, KPK = 06, Balochistan = 03, AJK = 02.`,
    extractedVacancies: [
      {
        id: 'pdf-rail-eng-01',
        title: 'Assistant Executive Mechanical Engineer (Locomotives) - BPS-17',
        company: 'Pakistan Railways (Headquarters Office Lahore)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Lahore (Mughalpura Workshops)',
        salary: 'PKR 175,000 - PKR 245,000 / month (BPS-17 + Railway Running Allowance)',
        salaryNumericMin: 175000,
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'Mechanical Operations & Locomotive Maintenance',
        tags: ['Pakistan Railways', 'BPS-17', 'Mechanical Engineer', 'Locomotive', 'PakRail'],
        description: `Parsed from Pakistan Railways official recruitment notification (pakrail.gov.pk).\n\n• Case Ref: PR-HQ-MECH-2026/01\n• Scale: BPS-17\n• Total Vacancies: 12 Posts\n• Responsibilities: Management of high-horsepower diesel-electric locomotives and carriage manufacturing quality.\n• Apply online at https://pakrail.gov.pk`,
        requirements: [
          'B.Sc Mechanical / Mechatronics Engineering with valid PEC registration',
          'Age: 21-30 years (+ 5 years relaxation = 35)',
          'Medical category: A-1 vision fitness for railway operational staff'
        ],
        benefits: [
          'Pakistan Railways Regular Civil Pension Scheme',
          'Free Railway Pass & Privilege Family Travel Tokens across Pakistan',
          'Railway Officers Colony Accommodation'
        ],
        postedAt: '1 day ago',
        applicationsCount: 145,
        isGovtJob: true,
        govtDepartment: 'Pakistan Railways',
        govtScale: 'BPS-17',
        govtCategory: 'Public Sector',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'Pakistan_Railways_Operational_Staff_Advt_2026.pdf',
        pdfSourceUrl: 'https://pakrail.gov.pk/careers/Pakistan_Railways_Operational_Staff_Advt_2026.pdf',
        pdfCaseNumber: 'PR-HQ-MECH-2026/01',
        pdfTotalVacanciesInCase: 12,
        domicileQuota: 'Merit: 1, Punjab: 6, Sindh: 2, KPK: 2, Balochistan: 1',
        challanFee: 'Rs. 500/- via NBP Account',
        ageRelaxationNote: '21-35 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '18th November 2026',
        sourceUrl: 'https://pakrail.gov.pk/careers/assistant-executive-engineer',
        scrapedSourceDomain: 'pakrail.gov.pk',
        scraperSourceName: 'Pakistan Railways Official Scraper',
        scrapedAt: '2026-08-26 09:00:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 7. Ministry of Railways
  {
    id: 'pdf-gazette-railways-mod-2026',
    title: 'Ministry of Railways Federal Secretariat & Project Staff Advt 2026',
    organization: 'Ministry of Railways (Government of Pakistan, Islamabad)',
    pdfFileName: 'Ministry_of_Railways_Project_Staff_2026.pdf',
    pdfUrl: 'https://railways.gov.pk/vacancies/Ministry_of_Railways_Project_Staff_2026.pdf',
    fileSizeFormatted: '2.5 MB',
    totalPages: 3,
    gazetteIssueNumber: 'MoR-FED-PMU-2026/02',
    publicationDate: '2026-08-12',
    closingDeadline: '20th November 2026',
    rawTextSample: `GOVERNMENT OF PAKISTAN - MINISTRY OF RAILWAYS
4th Floor, Block-D, Pak Secretariat, Islamabad | Website: https://railways.gov.pk
PROJECT MANAGEMENT UNIT - MAIN LINE (ML-1) UPGRADATION PROJECT

Position 1: DIRECTOR (INFRASTRUCTURE & TRACK MONITORING) (BPS-19 / PPS-10) - 02 POSTS
Qualifications: Master's in Civil/Structural Engineering or Project Management with 12+ years experience in heavy freight/passenger railway infrastructure.
Salary: PKR 380,000 - 500,000 / month.

Position 2: DEPUTY DIRECTOR (SAFETY, SIGNALLING & TELECOM) (BPS-18) - 04 POSTS
Qualifications: B.Sc / M.Sc Electrical / Telecom / Systems Engineering with 5 years experience in modern computerized interlocking signaling.
Posting: Islamabad / Regional PMU Units.`,
    extractedVacancies: [
      {
        id: 'pdf-mor-dir-01',
        title: 'Director (Infrastructure & Track Monitoring) - BPS-19',
        company: 'Ministry of Railways (Government of Pakistan, Islamabad)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Federal Capital Territory',
        city: 'Islamabad (Pak Secretariat)',
        salary: 'PKR 380,000 - PKR 500,000 / month (BPS-19 / PPS-10 Senior Project Scale)',
        salaryNumericMin: 380000,
        currency: 'PKR',
        experienceLevel: 'Senior',
        department: 'Main Line-1 (ML-1) Mega Project Management Unit',
        tags: ['Ministry of Railways', 'BPS-19', 'ML-1 Track', 'Islamabad', 'Federal Secretariat'],
        description: `Parsed from Ministry of Railways Federal Secretariat Notice (railways.gov.pk).\n\n• Case Ref: MoR-FED-PMU-2026/02\n• Scale: BPS-19 / PPS-10\n• Qualifications: Master's / BS in Civil/Structural Engineering with 12+ years expertise in modern high-speed track geometry and international railway safety standards.\n• Apply online at https://railways.gov.pk/vacancies`,
        requirements: [
          'MS / BS in Civil / Structural / Railway Engineering (HEC/PEC)',
          '12+ years proven track infrastructure planning experience',
          'Age: 35-50 years'
        ],
        benefits: [
          'Federal Government Project Pay Scale with Executive Vehicle Monetization',
          'International railway training symposiums',
          'Medical coverage for family'
        ],
        postedAt: '1 day ago',
        applicationsCount: 38,
        isGovtJob: true,
        govtDepartment: 'Ministry of Railways',
        govtScale: 'BPS-19',
        govtCategory: 'Federal',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'Ministry_of_Railways_Project_Staff_2026.pdf',
        pdfSourceUrl: 'https://railways.gov.pk/vacancies/Ministry_of_Railways_Project_Staff_2026.pdf',
        pdfCaseNumber: 'MoR-FED-PMU-2026/02',
        pdfTotalVacanciesInCase: 2,
        domicileQuota: 'All Pakistan Open Merit',
        challanFee: 'Nil',
        ageRelaxationNote: '35-50 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '20th November 2026',
        sourceUrl: 'https://railways.gov.pk/jobs/director-infrastructure',
        scrapedSourceDomain: 'railways.gov.pk',
        scraperSourceName: 'Ministry of Railways Official Scraper',
        scrapedAt: '2026-08-26 09:30:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 8. Ministry of Defence (MoD)
  {
    id: 'pdf-gazette-mod-2026',
    title: 'Ministry of Defence (MoD) Federal Security & Admin Notice 2026',
    organization: 'Ministry of Defence (MoD)',
    pdfFileName: 'Ministry_of_Defence_Consolidated_Notice_2026.pdf',
    pdfUrl: 'https://mod.gov.pk/careers/Ministry_of_Defence_Consolidated_Notice_2026.pdf',
    fileSizeFormatted: '3.8 MB',
    totalPages: 5,
    gazetteIssueNumber: 'MoD-ADMIN-2026/05',
    publicationDate: '2026-08-16',
    closingDeadline: '28th October 2026',
    rawTextSample: `GOVERNMENT OF PAKISTAN - MINISTRY OF DEFENCE
Pak Secretariat-II, Rawalpindi | Website: https://mod.gov.pk
RECRUITMENT TO VARIOUS POSTS IN MINISTRY OF DEFENCE & AFFILIATED FORMATIONS

1. ASSISTANT DIRECTOR (SECURITY & STRATEGIC PLANNING) (BPS-17) - 14 POSTS
Qualifications: Master's / BS (4-Years) in International Relations, Strategic Studies, Defense Analysis or Public Policy (2nd Division).
Age: 22-30 + 5 Years = 35 Years.
Quota: Merit = 01, Punjab = 07, Sindh (R) = 02, KPK = 02, Balochistan = 01, GB = 01.

2. TRAFFIC ANALYST / DATA SECURITY OFFICER (BPS-16) - 22 POSTS
Qualifications: Bachelor's in CS / IT / Mathematics / Cryptography.
Challan Fee: Rs. 400/- for BPS-16/17 payable via NBP.`,
    extractedVacancies: [
      {
        id: 'pdf-mod-ad-01',
        title: 'Assistant Director (Security & Strategic Planning) - BPS-17',
        company: 'Ministry of Defence (MoD Federal Secretariat)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Rawalpindi (Pak Secretariat-II)',
        salary: 'PKR 185,000 - PKR 265,000 / month (BPS-17 + Special Defence Allowance)',
        salaryNumericMin: 185000,
        currency: 'PKR',
        experienceLevel: 'Mid',
        department: 'Strategic Planning & Security Directorate',
        tags: ['Ministry of Defence', 'MoD', 'BPS-17', 'Strategic Studies', 'Rawalpindi'],
        description: `Extracted from Ministry of Defence official portal (mod.gov.pk).\n\n• Case Ref: MoD-SEC-2026/01\n• Scale: BPS-17 Gazetted\n• Total Vacancies: 14 Posts\n• Requirements: Master's / BS (16 Years) in International Relations, Strategic Studies, or CS.\n• Apply online at https://mod.gov.pk/careers`,
        requirements: [
          'Master / BS (4-Years) in IR, Strategic Studies, Political Science, or Defense & Strategic Studies',
          'Age: 22-35 Years (including general age relaxation)',
          'Security clearance vetting standard required'
        ],
        benefits: [
          'Federal Government Regular Cadre Pension & Benevolent Fund',
          'Executive Defence Allowance',
          'Federal Medical coverage'
        ],
        postedAt: '2 days ago',
        applicationsCount: 198,
        isGovtJob: true,
        govtDepartment: 'Ministry of Defence',
        govtScale: 'BPS-17',
        govtCategory: 'Defense',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'Ministry_of_Defence_Consolidated_Notice_2026.pdf',
        pdfSourceUrl: 'https://mod.gov.pk/careers/Ministry_of_Defence_Consolidated_Notice_2026.pdf',
        pdfCaseNumber: 'MoD-SEC-2026/01',
        pdfTotalVacanciesInCase: 14,
        domicileQuota: 'Merit: 1, Punjab: 7, Sindh-R: 2, KPK: 2, Balochistan: 1, GB: 1',
        challanFee: 'Rs. 400/- (Payable at NBP)',
        ageRelaxationNote: '22-35 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '28th October 2026',
        sourceUrl: 'https://mod.gov.pk/jobs/assistant-director-security',
        scrapedSourceDomain: 'mod.gov.pk',
        scraperSourceName: 'Ministry of Defence Official Scraper',
        scrapedAt: '2026-08-25 18:00:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 9. National Testing Service (NTS)
  {
    id: 'pdf-gazette-nts-2026',
    title: 'National Testing Service (NTS) Screening Projects Ingestion 2026',
    organization: 'National Testing Service - Pakistan (NTS)',
    pdfFileName: 'Consolidated_NTS_Screening_Projects_2026.pdf',
    pdfUrl: 'https://nts.org.pk/projects/Consolidated_NTS_Screening_Projects_2026.pdf',
    fileSizeFormatted: '4.5 MB',
    totalPages: 6,
    gazetteIssueNumber: 'NTS-PROJECT-2026/410',
    publicationDate: '2026-08-17',
    closingDeadline: '12th November 2026',
    rawTextSample: `NATIONAL TESTING SERVICE - PAKISTAN (NTS)
Plot # 96, Street # 4, H-8/1, Islamabad | Website: https://nts.org.pk | UAN: 051-844-444-1
SCREENING RECRUITMENT TEST PROJECTS - 2026

Project 1: NATIONAL HIGHWAY AUTHORITY (NHA) - ASSISTANT DIRECTORS (CIVIL / FINANCE / ADMN) (BPS-17) - 34 POSTS
Qualifications: B.Sc Civil Engineering / MBA Finance / M.Com / MPA.
Test Pattern: Subject (50%), English (20%), Analytical Reasoning (15%), General Knowledge (15%).
Challan Fee: Rs. 650/- via 1Link 1Bill Invoice.

Project 2: FESCO / LESCO - LINE SUPERINTENDENT (BPS-15) & COMMERCIAL ASSISTANTS (BPS-14) - 120 POSTS
Qualifications: DAE Electrical / B.Com.
Online registration and roll number slips exclusively at https://nts.org.pk`,
    extractedVacancies: [
      {
        id: 'pdf-nts-nha-01',
        title: 'Assistant Director (Civil Infrastructure) - BPS-17 (NHA Project)',
        company: 'National Highway Authority (via NTS Screening)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Federal Capital Territory',
        city: 'Islamabad (NHA Headquarters)',
        salary: 'PKR 170,000 - PKR 240,000 / month (BPS-17 + NHA Special Pay Scale)',
        salaryNumericMin: 170000,
        currency: 'PKR',
        experienceLevel: 'Mid',
        department: 'Highway Operations & Motorway Construction Cadre',
        tags: ['NTS Test', 'NHA', 'BPS-17', 'Civil Engineer', 'Motorways'],
        description: `Parsed from National Testing Service (nts.org.pk) screening advertisement.\n\n• Case Ref: NTS-NHA-2026/410-01\n• Scale: BPS-17\n• Organization: National Highway Authority (NHA)\n• Total Posts: 34 Vacancies\n• Testing Agency: National Testing Service (NTS)\n• Apply online at https://nts.org.pk`,
        requirements: [
          'B.Sc in Civil Engineering with valid PEC registration number',
          'Age: 21-30 years (+ 5 years relaxation = 35)',
          'Deposit of Rs. 650/- NTS screening test fee'
        ],
        benefits: [
          'NHA Regular Corporate Pay Scales with Expressway Allowance',
          'Health Insurance & Medical allowance',
          'Provident Fund & Gratuity'
        ],
        postedAt: '2 days ago',
        applicationsCount: 420,
        isGovtJob: true,
        govtDepartment: 'National Highway Authority (NHA)',
        govtScale: 'BPS-17',
        govtCategory: 'Public Sector',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'Consolidated_NTS_Screening_Projects_2026.pdf',
        pdfSourceUrl: 'https://nts.org.pk/projects/Consolidated_NTS_Screening_Projects_2026.pdf',
        pdfCaseNumber: 'NTS-NHA-2026/410-01',
        pdfTotalVacanciesInCase: 34,
        domicileQuota: 'Merit: 3, Punjab: 17, Sindh: 6, KPK: 5, Balochistan: 3',
        challanFee: 'Rs. 650/- via 1Link / 1Bill',
        ageRelaxationNote: '21-35 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '12th November 2026',
        sourceUrl: 'https://nts.org.pk/projects/nha-recruitment-2026',
        scrapedSourceDomain: 'nts.org.pk',
        scraperSourceName: 'National Testing Service (NTS) Official Scraper',
        scrapedAt: '2026-08-26 11:00:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 10. Open Testing Service (OTS)
  {
    id: 'pdf-gazette-ots-2026',
    title: 'Open Testing Service (OTS) Federal & Autonomous Recruitment Notice 2026',
    organization: 'Open Testing Service (OTS)',
    pdfFileName: 'OTS_Federal_Provincial_Recruitment_2026.pdf',
    pdfUrl: 'https://ots.org.pk/advertisements/OTS_Federal_Provincial_Recruitment_2026.pdf',
    fileSizeFormatted: '2.9 MB',
    totalPages: 4,
    gazetteIssueNumber: 'OTS-RECRUIT-2026/88',
    publicationDate: '2026-08-19',
    closingDeadline: '16th November 2026',
    rawTextSample: `OPEN TESTING SERVICE (OTS) - PAKISTAN
Office # 1, Central Avenue, Bahria Town, Islamabad | Website: https://ots.org.pk
RECRUITMENT TEST PROJECTS ACROSS FEDERAL & MUNICIPAL BODIES

Project: WATER & SANITATION AGENCY (WASA) / FEDERAL INVESTIGATION AGENCIES
1. ASSISTANT DIRECTOR (MONITORING & EVALUATION) (BPS-17) - 15 POSTS
Qualifications: Master's in Social Sciences / Economics / Statistics / Environmental Engineering.
Test Fee: Rs. 550/- via Bank Challan.

2. SUB-ENGINEER (WATER SUPPLY & DRAINAGE) (BPS-14) - 30 POSTS
Qualifications: DAE Civil with min 2nd Division.
Apply online at https://ots.org.pk`,
    extractedVacancies: [
      {
        id: 'pdf-ots-ad-01',
        title: 'Assistant Director (Monitoring & Evaluation) - BPS-17',
        company: 'Water & Sanitation Agency (via OTS Screening)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Lahore (WASA Directorate)',
        salary: 'PKR 165,000 - PKR 230,000 / month (BPS-17)',
        salaryNumericMin: 165000,
        currency: 'PKR',
        experienceLevel: 'Mid',
        department: 'Urban Water Infrastructure Project Directorate',
        tags: ['OTS Test', 'WASA', 'BPS-17', 'Monitoring', 'Civil Projects'],
        description: `Parsed from Open Testing Service (ots.org.pk) screening advertisement.\n\n• Case Ref: OTS-WASA-2026/88-01\n• Scale: BPS-17\n• Total Vacancies: 15 Posts\n• Testing Agency: Open Testing Service (OTS)\n• Apply online at https://ots.org.pk`,
        requirements: [
          "Master's Degree in Economics, Statistics, or Environmental/Civil Engineering",
          'Age: 22-33 Years',
          'OTS Deposit Slip (Rs. 550/-)'
        ],
        benefits: [
          'Public Sector Scale Benefits & Allowances',
          'Medical allowance & Provident Fund',
          'Special Project Allowance'
        ],
        postedAt: '1 day ago',
        applicationsCount: 160,
        isGovtJob: true,
        govtDepartment: 'Water & Sanitation Agency (WASA)',
        govtScale: 'BPS-17',
        govtCategory: 'Public Sector',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'OTS_Federal_Provincial_Recruitment_2026.pdf',
        pdfSourceUrl: 'https://ots.org.pk/advertisements/OTS_Federal_Provincial_Recruitment_2026.pdf',
        pdfCaseNumber: 'OTS-WASA-2026/88-01',
        pdfTotalVacanciesInCase: 15,
        domicileQuota: 'Punjab Domicile (All Districts)',
        challanFee: 'Rs. 550/- via Allied Bank / HBL Challan',
        ageRelaxationNote: '22-33 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '16th November 2026',
        sourceUrl: 'https://ots.org.pk/projects/wasa-recruitment-2026',
        scrapedSourceDomain: 'ots.org.pk',
        scraperSourceName: 'Open Testing Service (OTS) Official Scraper',
        scrapedAt: '2026-08-26 12:00:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 11. SIBA / Sukkur IBA Testing Service (STS)
  {
    id: 'pdf-gazette-sts-siba-2026',
    title: 'Sukkur IBA Testing Service (STS) Sindh Education & Revenue Notice 2026',
    organization: 'Sukkur IBA University Testing Service (STS)',
    pdfFileName: 'Sindh_Education_and_Revenue_Testing_Project_2026.pdf',
    pdfUrl: 'https://sts.net.pk/projects/Sindh_Education_and_Revenue_Testing_Project_2026.pdf',
    fileSizeFormatted: '3.7 MB',
    totalPages: 5,
    gazetteIssueNumber: 'STS-SIBA-2026/03',
    publicationDate: '2026-08-15',
    closingDeadline: '24th October 2026',
    rawTextSample: `SUKKUR IBA TESTING SERVICE (STS) - SUKKUR IBA UNIVERSITY
Airport Road, Sukkur, Sindh | Website: https://sts.net.pk | Contact: 071-5644159
MERIT-BASED RECRUITMENT TESTS FOR SCHOOL EDUCATION & SINDH REVENUE BOARD

1. HIGH SCHOOL TEACHER (HST / GENERAL & SCIENCE) (BPS-16) - 1,200 POSTS
Department: School Education & Literacy Department, Government of Sindh
Qualifications: Master's / BS (16-Years) with at least 50% marks in relevant subject (English, Mathematics, Physics, Chemistry, Biology, Pak Studies).
Age Limit: 21-30 + 15 Years General Age Relaxation as per Sindh Govt Notification = 45 Years Max.
Domicile / PRC: Relevant District / Taluka of Sindh Province.

2. ASSISTANT COMMISSIONER REVENUE AUDIT (BPS-17) - 25 POSTS
Department: Sindh Revenue Board (SRB)
Qualifications: CA / ACCA / MBA (Finance) / M.Com.
Challan Fee: Rs. 700/- payable via ABL / MCB / STS Online Payment Portal.`,
    extractedVacancies: [
      {
        id: 'pdf-sts-hst-01',
        title: 'High School Teacher (HST - Science & General) - BPS-16',
        company: 'Sindh School Education Department (via Sukkur IBA STS)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Sindh',
        city: 'Karachi / Sukkur / Hyderabad',
        salary: 'PKR 140,000 - PKR 190,000 / month (BPS-16 Teaching Scale + Teaching Allowance)',
        salaryNumericMin: 140000,
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'School Education & Literacy Department Sindh',
        tags: ['STS SIBA', 'HST Teacher', 'BPS-16', 'Sindh Education', 'Sukkur IBA'],
        description: `Parsed from Sukkur IBA Testing Service (sts.net.pk) official advertisement.\n\n• Case Ref: STS-SELD-HST-2026/01\n• Scale: BPS-16 Gazetted Cadre\n• Total Vacancies: 1,200 District-Wise Posts\n• Domicile: Sindh Rural & Urban Districts\n• Qualifications: 16-Year BS / Master's degree in Science / Humanities.\n• Apply online at https://sts.net.pk`,
        requirements: [
          "Master's or 4-Year BS in Mathematics, Physics, Chemistry, English or Pak Studies (min 50% Marks)",
          'Domicile & PRC-D: Sindh Province',
          'Age: Up to 45 Years (Inclusive of Sindh 15-year relaxation)',
          'Valid STS Paid Challan Receipt (Rs. 700/-)'
        ],
        benefits: [
          'Sindh Government Regular Teaching Pension Scheme',
          'Teaching Allowance (BPS-16)',
          'Free health insurance under Sindh Employee Healthcare System'
        ],
        postedAt: '1 day ago',
        applicationsCount: 1420,
        isGovtJob: true,
        govtDepartment: 'School Education & Literacy Department Sindh',
        govtScale: 'BPS-16',
        govtCategory: 'Education',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'Sindh_Education_and_Revenue_Testing_Project_2026.pdf',
        pdfSourceUrl: 'https://sts.net.pk/projects/Sindh_Education_and_Revenue_Testing_Project_2026.pdf',
        pdfCaseNumber: 'STS-SELD-HST-2026/01',
        pdfTotalVacanciesInCase: 1200,
        domicileQuota: 'Sindh Urban: 40%, Sindh Rural: 60% (Taluka Allocation)',
        challanFee: 'Rs. 700/- (Payable at ABL / MCB)',
        ageRelaxationNote: '21 to 45 Years (Inclusive of 15 Years Sindh Govt Age Relaxation)',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '24th October 2026',
        sourceUrl: 'https://sts.net.pk/projects/hst-seld-2026',
        scrapedSourceDomain: 'sts.net.pk',
        scraperSourceName: 'Sukkur IBA Testing Service (STS) Official Scraper',
        scrapedAt: '2026-08-26 10:30:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 12. Sindh Testing Service (STS-Pak)
  {
    id: 'pdf-gazette-sts-pak-2026',
    title: 'Sindh Testing Service (STS-Pak) Police & Health Recruitment 2026',
    organization: 'Sindh Testing Service (STS-Pakistan)',
    pdfFileName: 'STS_Pak_Sindh_Police_and_Health_2026.pdf',
    pdfUrl: 'https://sts.org.pk/projects/STS_Pak_Sindh_Police_and_Health_2026.pdf',
    fileSizeFormatted: '2.8 MB',
    totalPages: 4,
    gazetteIssueNumber: 'STS-PAK-POL-2026/19',
    publicationDate: '2026-08-16',
    closingDeadline: '30th October 2026',
    rawTextSample: `SINDH TESTING SERVICE - STS PAKISTAN
Website: https://sts.org.pk | Ph: 021-34522811
RECRUITMENT TESTS FOR SINDH POLICE (COMMANDO / CONSTABLE / ASI) & HEALTH ALLIED STAFF

1. POLICE CONSTABLE & LADY CONSTABLE (BPS-07) - 2,500 POSTS
Department: Sindh Police (Special Security Unit SSU & District Range Police)
Qualifications: Matriculation / Intermediate (2nd Division).
Physical Standard: Height 5'-5" (Male), 5'-0" (Female); 1.6 KM run in 7 mins.
Age: 18-28 Years.

2. HEALTH ALLIED PHARMACY TECHNICIAN (BPS-09) - 85 POSTS
Qualifications: F.Sc with Pharmacy Council B-Category Diploma.
Challan Fee: Rs. 500/- via EasyPaisa / JazzCash / Bank.`,
    extractedVacancies: [
      {
        id: 'pdf-stspak-pol-01',
        title: 'Police Constable / Commando (BPS-07) - 2,500 Posts',
        company: 'Sindh Police (via Sindh Testing Service STS-Pak)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Sindh',
        city: 'Karachi (Police Training College)',
        salary: 'PKR 75,000 - PKR 110,000 / month (BPS-07 + Police Special Risk Allowance)',
        salaryNumericMin: 75000,
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'Sindh Police (Special Security Unit & District Ranges)',
        tags: ['STS Pak', 'Sindh Police', 'BPS-07', 'Constable', 'Karachi'],
        description: `Parsed from Sindh Testing Service (sts.org.pk) recruitment notice.\n\n• Case Ref: STS-PAK-POL-2026/19\n• Scale: BPS-07\n• Total Vacancies: 2,500 Posts\n• Testing Agency: Sindh Testing Service (STS-Pak)\n• Apply online at https://sts.org.pk`,
        requirements: [
          'Matriculation or Intermediate from recognized board (2nd Div)',
          'Physical: Height 5\'-5" (Male), 5\'-0" (Female), Chest 33"x34.5"',
          'Physical Run: 1.6 KM in 7 minutes (Male) / 14 minutes (Female)',
          'Age: 18 to 28 Years'
        ],
        benefits: [
          'Sindh Police Uniform & Ration Allowance',
          'Special Security Risk Allowance',
          'Medical and Life Insurance coverage'
        ],
        postedAt: '1 day ago',
        applicationsCount: 3100,
        isGovtJob: true,
        govtDepartment: 'Sindh Police',
        govtScale: 'BPS-07',
        govtCategory: 'Defense',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'STS_Pak_Sindh_Police_and_Health_2026.pdf',
        pdfSourceUrl: 'https://sts.org.pk/projects/STS_Pak_Sindh_Police_and_Health_2026.pdf',
        pdfCaseNumber: 'STS-PAK-POL-2026/19',
        pdfTotalVacanciesInCase: 2500,
        domicileQuota: 'Sindh Urban & Rural Domicile Holders',
        challanFee: 'Rs. 500/- via Easypaisa / JazzCash / Bank',
        ageRelaxationNote: '18-28 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '30th October 2026',
        sourceUrl: 'https://sts.org.pk/projects/sindh-police-constable-2026',
        scrapedSourceDomain: 'sts.org.pk',
        scraperSourceName: 'Sindh Testing Service (STS-Pak) Official Scraper',
        scrapedAt: '2026-08-26 13:00:00',
        paymentStatus: 'Exempt'
      }
    ]
  },

  // 13. Career Testing Services Pakistan (CTSP)
  {
    id: 'pdf-gazette-ctsp-2026',
    title: 'Career Testing Services Pakistan (CTSP) KPK Police & Rescue 1122 Advt 2026',
    organization: 'Career Testing Services Pakistan (CTSP)',
    pdfFileName: 'CTSP_KPK_Police_Forest_Rescue_2026.pdf',
    pdfUrl: 'https://ctsp.com.pk/projects/CTSP_KPK_Police_Forest_Rescue_2026.pdf',
    fileSizeFormatted: '3.3 MB',
    totalPages: 5,
    gazetteIssueNumber: 'CTSP-KP-RECRUIT-2026/55',
    publicationDate: '2026-08-18',
    closingDeadline: '5th November 2026',
    rawTextSample: `CAREER TESTING SERVICES PAKISTAN (CTSP)
Office No. 801, Street 9, Sector I-8/4, Islamabad | Website: https://ctsp.com.pk | UAN: 051-111-004-877
RECRUITMENT SCREENING TESTS FOR KHYBER PAKHTUNKHWA DEPARTMENTS (2026)

1. EMERGENCY MEDICAL TECHNICIAN (EMT) (BPS-12) - 180 POSTS
Department: KPK Emergency Services (Rescue 1122)
Qualifications: D-Pharmacy / Nursing Diploma / F.Sc (Pre-Medical) with First Aid certification.
Age: 20-30 Years.

2. FOREST GUARD & DEPUTY RANGER (BPS-08 / BPS-11) - 320 POSTS
Department: Forestry, Environment & Wildlife Department KP
Qualifications: F.Sc / Matriculation. Physical endurance: 2 KM race in 10 mins.
Challan Fee: Rs. 480/- via JazzCash / 1Link.`,
    extractedVacancies: [
      {
        id: 'pdf-ctsp-rescue-01',
        title: 'Emergency Medical Technician (EMT - Rescue 1122) - BPS-12',
        company: 'KPK Emergency Rescue 1122 (via CTSP Testing)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Khyber Pakhtunkhwa',
        city: 'Peshawar / Mardan / Swat',
        salary: 'PKR 95,000 - PKR 140,000 / month (BPS-12 + Rescue Emergency Allowance)',
        salaryNumericMin: 95000,
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'KPK Emergency Rescue 1122 Service',
        tags: ['CTSP Test', 'Rescue 1122', 'BPS-12', 'EMT', 'KPK Govt'],
        description: `Extracted from Career Testing Services Pakistan (ctsp.com.pk) recruitment notice.\n\n• Case Ref: CTSP-KP-RESCUE-2026/55-01\n• Scale: BPS-12\n• Total Vacancies: 180 Posts across KPK Districts\n• Testing Agency: Career Testing Services Pakistan (CTSP)\n• Apply online at https://ctsp.com.pk`,
        requirements: [
          'F.Sc (Pre-Medical) / D-Pharmacy / Nursing Diploma (2nd Div)',
          'Physical fitness: Height 5\'-6" (Male), 5\'-2" (Female)',
          'Age: 20 to 30 Years',
          'Domicile: Khyber Pakhtunkhwa (All Districts / Merged FATA Districts)'
        ],
        benefits: [
          'KP Provincial Government Regular Cadre Pension',
          'Special Emergency Hazard Allowance (50% Basic Pay)',
          'Sehat Sahulat Medical Card'
        ],
        postedAt: '1 day ago',
        applicationsCount: 890,
        isGovtJob: true,
        govtDepartment: 'KPK Emergency Rescue 1122 Service',
        govtScale: 'BPS-12',
        govtCategory: 'Healthcare',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'CTSP_KPK_Police_Forest_Rescue_2026.pdf',
        pdfSourceUrl: 'https://ctsp.com.pk/projects/CTSP_KPK_Police_Forest_Rescue_2026.pdf',
        pdfCaseNumber: 'CTSP-KP-RESCUE-2026/55-01',
        pdfTotalVacanciesInCase: 180,
        domicileQuota: 'KPK Zonal Quotas (Zone 1 to Zone 5) & Merged Districts',
        challanFee: 'Rs. 480/- (Payable via JazzCash / 1Link / Bank)',
        ageRelaxationNote: '20-30 Years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '5th November 2026',
        sourceUrl: 'https://ctsp.com.pk/projects/kpk-rescue-1122-2026',
        scrapedSourceDomain: 'ctsp.com.pk',
        scraperSourceName: 'Career Testing Services Pakistan (CTSP) Official Scraper',
        scrapedAt: '2026-08-26 11:45:00',
        paymentStatus: 'Exempt'
      }
    ]
  }
];

/**
 * Utility to generate a complete ConsolidatedPdfGazette object when an Admin
 * adds a manual site/URL into the FPSC & WAPDA PDF Parser.
 */
export function generateGazetteFromManualInput(data: {
  title: string;
  organization: string;
  pdfUrl: string;
  gazetteIssueNumber?: string;
  closingDeadline?: string;
  totalPages?: number;
  fileSizeFormatted?: string;
  rawTextSample?: string;
}): ConsolidatedPdfGazette {
  const safeId = `pdf-gazette-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const cleanTitle = data.title.trim() || 'Custom Official Recruitment Gazette 2026';
  const cleanOrg = data.organization.trim() || 'Government / Public Sector Recruitment Wing';
  const cleanUrl = data.pdfUrl.trim();
  const fileName = cleanUrl.split('/').pop()?.split('?')[0] || `${cleanOrg.replace(/[^a-zA-Z0-9]/g, '_')}_Advt.pdf`;
  const issueNo = data.gazetteIssueNumber?.trim() || `Advt. No. ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
  const deadline = data.closingDeadline?.trim() || '30th November 2026';
  const pages = data.totalPages || 4;
  const size = data.fileSizeFormatted || '2.4 MB';

  // Generate realistic parsed vacancies tailored to the organization
  const isPunjab = cleanOrg.toLowerCase().includes('punjab') || cleanOrg.toLowerCase().includes('ppsc');
  const isSindh = cleanOrg.toLowerCase().includes('sindh') || cleanOrg.toLowerCase().includes('spsc') || cleanOrg.toLowerCase().includes('sts') || cleanOrg.toLowerCase().includes('sukkur');
  const isKpk = cleanOrg.toLowerCase().includes('kpk') || cleanOrg.toLowerCase().includes('kp') || cleanOrg.toLowerCase().includes('peshawar') || cleanOrg.toLowerCase().includes('ctsp');
  const isBalochistan = cleanOrg.toLowerCase().includes('balochistan') || cleanOrg.toLowerCase().includes('bpsc');

  const province = isPunjab ? 'Punjab' : isSindh ? 'Sindh' : isKpk ? 'Khyber Pakhtunkhwa' : isBalochistan ? 'Balochistan' : 'Federal Capital Territory';
  const city = isPunjab ? 'Lahore' : isSindh ? 'Karachi' : isKpk ? 'Peshawar' : isBalochistan ? 'Quetta' : 'Islamabad';

  const defaultRawText = data.rawTextSample?.trim() || `OFFICIAL CONSOLIDATED RECRUITMENT GAZETTE - ${cleanOrg.toUpperCase()}
${cleanTitle.toUpperCase()}
Issue: ${issueNo} | Website: ${cleanUrl}
Closing Deadline for Applications: ${deadline}

Case Ref: ${issueNo}-01: ASSISTANT DIRECTOR (ADMINISTRATION & IT) (BPS-17), ${cleanOrg.toUpperCase()}.
Minimum Qualifications: Second Class Master's Degree or BS (4-Years) in Computer Science / IT / Public Admin from HEC Recognized University.
Age Limit: 21-30 years (+5 years general relaxation = 35 years).
Number of Vacancies = 10.
Domicile: ${province} Provincial Basis / Regional Quota.
Fee: Rs. 500/- Payable via National Bank / 1Link.

Case Ref: ${issueNo}-02: DATA ENTRY OPERATOR / JUNIOR AUDITOR (BPS-16), ${cleanOrg.toUpperCase()}.
Minimum Qualifications: Intermediate with DIT or Bachelor's in Commerce / CS.
Age Limit: 18-28 years (+5 years relaxation = 33 years).
Number of Vacancies = 16.
Fee: Rs. 400/-.`;

  const vacancy1: Job = {
    id: `pdf-cust-${Date.now()}-1`,
    title: `Assistant Director (Admin & Systems) - BPS-17`,
    company: `${cleanOrg} (Official Gazette)`,
    jobType: 'On-site',
    region: 'Pakistan',
    province,
    city,
    salary: 'PKR 170,000 - PKR 240,000 / month (BPS-17 Gazetted Scale)',
    salaryNumericMin: 170000,
    currency: 'PKR',
    experienceLevel: 'Mid',
    department: `${cleanOrg} Administration`,
    tags: ['PDF Gazette', 'BPS-17', issueNo, cleanOrg, 'Govt Job'],
    description: `Official Gazetted position parsed from ${cleanTitle} via pdfplumber layout engine.\n\n• Case Ref: ${issueNo}-01\n• Scale: BPS-17\n• Total Vacancies: 10 Posts\n• Department: ${cleanOrg}\n• Qualification: Master's / BS (4-Years) in IT, Public Admin, or CS.\n• Age Limit: 21-35 Years.\n• Closing Date: ${deadline}.`,
    requirements: [
      "Master's Degree or 4-Year BS in CS / IT / Public Admin (HEC Recognized)",
      `Domicile: ${province} / Open Merit`,
      `Official Treasury Challan (${cleanOrg})`
    ],
    benefits: [
      'Provincial / Federal Regular Government Pension',
      'Official Medical and House Rent Allowance',
      'Career Scale Progression Cadre'
    ],
    postedAt: 'Just now',
    applicationsCount: 45,
    isGovtJob: true,
    govtDepartment: cleanOrg,
    govtScale: 'BPS-17',
    govtCategory: (isPunjab || isSindh || isKpk || isBalochistan) ? 'Provincial' : 'Federal',
    jobCategory: 'Government Sector',
    isPdfScraped: true,
    pdfFileName: fileName,
    pdfSourceUrl: cleanUrl,
    pdfCaseNumber: `${issueNo}-01`,
    pdfTotalVacanciesInCase: 10,
    domicileQuota: `${province} Open: 8, Women: 1, Minorities: 1`,
    challanFee: 'Rs. 500/- (Payable at NBP / 1Link)',
    ageRelaxationNote: '21-30 + 5 Years General Relaxation (35 Years Max)',
    pdfParserEngine: 'pdfplumber',
    deadlineDate: deadline,
    sourceUrl: cleanUrl,
    scrapedSourceDomain: new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl).hostname,
    scraperSourceName: `${cleanOrg} PDF Parser Source`,
    scrapedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    paymentStatus: 'Exempt'
  };

  const vacancy2: Job = {
    id: `pdf-cust-${Date.now()}-2`,
    title: `Data Specialist / Junior Officer (BPS-16)`,
    company: `${cleanOrg} (Official Gazette)`,
    jobType: 'On-site',
    region: 'Pakistan',
    province,
    city,
    salary: 'PKR 135,000 - PKR 185,000 / month (BPS-16 Scale)',
    salaryNumericMin: 135000,
    currency: 'PKR',
    experienceLevel: 'Entry',
    department: `${cleanOrg} Operations`,
    tags: ['PDF Gazette', 'BPS-16', issueNo, cleanOrg],
    description: `Parsed from ${cleanTitle}.\n\n• Case Ref: ${issueNo}-02\n• Scale: BPS-16\n• Total Vacancies: 16 Posts\n• Minimum Qualification: Bachelor's or Intermediate with 1-Year DIT.\n• Typing / Computer Literacy: Required.`,
    requirements: [
      'Bachelor / Intermediate with Computer Diploma (DIT)',
      'Typing & MS Office / Database proficiency',
      `Domicile: ${province}`
    ],
    benefits: [
      'Regular Government Pay Scale Allowances',
      'Pension and Benevolent Fund Benefits'
    ],
    postedAt: 'Just now',
    applicationsCount: 68,
    isGovtJob: true,
    govtDepartment: cleanOrg,
    govtScale: 'BPS-16',
    govtCategory: (isPunjab || isSindh || isKpk || isBalochistan) ? 'Provincial' : 'Federal',
    jobCategory: 'Government Sector',
    isPdfScraped: true,
    pdfFileName: fileName,
    pdfSourceUrl: cleanUrl,
    pdfCaseNumber: `${issueNo}-02`,
    pdfTotalVacanciesInCase: 16,
    domicileQuota: `${province} Open: 12, Women: 3, Minorities: 1`,
    challanFee: 'Rs. 400/-',
    ageRelaxationNote: '18-28 + 5 Years Relaxation',
    pdfParserEngine: 'pdfplumber',
    deadlineDate: deadline,
    sourceUrl: cleanUrl,
    scrapedSourceDomain: new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl).hostname,
    scraperSourceName: `${cleanOrg} PDF Parser Source`,
    scrapedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    paymentStatus: 'Exempt'
  };

  return {
    id: safeId,
    title: cleanTitle,
    organization: cleanOrg,
    pdfFileName: fileName,
    pdfUrl: cleanUrl,
    fileSizeFormatted: size,
    totalPages: pages,
    gazetteIssueNumber: issueNo,
    publicationDate: new Date().toISOString().split('T')[0],
    closingDeadline: deadline,
    rawTextSample: defaultRawText,
    extractedVacancies: [vacancy1, vacancy2]
  };
}
