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
  design4HeroImageUrl?: string;
  design5SeekerImageUrl?: string;
  design5EmployerImageUrl?: string;
  design45HeroOverlay?: number;
  design45AccentColor?: string;
}

export interface CustomLandingCard {
  id: string;
  title: string;
  description: string;
  badge: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string; // Optional HTTPS or same-origin image for this design's announcement card
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

export interface JobCardDesignConfig {
  layout: 'default' | 'compact';
  theme: {
    accentColor: string; // Tailwind color name like 'emerald', 'indigo', etc.
    borderRadius: 'none' | 'md' | 'xl' | '3xl';
    cardBgPreset: 'slate' | 'glass' | 'gradient';
    density: 'compact' | 'normal' | 'spacious';
  };
  visibility: {
    title: boolean;
    company: boolean;
    location: boolean;
    postedDate: boolean;
    description: boolean;
    tags: boolean;
    salary: boolean;
    jobType: boolean;
    govtBadge: boolean;
    featuredBadge: boolean;
    urgentBadge: boolean;
    newspaperBadge: boolean;
    pdfBadge: boolean;
    futureBadge: boolean;
    vipBadge?: boolean;
    pinnedBadge?: boolean;
    poster?: boolean;
    relativePostedTime?: boolean;
    exactPostedDate?: boolean;
    deadlineDate?: boolean;
    deadlineRemaining?: boolean;
    duplicateOverrideBadge?: boolean;
    saveButton: boolean;
    detailsButton: boolean;
    applyButton: boolean;
  };
  labels: {
    saveButton: string;
    detailsButton: string;
    applyButton: string;
    cardHeading: string;
  };
  limits: {
    descriptionMaxWords: number;
    maxTags: number;
  };
}

export type JobCardAccentColor = 'emerald' | 'indigo' | 'violet' | 'rose' | 'amber' | 'sky';

export const JOB_CARD_ACCENT_STYLES: Record<JobCardAccentColor, {
  solidBg: string;
  solidHover: string;
  gradientFrom: string;
  gradientHoverFrom: string;
  text: string;
  shadow: string;
  ring: string;
  hoverBorder: string;
  gradientEnd: string;
  previewSubtle: string;
  previewSoft: string;
}> = {
  emerald: { solidBg: 'bg-emerald-500', solidHover: 'hover:bg-emerald-400', gradientFrom: 'from-emerald-500', gradientHoverFrom: 'hover:from-emerald-400', text: 'text-emerald-400', shadow: 'shadow-emerald-500/20', ring: 'ring-emerald-400/40', hoverBorder: 'hover:border-emerald-500/50', gradientEnd: 'to-emerald-950/30', previewSubtle: 'bg-emerald-500/20', previewSoft: 'bg-emerald-500/10' },
  indigo: { solidBg: 'bg-indigo-500', solidHover: 'hover:bg-indigo-400', gradientFrom: 'from-indigo-500', gradientHoverFrom: 'hover:from-indigo-400', text: 'text-indigo-400', shadow: 'shadow-indigo-500/20', ring: 'ring-indigo-400/40', hoverBorder: 'hover:border-indigo-500/50', gradientEnd: 'to-indigo-950/30', previewSubtle: 'bg-indigo-500/20', previewSoft: 'bg-indigo-500/10' },
  violet: { solidBg: 'bg-violet-500', solidHover: 'hover:bg-violet-400', gradientFrom: 'from-violet-500', gradientHoverFrom: 'hover:from-violet-400', text: 'text-violet-400', shadow: 'shadow-violet-500/20', ring: 'ring-violet-400/40', hoverBorder: 'hover:border-violet-500/50', gradientEnd: 'to-violet-950/30', previewSubtle: 'bg-violet-500/20', previewSoft: 'bg-violet-500/10' },
  rose: { solidBg: 'bg-rose-500', solidHover: 'hover:bg-rose-400', gradientFrom: 'from-rose-500', gradientHoverFrom: 'hover:from-rose-400', text: 'text-rose-400', shadow: 'shadow-rose-500/20', ring: 'ring-rose-400/40', hoverBorder: 'hover:border-rose-500/50', gradientEnd: 'to-rose-950/30', previewSubtle: 'bg-rose-500/20', previewSoft: 'bg-rose-500/10' },
  amber: { solidBg: 'bg-amber-500', solidHover: 'hover:bg-amber-400', gradientFrom: 'from-amber-500', gradientHoverFrom: 'hover:from-amber-400', text: 'text-amber-400', shadow: 'shadow-amber-500/20', ring: 'ring-amber-400/40', hoverBorder: 'hover:border-amber-500/50', gradientEnd: 'to-amber-950/30', previewSubtle: 'bg-amber-500/20', previewSoft: 'bg-amber-500/10' },
  sky: { solidBg: 'bg-sky-500', solidHover: 'hover:bg-sky-400', gradientFrom: 'from-sky-500', gradientHoverFrom: 'hover:from-sky-400', text: 'text-sky-400', shadow: 'shadow-sky-500/20', ring: 'ring-sky-400/40', hoverBorder: 'hover:border-sky-500/50', gradientEnd: 'to-sky-950/30', previewSubtle: 'bg-sky-500/20', previewSoft: 'bg-sky-500/10' }
};

export const getJobCardAccentColor = (value: unknown): JobCardAccentColor =>
  value === 'indigo' || value === 'violet' || value === 'rose' || value === 'amber' || value === 'sky' || value === 'emerald'
    ? value
    : 'emerald';

export interface LandingPageConfig {
  hero: LandingHeroConfig;
  sections: LandingSectionOrder[];
  customCards: CustomLandingCard[];
  categoryPostingFees: CategoryPostingFee[];
  exemptUserIds: string[]; // Users/Employers exempt from posting fees
  exemptUserEmails: string[];
  isFreeAllPostings?: boolean;
  globalDiscount?: number;
  jobCardDesign: JobCardDesignConfig;
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
    statBadge4Text: 'Direct WhatsApp & SMS Alerts',
    design4HeroImageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=2000&q=85',
    design5SeekerImageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1400&q=85',
    design5EmployerImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1400&q=85',
    design45HeroOverlay: 68,
    design45AccentColor: '#0f9f78'
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
  exemptUserEmails: [],
  jobCardDesign: {
    layout: 'default',
    theme: {
      accentColor: 'emerald',
      borderRadius: 'xl',
      cardBgPreset: 'slate',
      density: 'normal'
    },
    visibility: {
      title: true,
      company: true,
      location: true,
      postedDate: true,
      description: true,
      tags: true,
      salary: true,
      jobType: true,
      govtBadge: true,
      featuredBadge: true,
      urgentBadge: true,
      newspaperBadge: true,
      pdfBadge: true,
      futureBadge: true,
      vipBadge: true,
      pinnedBadge: true,
      poster: true,
      relativePostedTime: true,
      exactPostedDate: true,
      deadlineDate: true,
      deadlineRemaining: true,
      duplicateOverrideBadge: true,
      saveButton: true,
      detailsButton: true,
      applyButton: true
    },
    labels: {
      saveButton: 'Save',
      detailsButton: 'Details',
      applyButton: 'Apply',
      cardHeading: ''
    },
    limits: {
      descriptionMaxWords: 25,
      maxTags: 4
    }
  }
};

export type LandingDesignId = 'legacy' | 'design-1' | 'design-2' | 'design-3' | 'design-4' | 'design-5';

export interface LandingDesignEntry {
  id: LandingDesignId;
  name: string;
  config: LandingPageConfig;
}

export interface LandingDesignSystem {
  version: 1;
  activeDesignId: LandingDesignId;
  designs: LandingDesignEntry[];
}

/**
 * Builds a backward-compatible design registry without changing the live page.
 * New design slots begin as independent copies; administrators can customize
 * each one before selecting it as the published design.
 */
export function createDefaultLandingDesignSystem(
  legacyConfig: LandingPageConfig = DEFAULT_LANDING_PAGE_CONFIG
): LandingDesignSystem {
  const cloneConfig = (config: LandingPageConfig): LandingPageConfig =>
    JSON.parse(JSON.stringify(config)) as LandingPageConfig;

  const cleanProfessional = cloneConfig(legacyConfig);
  cleanProfessional.jobCardDesign = {
    ...cleanProfessional.jobCardDesign,
    layout: 'compact',
    // Design 1 follows the portal's established emerald/teal brand by default.
    // Admins can still customize this design's accent independently afterward.
    theme: { ...cleanProfessional.jobCardDesign.theme, accentColor: 'emerald', cardBgPreset: 'glass', density: 'compact' }
  };

  const adsIntegrated = cloneConfig(legacyConfig);
  // This is a genuine free portal feature card, not paid sponsor inventory.
  if (!adsIntegrated.customCards.some((card) => card.id === 'card-ats-cv-builder')) {
    adsIntegrated.customCards.push({
      id: 'card-ats-cv-builder',
      title: 'Build Your ATS-Ready CV',
      description: 'Create and improve your professional resume with the portal\'s free ATS CV Builder.',
      badge: 'Free Portal Tool',
      buttonText: 'Build CV Free',
      buttonUrl: '#cv',
      bgGradient: 'from-indigo-700 via-blue-700 to-slate-900',
      isEnabled: true,
      order: 3
    });
  }
  // The existing globally-rendered top banner and feed campaign placements remain
  // connected to the approved/paid campaign pipeline; this preset only adjusts
  // the page section order and does not create synthetic ad inventory.
  adsIntegrated.sections = adsIntegrated.sections
    .map((section) => ({ ...section, order: section.id === 'custom-announcements' ? 3 : section.id === 'quick-stats' ? 4 : section.order }))
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index + 1 }));
  adsIntegrated.jobCardDesign = {
    ...adsIntegrated.jobCardDesign,
    theme: { ...adsIntegrated.jobCardDesign.theme, accentColor: 'amber', cardBgPreset: 'gradient', density: 'normal' }
  };

  const modernAlternative = cloneConfig(legacyConfig);
  modernAlternative.jobCardDesign = {
    ...modernAlternative.jobCardDesign,
    layout: 'default',
    theme: { ...modernAlternative.jobCardDesign.theme, accentColor: 'emerald', cardBgPreset: 'gradient', borderRadius: '3xl', density: 'spacious' }
  };

  return {
    version: 1,
    activeDesignId: 'legacy',
    designs: [
      { id: 'legacy', name: 'Existing Landing Page', config: cloneConfig(legacyConfig) },
      { id: 'design-1', name: 'Design 1 — Clean Professional', config: cleanProfessional },
      { id: 'design-2', name: 'Design 2 — Ads Integrated', config: adsIntegrated },
      { id: 'design-3', name: 'Design 3 — Modern Alternative', config: modernAlternative }
    ]
  };
}

export function normalizeLandingDesignSystem(
  value: unknown,
  legacyConfig: LandingPageConfig = DEFAULT_LANDING_PAGE_CONFIG
): LandingDesignSystem {
  const defaults = createDefaultLandingDesignSystem(legacyConfig);
  if (!value || typeof value !== 'object') return defaults;

  const candidate = value as Partial<LandingDesignSystem>;
  const allowedIds: LandingDesignId[] = ['legacy', 'design-1', 'design-2', 'design-3', 'design-4', 'design-5'];
  const supplied = Array.isArray(candidate.designs) ? candidate.designs : [];
  const designs = defaults.designs.map((fallback) => {
    const found = supplied.find((item) => item && item.id === fallback.id);
    const config = found?.config;
    if (!config || typeof config !== 'object' || !config.hero || !Array.isArray(config.sections) || !Array.isArray(config.customCards)) {
      return fallback;
    }
    const safeUrl = (value: unknown, fallbackUrl: string): string => {
      if (typeof value !== 'string') return fallbackUrl;
      const candidate = value.trim().slice(0, 2048);
      if (/^(#|\/)(?!\/)/.test(candidate)) return candidate;
      if (/^https:\/\//i.test(candidate)) return candidate;
      if (/^mailto:[^\s@]+@[^\s@]+$/i.test(candidate)) return candidate;
      return fallbackUrl;
    };
    const hero = { ...fallback.config.hero, ...config.hero };
    Object.keys(hero).forEach((key) => {
      const typedKey = key as keyof LandingHeroConfig;
      const rawValue = hero[typedKey];
      if (typedKey.endsWith('Url')) {
        hero[typedKey] = safeUrl(rawValue, fallback.config.hero[typedKey] as string) as never;
      } else if (typedKey === 'design45HeroOverlay') {
        hero[typedKey] = (Number.isFinite(Number(rawValue)) ? Math.max(35, Math.min(90, Number(rawValue))) : 68) as never;
      } else if (typeof rawValue !== 'string') {
        hero[typedKey] = fallback.config.hero[typedKey] as never;
      } else {
        hero[typedKey] = rawValue.slice(0, 500) as never;
      }
    });

    const allowedSectionIds: LandingSectionId[] = ['hero', 'promo-banners', 'top-sponsor-ads', 'quick-stats', 'custom-announcements', 'jobs-feed'];
    const seenSectionIds = new Set<string>();
    const sections = config.sections
      .filter((section: any) => section && allowedSectionIds.includes(section.id) && !seenSectionIds.has(section.id) && (seenSectionIds.add(section.id), true))
      .map((section: LandingSectionOrder, index: number) => ({
        ...section,
        name: typeof section.name === 'string' ? section.name.slice(0, 100) : fallback.config.sections[index]?.name || section.id,
        description: typeof section.description === 'string' ? section.description.slice(0, 240) : '',
        isEnabled: section.isEnabled !== false,
        order: Number.isFinite(Number(section.order)) ? Math.max(1, Math.min(100, Math.floor(Number(section.order)))) : index + 1
      }));
    const seenCardIds = new Set<string>();
    const customCards = config.customCards
      .filter((card: any) => card && typeof card.id === 'string' && card.id.trim() && !seenCardIds.has(card.id) && (seenCardIds.add(card.id), true))
      .slice(0, 30)
      .map((card: CustomLandingCard, index: number) => ({
        ...card,
        id: card.id.slice(0, 80),
        title: typeof card.title === 'string' ? card.title.slice(0, 160) : '',
        description: typeof card.description === 'string' ? card.description.slice(0, 600) : '',
        badge: typeof card.badge === 'string' ? card.badge.slice(0, 60) : '',
        buttonText: typeof card.buttonText === 'string' ? card.buttonText.slice(0, 80) : '',
        buttonUrl: safeUrl(card.buttonUrl, '#jobs'),
        imageUrl: typeof card.imageUrl === 'string' && (card.imageUrl.startsWith('https://') || (card.imageUrl.startsWith('/') && !card.imageUrl.startsWith('//'))) ? card.imageUrl.slice(0, 1000) : undefined,
        bgGradient: typeof card.bgGradient === 'string' ? card.bgGradient.slice(0, 160) : 'from-slate-800 to-slate-950',
        isEnabled: card.isEnabled !== false,
        order: Number.isFinite(Number(card.order)) ? Math.max(1, Math.min(100, Math.floor(Number(card.order)))) : index + 1
      }));

    return {
      ...fallback,
      name: typeof found?.name === 'string' && found.name.trim() ? found.name.trim().slice(0, 80) : fallback.name,
      config: {
        ...fallback.config,
        ...config,
        hero,
        sections: sections.length ? sections : fallback.config.sections,
        customCards,
        jobCardDesign: {
          ...fallback.config.jobCardDesign,
          ...(config.jobCardDesign || {}),
          theme: { ...fallback.config.jobCardDesign.theme, ...(config.jobCardDesign?.theme || {}) },
          visibility: { ...fallback.config.jobCardDesign.visibility, ...(config.jobCardDesign?.visibility || {}) },
          labels: { ...fallback.config.jobCardDesign.labels, ...(config.jobCardDesign?.labels || {}) },
          limits: { ...fallback.config.jobCardDesign.limits, ...(config.jobCardDesign?.limits || {}) }
        }
      }
    };
  });
  const activeDesignId = allowedIds.includes(candidate.activeDesignId as LandingDesignId)
    ? candidate.activeDesignId as LandingDesignId
    : 'legacy';
  return { version: 1, activeDesignId, designs };
}

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
