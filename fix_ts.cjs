const fs = require('fs');

let adminDashboard = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');
adminDashboard = adminDashboard.replace(/pJob\.source === 'scraper'/g, "(pJob as any).source === 'scraper'");
adminDashboard = adminDashboard.replace(/pJob\.source/g, "(pJob as any).source");
fs.writeFileSync('src/components/AdminDashboard.tsx', adminDashboard);

let modal = fs.readFileSync('src/components/admin/AdminQuickEditJobModal.tsx', 'utf8');
modal = modal.replace(/experienceLevel: e\.target\.value/g, "experienceLevel: e.target.value as any");
fs.writeFileSync('src/components/admin/AdminQuickEditJobModal.tsx', modal);

console.log("Fixed TS issues");
