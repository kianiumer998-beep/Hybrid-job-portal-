const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminQuickEditJobModal.tsx', 'utf8');

content = content.replace(/join\('\n'\)/g, "join('\\n')");
content = content.replace(/split\('\n'\)/g, "split('\\n')");

fs.writeFileSync('src/components/admin/AdminQuickEditJobModal.tsx', content);
console.log("Fixed newlines");
