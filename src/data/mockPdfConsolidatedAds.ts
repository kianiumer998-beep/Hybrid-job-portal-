import { ConsolidatedPdfGazette, Job } from '../types/job';

export const MOCK_CONSOLIDATED_PDF_GAZETTES: ConsolidatedPdfGazette[] = [
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

Case No. F.4-119/2026-R [8/2026] STATISTICAL OFFICER (BPS-17), PERMANENT, PAKISTAN BUREAU OF STATISTICS, MINISTRY OF PLANNING, DEVELOPMENT & SPECIAL INITIATIVES.
MINIMUM QUALIFICATION: Second Class or Grade 'C' Master's degree in Statistics / Econometrics / Mathematics.
AGE LIMIT: 22-30 years plus 5 years general age relaxation.
NUMBER OF VACANCIES = 8.
DOMICILE / QUOTA: Merit = 01, Punjab = 04, Sindh (Urban) = 01, Khyber Pakhtunkhwa = 01, Balochistan = 01.
Challan Fee: Rs. 300/- for BPS-17.

Case No. F.4-120/2026-R [8/2026] INSPECTOR CUSTOMS / PREVENTIVE OFFICER (BPS-16), PERMANENT, REVENUE DIVISION, FEDERAL BOARD OF REVENUE (FBR).
MINIMUM QUALIFICATION: Second Class or Grade 'C' Bachelor's degree from a recognized University with Economics, Commerce, Statistics, Accounting, Computer Science, Law, Pharmacy, Chemistry or Physics as one of the subjects.
PHYSICAL STANDARD: Minimum Height: 5'-6" (Male), 5'-2" (Female). Chest: 32"-33.5" (Male).
AGE LIMIT: 20-28 years plus 5 years general age relaxation (Total = 33 years).
NUMBER OF VACANCIES = 45.
DOMICILE / QUOTA: Merit = 04, Punjab = 22 (Open: 19, Women: 02, Minorities: 01), Sindh (R) = 05, Sindh (U) = 04, KPK = 05, Balochistan = 03, Ex-FATA = 01, AJK = 01.
Challan Fee: Rs. 300/- for BPS-16.

Case No. F.4-121/2026-R [8/2026] DIRECTOR (LEGAL & REGULATIONS) (BPS-19), TEMPORARY, MINISTRY OF LAW AND JUSTICE.
MINIMUM QUALIFICATION: Second Class or Grade 'C' Master's Degree in Law (LLM) with 10 years experience or LLB with 12 years standing at High Court Bar.
AGE LIMIT: 32-40 years plus 5 years general relaxation in upper age limit.
NUMBER OF VACANCIES = 2.
DOMICILE / QUOTA: Punjab = 01, Sindh (Rural) = 01.
Challan Fee: Rs. 1,200/- for BPS-19.`,
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
        id: 'pdf-fpsc-119',
        title: 'Statistical Officer (BPS-17)',
        company: 'Pakistan Bureau of Statistics (Ministry of Planning)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Federal Capital Territory',
        city: 'Islamabad',
        salary: 'PKR 180,000 - PKR 250,000 / month (BPS-17)',
        salaryNumericMin: 180000,
        currency: 'PKR',
        experienceLevel: 'Mid',
        department: 'Data Analytics & Census Wing',
        tags: ['FPSC Gazette', 'BPS-17', 'Case F.4-119/2026-R', 'Statistics', 'Planning Ministry'],
        description: `Extracted from FPSC Consolidated Advertisement No. 08/2026.\n\n• Case Reference: Case No. F.4-119/2026-R [8/2026]\n• Position: Statistical Officer (BPS-17)\n• Department: Pakistan Bureau of Statistics\n• Total Vacancies: 8\n• Quotas: Merit = 01, Punjab = 04, Sindh (Urban) = 01, KPK = 01, Balochistan = 01\n• Qualifications: Master's or BS (16 Years) in Statistics / Econometrics / Mathematics / Data Science.\n• Challan Fee: Rs. 300/-`,
        requirements: [
          "Master's Degree / 4-Year BS in Statistics / Econometrics / Mathematics",
          'Age: 22-30 years + 5 years general relaxation',
          'Proficiency with SPSS, R, Python or statistical census modeling'
        ],
        benefits: [
          'Federal Government Regular Pension',
          'Census and Special Field Allowances',
          'Medical coverage for self and family'
        ],
        postedAt: '2 days ago',
        applicationsCount: 76,
        isGovtJob: true,
        govtDepartment: 'Pakistan Bureau of Statistics',
        govtScale: 'BPS-17',
        govtCategory: 'Federal',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'FPSC_Consolidated_Advt_No_08_2026.pdf',
        pdfSourceUrl: 'https://fpsc.gov.pk/advertisements/Consolidated_Advt_No_08_2026.pdf',
        pdfCaseNumber: 'Case No. F.4-119/2026-R [8/2026]',
        pdfTotalVacanciesInCase: 8,
        domicileQuota: 'Merit: 1, Punjab: 4, Sindh (U): 1, KPK: 1, Balochistan: 1',
        challanFee: 'Rs. 300/- (Payable at NBP)',
        ageRelaxationNote: '22-30 years + 5 years general relaxation',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '22nd September 2026',
        sourceUrl: 'https://fpsc.gov.pk/jobs/gr/current-vacancies/case-f4-119-2026-r',
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
        description: `45 Openings for Inspector Customs / Preventive Officer (BPS-16) under FPSC Consolidated Advertisement No. 08/2026.\n\n• Reference: Case No. F.4-120/2026-R [8/2026]\n• Department: Federal Board of Revenue (FBR)\n• Scale: BPS-16\n• Total Vacancies: 45 Posts\n• Provincial Quota: Merit = 04, Punjab = 22 (Open: 19, Women: 2, Minorities: 1), Sindh (R) = 05, Sindh (U) = 04, KPK = 05, Balochistan = 03, Ex-FATA = 01, AJK = 01\n• Physical Standards: Height: 5'-6" (Male), 5'-2" (Female); Chest: 32"-33.5" (Male)\n• Challan: Rs. 300/-`,
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
        domicileQuota: 'Merit: 4, Punjab: 22, Sindh-R: 5, Sindh-U: 4, KPK: 5, Balochistan: 3, Ex-FATA: 1, AJK: 1',
        challanFee: 'Rs. 300/- (Payable at NBP)',
        ageRelaxationNote: '20-28 years + 5 years general relaxation (Max 33 Years)',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '22nd September 2026',
        sourceUrl: 'https://fpsc.gov.pk/jobs/gr/current-vacancies/case-f4-120-2026-r',
        scrapedSourceDomain: 'fpsc.gov.pk',
        scraperSourceName: 'FPSC Official Consolidated Gazette PDF Scraper',
        scrapedAt: '2026-08-25 09:30:00',
        paymentStatus: 'Exempt'
      },
      {
        id: 'pdf-fpsc-121',
        title: 'Director (Legal & Regulations) - BPS-19',
        company: 'Ministry of Law & Justice (Federal Govt)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Federal Capital Territory',
        city: 'Islamabad',
        salary: 'PKR 280,000 - PKR 390,000 / month (BPS-19 Senior Executive)',
        salaryNumericMin: 280000,
        currency: 'PKR',
        experienceLevel: 'Senior',
        department: 'Legislative & Legal Drafting Wing',
        tags: ['FPSC Gazette', 'BPS-19', 'Case F.4-121/2026-R', 'Legal Director', 'Law Ministry'],
        description: `Senior Executive Legal Officer post from FPSC Consolidated Gazette 08/2026.\n\n• Case Reference: Case No. F.4-121/2026-R\n• Scale: BPS-19\n• Total Vacancies: 2 Posts\n• Quota: Punjab = 01, Sindh (Rural) = 01\n• Qualifications: LLM with 10 years experience or LLB with 12 years High Court Bar Standing.\n• Challan Fee: Rs. 1,200/-`,
        requirements: [
          'LLM with 10 years standing or LLB with 12 years active High Court bar practice',
          'Age: 32-40 years + 5 years general relaxation (Up to 45 Years)',
          'Experience in statutory drafting and federal litigation'
        ],
        benefits: [
          'BPS-19 Official Chauffeur Driven Vehicle / Transport Monetization',
          'Executive Judicial Allowance',
          'Federal Government Pension & Benevolent Fund'
        ],
        postedAt: '2 days ago',
        applicationsCount: 28,
        isGovtJob: true,
        govtDepartment: 'Ministry of Law and Justice',
        govtScale: 'BPS-19',
        govtCategory: 'Federal',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'FPSC_Consolidated_Advt_No_08_2026.pdf',
        pdfSourceUrl: 'https://fpsc.gov.pk/advertisements/Consolidated_Advt_No_08_2026.pdf',
        pdfCaseNumber: 'Case No. F.4-121/2026-R [8/2026]',
        pdfTotalVacanciesInCase: 2,
        domicileQuota: 'Punjab: 1, Sindh (Rural): 1',
        challanFee: 'Rs. 1,200/- (Payable at NBP)',
        ageRelaxationNote: '32-40 years + 5 years general relaxation (Max 45 Years)',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '22nd September 2026',
        sourceUrl: 'https://fpsc.gov.pk/jobs/gr/current-vacancies/case-f4-121-2026-r',
        scrapedSourceDomain: 'fpsc.gov.pk',
        scraperSourceName: 'FPSC Official Consolidated Gazette PDF Scraper',
        scrapedAt: '2026-08-25 09:30:00',
        paymentStatus: 'Exempt'
      }
    ]
  },
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
Applications are invited from Pakistani Nationals for Diamer Bhasha, Mohmand, Dasu, Tarbela & Key Hydroelectric Projects.

Sr. No. 1: JUNIOR ENGINEER (CIVIL) (BPS-17) - 38 POSTS
Pay Scale: BPS-17 | Age Limit: 21-33 Years (including general age relaxation)
Qualification: B.Sc / B.E in Civil Engineering from HEC recognized University with valid PEC Registration.
Quota: Open Merit = 03, Punjab = 19 (Open: 16, Women: 02, Minorities: 01), Sindh (U) = 03, Sindh (R) = 04, KPK = 04, Balochistan = 03, Ex-FATA = 01, GB = 01.
Posting: Dasu Hydel Project / Diamer Bhasha Dam Site.

Sr. No. 2: JUNIOR ENGINEER (ELECTRICAL / MECHANICAL) (BPS-17) - 24 POSTS
Pay Scale: BPS-17 | Age Limit: 21-33 Years
Qualification: B.Sc / B.E in Electrical / Electronics / Mechanical Engineering with PEC Registration.
Quota: Open Merit = 02, Punjab = 12, Sindh = 04, KPK = 03, Balochistan = 02, AJK = 01.
Posting: Tarbela 5th Extension / Mangla Refurbishment / Ghazi Barotha.

Sr. No. 3: ASSISTANT ACCOUNTS OFFICER (BPS-17) - 12 POSTS
Pay Scale: BPS-17 | Age Limit: 22-30 Years + 5 Years Relaxation
Qualification: M.Com / MBA (Finance) / CMA Inter / ACCA with at least 1st / 2nd Division.
Quota: Open Merit = 01, Punjab = 06, Sindh (R) = 02, KPK = 02, Balochistan = 01.
Posting: WAPDA Central Office Lahore / Regional Finance Wings.

Sr. No. 4: SUB-ENGINEER (CIVIL) (BPS-14) - 52 POSTS
Pay Scale: BPS-14 | Age Limit: 18-30 Years
Qualification: 3-Years Diploma of Associate Engineer (DAE) in Civil Technology with minimum 1st Division.
Quota: Local Project Quota (Kohistan / Diamer / Chilas = 15), Punjab = 20, Sindh = 08, KPK = 06, Balochistan = 03.
Testing Agency: National Testing Service (NTS) / PTS. Fee: Rs. 450/-`,
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
        description: `Extracted from WAPDA Recruitment Notice Phase II 2026 PDF Advertisement.\n\n• Position: Junior Engineer (Civil) - BPS-17\n• Total Vacancies: 38 Posts\n• Organization: WAPDA Water Wing\n• Posting: Dasu Dam / Diamer Bhasha / Mohmand Dam Project Sites\n• Quotas: Merit = 03, Punjab = 19 (Open: 16, Women: 2, Minorities: 1), Sindh (U) = 03, Sindh (R) = 04, KPK = 04, Balochistan = 03, Ex-FATA = 01, GB = 01\n• Qualifications: B.Sc / B.E in Civil Engineering with active PEC registration number.\n• Closing Date: 30th September 2026.`,
        requirements: [
          'B.Sc / B.E in Civil Engineering from HEC recognized University with valid PEC Registration',
          'Age: 21 to 33 years (including general relaxation)',
          'Willingness to serve at mega dam construction project sites'
        ],
        benefits: [
          '50% Project Site Hardship Allowance & Free Furnished Accommodation at Colony',
          'WAPDA Pension Scheme, Gratuity & Free Electricity Units Quota',
          'Free Medical Treatment at WAPDA Central Hospital Lahore & field dispensaries'
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
        ageRelaxationNote: '21-33 years (inclusive of 5-year federal relaxation)',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '30th September 2026',
        sourceUrl: 'https://wapda.gov.pk/careers/junior-engineer-civil-phase-2',
        scrapedSourceDomain: 'wapda.gov.pk',
        scraperSourceName: 'WAPDA Official Recruitment PDF Ingestion',
        scrapedAt: '2026-08-25 11:15:00',
        paymentStatus: 'Exempt'
      },
      {
        id: 'pdf-wapda-eng-02',
        title: 'Junior Engineer (Electrical / Mechanical) - BPS-17',
        company: 'Water & Power Development Authority (WAPDA)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Khyber Pakhtunkhwa',
        city: 'Tarbela Hydel Power Station',
        salary: 'PKR 190,000 - PKR 270,000 / month (BPS-17)',
        salaryNumericMin: 190000,
        currency: 'PKR',
        experienceLevel: 'Entry',
        department: 'Power Wing (Tarbela 5th Ext & Mangla Refurbishment)',
        tags: ['WAPDA PDF Gazette', 'BPS-17', 'Electrical Engineer', 'Mechanical Engineer', 'Tarbela'],
        description: `WAPDA Power Wing Recruitment Notice Phase II 2026.\n\n• Case Reference: WAPDA-ENGR-2026/02\n• Scale: BPS-17 (24 Openings)\n• Quota: Open Merit = 02, Punjab = 12, Sindh = 04, KPK = 03, Balochistan = 02, AJK = 01\n• Qualifications: B.Sc / B.E in Electrical / Electronics / Mechanical Engineering with PEC Registration.\n• Posting: Tarbela / Mangla / Ghazi Barotha Hydropower complexes.`,
        requirements: [
          'B.Sc / B.E in Electrical / Mechanical / Electronics Engineering with PEC Registration',
          'Age: 21-33 years',
          'Knowledge of turbine maintenance, hydro-generators, and high-voltage switchyards'
        ],
        benefits: [
          'Hydel Power Generation Allowance',
          'WAPDA House Colony accommodation at Tarbela / Mangla',
          'Family health medical entitlement'
        ],
        postedAt: '3 days ago',
        applicationsCount: 245,
        isGovtJob: true,
        govtDepartment: 'Water & Power Development Authority (WAPDA)',
        govtScale: 'BPS-17',
        govtCategory: 'Public Sector',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'WAPDA_Recruitment_Notice_Phase_II_2026.pdf',
        pdfSourceUrl: 'https://wapda.gov.pk/careers/Adv_WAPDA_Phase_II_2026.pdf',
        pdfCaseNumber: 'WAPDA-ENGR-2026/02',
        pdfTotalVacanciesInCase: 24,
        domicileQuota: 'Merit: 2, Punjab: 12, Sindh: 4, KPK: 3, Balochistan: 2, AJK: 1',
        challanFee: 'Rs. 450/- via NTS / 1Link Portal',
        ageRelaxationNote: '21-33 years',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '30th September 2026',
        sourceUrl: 'https://wapda.gov.pk/careers/junior-engineer-electrical-mech-phase-2',
        scrapedSourceDomain: 'wapda.gov.pk',
        scraperSourceName: 'WAPDA Official Recruitment PDF Ingestion',
        scrapedAt: '2026-08-25 11:15:00',
        paymentStatus: 'Exempt'
      },
      {
        id: 'pdf-wapda-fin-03',
        title: 'Assistant Accounts Officer (BPS-17)',
        company: 'Water & Power Development Authority (WAPDA)',
        jobType: 'On-site',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Lahore',
        district: 'WAPDA House (The Mall)',
        salary: 'PKR 175,000 - PKR 245,000 / month (BPS-17)',
        salaryNumericMin: 175000,
        currency: 'PKR',
        experienceLevel: 'Mid',
        department: 'Finance & Accounts Division',
        tags: ['WAPDA PDF Gazette', 'BPS-17', 'Accounts Officer', 'ACCA / MBA', 'WAPDA House'],
        description: `WAPDA Finance Wing hiring 12 Assistant Accounts Officers (BPS-17) under Phase II 2026 PDF Notice.\n\n• Case Ref: WAPDA-FIN-2026/03\n• Scale: BPS-17\n• Total Vacancies: 12\n• Quota: Open Merit = 01, Punjab = 06, Sindh (R) = 02, KPK = 02, Balochistan = 01\n• Qualifications: M.Com / MBA (Finance) / CMA Inter / ACCA qualified.\n• Posting: WAPDA House Lahore / Project Field Accounts Units.`,
        requirements: [
          'M.Com / MBA Finance / ACCA / CA Inter / CMA Inter',
          'Age: 22-30 years (+5 years general relaxation = 35)',
          'Experience in public sector accounting, ERP systems, and project disbursement audits'
        ],
        benefits: [
          'Regular WAPDA Pension & Gratuity',
          'WAPDA House Central Office allowances',
          'Free Electricity Units Allowance'
        ],
        postedAt: '3 days ago',
        applicationsCount: 160,
        isGovtJob: true,
        govtDepartment: 'Water & Power Development Authority (WAPDA)',
        govtScale: 'BPS-17',
        govtCategory: 'Public Sector',
        jobCategory: 'Government Sector',
        isPdfScraped: true,
        pdfFileName: 'WAPDA_Recruitment_Notice_Phase_II_2026.pdf',
        pdfSourceUrl: 'https://wapda.gov.pk/careers/Adv_WAPDA_Phase_II_2026.pdf',
        pdfCaseNumber: 'WAPDA-FIN-2026/03',
        pdfTotalVacanciesInCase: 12,
        domicileQuota: 'Merit: 1, Punjab: 6, Sindh (R): 2, KPK: 2, Balochistan: 1',
        challanFee: 'Rs. 450/- via NTS / 1Link Portal',
        ageRelaxationNote: '22-30 years + 5 years general relaxation',
        pdfParserEngine: 'pdfplumber',
        deadlineDate: '30th September 2026',
        sourceUrl: 'https://wapda.gov.pk/careers/assistant-accounts-officer',
        scrapedSourceDomain: 'wapda.gov.pk',
        scraperSourceName: 'WAPDA Official Recruitment PDF Ingestion',
        scrapedAt: '2026-08-25 11:15:00',
        paymentStatus: 'Exempt'
      }
    ]
  }
];
