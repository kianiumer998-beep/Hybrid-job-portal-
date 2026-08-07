import { Job } from '../types/job';

export const INITIAL_JOBS: Job[] = [
  {
    id: 'job-1',
    title: 'Senior React & Node.js Engineer',
    company: 'Vercel Remote Tech',
    jobType: 'Remote',
    region: 'Global',
    salary: '$110,000 - $140,000 / year',
    salaryNumericMin: 110000,
    currency: 'USD',
    experienceLevel: 'Senior',
    department: 'Software Engineering',
    tags: ['React', 'TypeScript', 'Node.js', 'Next.js', 'GraphQL'],
    description: 'We are seeking a high-performing Senior React Engineer to help scale our distributed global web platform. You will build high-throughput UI components and optimize serverless edge functions.',
    requirements: [
      '5+ years of full-stack engineering with React and TypeScript',
      'Proven expertise in Next.js, SSR, and server actions',
      'Demonstrated experience with scalable GraphQL / REST APIs',
      'Strong async collaboration skills across global timezones'
    ],
    benefits: [
      '100% Remote flexibility anywhere in the world',
      'Annual home office stipend ($2,500)',
      'Unlimited Paid Time Off (PTO)',
      'Equity option plan'
    ],
    postedAt: '2 hours ago',
    featured: true,
    urgent: true,
    applicationsCount: 42
  },
  {
    id: 'job-2',
    title: 'Full Stack Lead Developer (Hybrid)',
    company: 'Systems Limited',
    jobType: 'Hybrid',
    region: 'Pakistan',
    province: 'Punjab',
    city: 'Lahore',
    district: 'Gulberg',
    salary: 'PKR 350,000 - PKR 480,000 / month',
    salaryNumericMin: 350000,
    currency: 'PKR',
    experienceLevel: 'Lead',
    department: 'Enterprise Systems',
    tags: ['React', '.NET Core', 'SQL Server', 'Azure', 'Microservices'],
    description: 'Systems Limited is hiring a Lead Developer for our Gulberg office. You will lead an agile squad of 8 developers delivering fintech solutions for international clients.',
    requirements: [
      '6+ years experience in C# .NET Core & Modern Frontend Frameworks',
      'Strong architecture skills in Microservices and Event-Driven architecture',
      'Experience leading code reviews and mentoring junior engineers',
      'Hybrid availability (3 days in Gulberg, Lahore office)'
    ],
    benefits: [
      'Fuel & Conveyance Allowance',
      'Health Insurance for family with OPD coverage',
      'Performance bi-annual bonuses',
      'Certification sponsorship'
    ],
    postedAt: '5 hours ago',
    featured: true,
    urgent: false,
    applicationsCount: 88
  },
  {
    id: 'job-3',
    title: 'Senior Mobile Application Engineer (Flutter/React Native)',
    company: 'NetSol Technologies',
    jobType: 'On-site',
    region: 'Pakistan',
    province: 'Punjab',
    city: 'Lahore',
    district: 'Model Town',
    salary: 'PKR 280,000 - PKR 380,000 / month',
    salaryNumericMin: 280000,
    currency: 'PKR',
    experienceLevel: 'Senior',
    department: 'Mobile Innovation Lab',
    tags: ['Flutter', 'React Native', 'iOS', 'Android', 'Firebase'],
    description: 'Join NetSol Technologies in Model Town, Lahore as a Senior Mobile Apps Developer building next-gen leasing & asset financing native hybrid apps.',
    requirements: [
      '4+ years building cross-platform apps with Flutter or React Native',
      'Solid experience with state management (Bloc, Provider, Redux)',
      'Published at least 3 apps on Google Play Store & Apple App Store',
      'Experience with push notifications and local encryption'
    ],
    benefits: [
      'In-house cafeteria and gym facilities',
      'Gratuity & Provident Fund',
      'Flexible working hours'
    ],
    postedAt: '1 day ago',
    featured: false,
    urgent: true,
    applicationsCount: 31
  },
  {
    id: 'job-4',
    title: 'DevOps & Cloud Security Specialist',
    company: 'Contour Software',
    jobType: 'Hybrid',
    region: 'Pakistan',
    province: 'Punjab',
    city: 'Rawalpindi',
    district: 'Saddar',
    salary: 'PKR 250,000 - PKR 350,000 / month',
    salaryNumericMin: 250000,
    currency: 'PKR',
    experienceLevel: 'Senior',
    department: 'Cloud Infrastructure',
    tags: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
    description: 'Contour Software Saddar Rawalpindi branch is looking for a skilled DevOps Specialist to manage multi-region AWS cloud pipelines and automated deployment gates.',
    requirements: [
      '3+ years managing Kubernetes clusters and Terraform infrastructure',
      'Deep knowledge of Docker, GitHub Actions, and Linux administration',
      'AWS Solutions Architect certification is a strong plus',
      'Hybrid schedule (2 days office in Saddar Rawalpindi)'
    ],
    benefits: [
      'EOBI and Gratuity',
      'Annual overseas trip incentive for top performers',
      'Learning budget'
    ],
    postedAt: '3 days ago',
    featured: false,
    urgent: false,
    applicationsCount: 19
  },
  {
    id: 'job-5',
    title: 'UI/UX Product Designer',
    company: 'Techlogix Global',
    jobType: 'Remote',
    region: 'Pakistan',
    province: 'Sindh',
    city: 'Karachi',
    district: 'Clifton',
    salary: 'PKR 220,000 - PKR 300,000 / month',
    salaryNumericMin: 220000,
    currency: 'PKR',
    experienceLevel: 'Mid',
    department: 'Product Design',
    tags: ['Figma', 'UI Design', 'User Research', 'Design Systems', 'Prototyping'],
    description: 'Design intuitive interfaces for B2B enterprise applications. Work fully remote from Karachi (Clifton team hub optional) or anywhere in Pakistan.',
    requirements: [
      '3+ years experience designing mobile & web user interfaces',
      'Strong portfolio demonstrating end-to-end design process',
      'Mastery of Figma design systems, component variants, and interactive prototypes',
      'Good English communication skills'
    ],
    benefits: [
      '100% Remote flexibility',
      'Internet & laptop allowance',
      'Flexible time off'
    ],
    postedAt: 'Just now',
    featured: true,
    urgent: false,
    applicationsCount: 54
  },
  {
    id: 'job-6',
    title: 'AI & Data Science Specialist',
    company: 'Jazz (PMCL)',
    jobType: 'On-site',
    region: 'Pakistan',
    province: 'Islamabad Capital Territory',
    city: 'Islamabad',
    district: 'Blue Area (Zone 1)',
    salary: 'PKR 320,000 - PKR 450,000 / month',
    salaryNumericMin: 320000,
    currency: 'PKR',
    experienceLevel: 'Senior',
    department: 'Data & AI Lab',
    tags: ['Python', 'PyTorch', 'Machine Learning', 'SQL', 'LLMs'],
    description: 'Jazz Digital HQ in Blue Area Islamabad is building generative AI models for customer support, predictive churn, and personalized telecommunication packages.',
    requirements: [
      'Master or Bachelor degree in CS, Data Science, or AI',
      '3+ years deploying ML models in production environment',
      'Experience with LLM fine-tuning, RAG architectures, and vector databases',
      'On-site presence at Jazz Digital HQ in Blue Area Islamabad'
    ],
    benefits: [
      'Subsidized telecom package and phone hardware',
      'Company vehicle / allowance for senior grades',
      'Executive health checkups'
    ],
    postedAt: '4 hours ago',
    featured: true,
    urgent: true,
    applicationsCount: 76
  },
  {
    id: 'job-7',
    title: 'Senior Python & Django Backend Engineer',
    company: 'Turing US Remote',
    jobType: 'Remote',
    region: 'US',
    salary: '$85,000 - $115,000 / year',
    salaryNumericMin: 85000,
    currency: 'USD',
    experienceLevel: 'Senior',
    department: 'Software Engineering',
    tags: ['Python', 'Django', 'PostgreSQL', 'Redis', 'Docker'],
    description: 'Work remotely with Silicon Valley scale-ups on high-concurrency microservices and data streaming APIs.',
    requirements: [
      '5+ years with Python (Django / FastAPI)',
      'Solid expertise in PostgreSQL indexing, Redis caching, and Celery background workers',
      'Experience in automated test suites (PyTest)',
      'Overlapping US Eastern hours availability'
    ],
    benefits: [
      'USD salary paid directly to local bank account',
      'Flexible vacation policy',
      'Remote coworking space budget'
    ],
    postedAt: '1 day ago',
    featured: false,
    urgent: false,
    applicationsCount: 93
  },
  {
    id: 'job-8',
    title: 'Front-End Engineer (Vue.js / Tailwind)',
    company: 'Fintech London Ltd',
    jobType: 'Remote',
    region: 'UK',
    salary: '£55,000 - £70,000 / year',
    salaryNumericMin: 70000,
    currency: 'GBP',
    experienceLevel: 'Mid',
    department: 'Frontend Engineering',
    tags: ['Vue 3', 'TypeScript', 'Tailwind CSS', 'Pinia', 'Vite'],
    description: 'Join a fast-growing UK fintech company modernizing open banking payment dashboards for merchant platforms.',
    requirements: [
      '3+ years experience with Vue 3 Composition API & TypeScript',
      'Expertise in pixel-perfect Tailwind CSS layouts and responsive design',
      'Familiarity with WCAG accessibility guidelines',
      'UK timezone align (+/- 2 hours)'
    ],
    benefits: [
      'GBP salary benchmark',
      'Equipment bundle (M3 Macbook Pro)',
      'Learning stipend £1,000/yr'
    ],
    postedAt: '2 days ago',
    featured: false,
    urgent: false,
    applicationsCount: 28
  }
];
