export interface LandingHeroConfig {
  eyebrowBadgeText: string;
  hiringBannerTitle: string;
  hiringBannerSub: string;
  hiringBannerBadge: string;
  hiringBannerBtnText: string;
  hiringBannerBtnUrl: string; // e.g. '#dashboard' or '#post-job'
  mainHeadingPrefix: string;
  gradientWord: string;
  mainHeadingSuffix: string;
  subHeading: string;
  primaryBtnText: string;
  primaryBtnUrl: string;
  secondaryBtnText: string;
  secondaryBtnUrl: string;
  searchPlaceholder: string;
  statBadge1Text: string;
  statBadge2Text: string;
  statBadge3Text: string;
  statBadge4Text: string;
}

export interface CustomLandingCard {
  id: string;
  title: string;
  description: string;
  badge: string;
  buttonText: string;
  buttonUrl: string;
  bgGradient: string; // Tailwind gradient class
  isEnabled: boolean;
  order: number;
}

export type LandingSectionId = 
  | 'hero'
  | 'promo-banners'
  | 'top-sponsor-ads'
  | 'quick-stats'
  | 'custom-announcements'
  | 'jobs-feed';

export interface LandingSectionOrder {
  id: LandingSectionId;
  name: string;
  description: string;
  isEnabled: boolean;
  order: number;
}

export interface CategoryPostingFee {
  categoryId: string;
  categoryName: string;
  feePkr: number;
  isFree: boolean;
  discountPercent: number;
}

export interface LandingPageConfig {
  hero: LandingHeroConfig;
  sections: LandingSectionOrder[];
  customCards: CustomLandingCard[];
  categoryPostingFees: CategoryPostingFee[];
  exemptUserIds: string[]; // Users/Employers exempt from posting fees
  exemptUserEmails: string[];
}

export const DEFAULT_CATEGORY_POSTING_FEES: CategoryPostingFee[] = [
  { categoryId: 'cat-it', categoryName: 'IT, Software & AI Engineering', feePkr: 600, isFree: false, discountPercent: 0 },
  { categoryId: 'cat-govt', categoryName: 'Government Sector & Public Scale', feePkr: 0, isFree: true, discountPercent: 0 },
  { categoryId: 'cat-health', categoryName: 'Healthcare & Medical Practice', feePkr: 500, isFree: false, discountPercent: 0 },
  { categoryId: 'cat-eng', categoryName: 'Engineering & Construction', feePkr: 500, isFree: false, discountPercent: 0 },
  { categoryId: 'cat-finance', categoryName: 'Banking, Finance & Accounts', feePkr: 500, isFree: false, discountPercent: 0 },
  { categoryId: 'cat-edu', categoryName: 'Education, Teaching & Academia', feePkr: 400, isFree: false, discountPercent: 0 },
  { categoryId: 'cat-remote', categoryName: 'International Remote Roles', feePkr: 800, isFree: false, discountPercent: 0 },
  { categoryId: 'cat-corp', categoryName: 'Private Corporate & HR', feePkr: 500, isFree: false, discountPercent: 0 },
  { categoryId: 'cat-news', categoryName: 'Newspaper Classified Jobs', feePkr: 0, isFree: true, discountPercent: 0 }
];

export const DEFAULT_LANDING_PAGE_CONFIG: LandingPageConfig = {
  hero: {
    eyebrowBadgeText: '#1 Unified Remote Portal & Automated CV Engine for Pakistan & Global',
    hiringBannerTitle: 'Want to Hire? Register now to post a job instantly!',
    hiringBannerSub: 'Post your job today and find top verified remote & hybrid talent in Pakistan and worldwide.',
    hiringBannerBadge: 'Hiring Employers & Recruiters',
    hiringBannerBtnText: 'Post a Job Now',
    hiringBannerBtnUrl: '#dashboard',
    mainHeadingPrefix: 'Find Your Next',
    gradientWord: 'Hybrid or Remote',
    mainHeadingSuffix: 'Career Opportunity',
    subHeading: 'Browse verified opportunities globally or target localized jobs across Pakistan down to Province, City, and District levels. Build ATS-optimized resumes in minutes.',
    primaryBtnText: 'Browse Verified Jobs',
    primaryBtnUrl: '#jobs-section',
    secondaryBtnText: 'Build ATS Resume (Free)',
    secondaryBtnUrl: '#cv',
    searchPlaceholder: 'Search job title, skills, keywords or company...',
    statBadge1Text: 'Verified Hybrid & Remote Jobs',
    statBadge2Text: '100% Free ATS Resume Builder',
    statBadge3Text: 'Province & City Granular Filters',
    statBadge4Text: 'Direct WhatsApp & SMS Alerts'
  },
  sections: [
    { id: 'hero', name: '1. Hero Section & Employer Quick Action', description: 'Main banner, employer register CTA, and quick explore buttons.', isEnabled: true, order: 1 },
    { id: 'promo-banners', name: '2. Active Promotional Discount Banners', description: 'Site-wide flash discounts (e.g. 50% Off, Free Posting Week).', isEnabled: true, order: 2 },
    { id: 'top-sponsor-ads', name: '3. Top Sponsor Sticky/Header Banner', description: 'High-visibility sponsor brand advertisements.', isEnabled: true, order: 3 },
    { id: 'quick-stats', name: '4. Key Statistics & Trust Highlights', description: 'Counters and verified credentials showcase.', isEnabled: true, order: 4 },
    { id: 'custom-announcements', name: '5. Custom Dynamic Announcement Cards', description: 'Admin-created marketing blocks and special notices.', isEnabled: true, order: 5 },
    { id: 'jobs-feed', name: '6. Job Listings Feed & Search Filters', description: 'Main searchable database of live verified career listings.', isEnabled: true, order: 6 }
  ],
  customCards: [
    {
      id: 'card-relocation',
      title: '✈️ Gulf & Middle East Fast-Track Visas',
      description: 'Exclusive sponsored vacancies in UAE, Saudi Arabia & Qatar with flight and visa sponsorship.',
      badge: 'Overseas Jobs',
      buttonText: 'View Gulf Opportunities',
      buttonUrl: '#jobs',
      bgGradient: 'from-amber-600 via-orange-600 to-rose-700',
      isEnabled: true,
      order: 1
    },
    {
      id: 'card-govt-gazette',
      title: '📜 FPSC & PPSC Official Gazettes',
      description: 'Download verified government recruitment notices and challan forms directly.',
      badge: 'Public Sector',
      buttonText: 'Explore Govt Exams',
      buttonUrl: '#jobs',
      bgGradient: 'from-emerald-700 via-teal-800 to-slate-900',
      isEnabled: true,
      order: 2
    }
  ],
  categoryPostingFees: DEFAULT_CATEGORY_POSTING_FEES,
  exemptUserIds: [],
  exemptUserEmails: ['vip.employer@devsinc.com', 'admin@careers.com']
};

export interface CountryOption {
  code: string;
  name: string;
  nameUrdu: string;
  flag: string;
  region: string;
  popular?: boolean;
}

export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { code: 'PK', name: 'Pakistan', nameUrdu: 'پاکستان', flag: '🇵🇰', region: 'Pakistan', popular: true },
  { code: 'SA', name: 'Saudi Arabia', nameUrdu: 'سعودی عرب', flag: '🇸🇦', region: 'Saudi Arabia', popular: true },
  { code: 'AE', name: 'United Arab Emirates', nameUrdu: 'متحدہ عرب امارات (UAE)', flag: '🇦🇪', region: 'UAE', popular: true },
  { code: 'QA', name: 'Qatar', nameUrdu: 'قطر', flag: '🇶🇦', region: 'Qatar', popular: true },
  { code: 'OM', name: 'Oman', nameUrdu: 'عمان', flag: '🇴🇲', region: 'Oman', popular: true },
  { code: 'KW', name: 'Kuwait', nameUrdu: 'کویت', flag: '🇰🇼', region: 'Kuwait', popular: true },
  { code: 'BH', name: 'Bahrain', nameUrdu: 'بحرین', flag: '🇧🇭', region: 'Bahrain', popular: true },
  { code: 'GB', name: 'United Kingdom', nameUrdu: 'برطانیہ (UK)', flag: '🇬🇧', region: 'UK', popular: true },
  { code: 'US', name: 'United States', nameUrdu: 'امریکا (USA)', flag: '🇺🇸', region: 'US', popular: true },
  { code: 'CA', name: 'Canada', nameUrdu: 'کینیڈا', flag: '🇨🇦', region: 'Canada', popular: true },
  { code: 'AU', name: 'Australia', nameUrdu: 'آسٹریلیا', flag: '🇦🇺', region: 'Australia', popular: true },
  { code: 'DE', name: 'Germany', nameUrdu: 'جرمنی', flag: '🇩🇪', region: 'Europe', popular: true },
  { code: 'GL', name: 'Global / Worldwide', nameUrdu: 'تمام ممالک (گلوبل)', flag: '🌐', region: 'All', popular: true }
];
