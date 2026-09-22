const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminQuickEditJobModal.tsx', 'utf8');

const regex = /return \{\s*id: 'job-' \+ Date\.now\(\),\s*title: '',\s*company: '',\s*jobType: 'On-site',\s*region: 'Pakistan',\s*province: 'Punjab',\s*city: 'Lahore',\s*salary: 'PKR 80,000 - 120,000 \/ month',\s*currency: 'PKR',\s*experienceLevel: 'Mid',\s*department: 'General Operations',\s*tags: \['Urgent', 'Full-time'\],\s*description: '',\s*requirements: \['Relevant Bachelor degree', '2\+ years experience'\],\s*benefits: \['Medical coverage', 'Paid leaves'\],\s*postedAt: new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\],/;

const replacement = `return {
      id: 'job-' + Date.now(),
      title: '',
      company: '',
      jobType: undefined as any,
      region: undefined as any,
      province: undefined,
      city: undefined,
      salary: '',
      currency: undefined as any,
      experienceLevel: undefined as any,
      department: '',
      tags: [],
      description: '',
      requirements: [],
      benefits: [],
      postedAt: '',`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/admin/AdminQuickEditJobModal.tsx', content);
console.log("Replaced modal defaults");
