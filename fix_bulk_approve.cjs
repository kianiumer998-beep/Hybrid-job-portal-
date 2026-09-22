const fs = require('fs');
const content = fs.readFileSync('server/routes/jobRoutes.ts', 'utf8');

const regex = /(let idsToApprove = ids;\s+let duplicateWarnings: any\[\] = \[\];\s+)(if \(!force\) {\s+const liveJobs = \(await JobRepository.getAll\(\{ limit: 10000 \}\)\).jobs;\s+const allPending = await JobRepository.getPending\(\);\s+const validIds: string\[\] = \[\];\s+for \(const id of ids\) \{\s+const pendingJob = allPending.find\(j => j.id === id\);\s+if \(pendingJob\) \{)([\s\S]*?)(const otherPending = allPending.filter\(j => j.id !== id\);)/;

const match = content.match(regex);
if (match) {
    const missingValidation = match[3];
    
    // We need to move the missing fields validation out of the if (!force) block.
    // Actually, we can just run a loop over all IDs to do missing fields validation before `if (!force)`
    
    let replacement = `let idsToApprove = ids;
    let duplicateWarnings: any[] = [];
    
    const allPending = await JobRepository.getPending();

    // 1. Missing fields validation (MUST run regardless of force)
    for (const id of ids) {
      const pendingJob = allPending.find(j => j.id === id);
      if (pendingJob) {
        if (pendingJob.source === 'scraper' || pendingJob.scraperId) {
          const missing: string[] = [];
          if (!pendingJob.company) missing.push('Company');
          const hasLoc = pendingJob.location || pendingJob.country || pendingJob.region || pendingJob.province || pendingJob.city || pendingJob.district;
          if (!hasLoc) missing.push('Location');
          if (!pendingJob.salary) missing.push('Salary');
          if (!pendingJob.currency) missing.push('Currency');
          if (!pendingJob.experienceLevel) missing.push('Experience');
          if (!pendingJob.department) missing.push('Department');
          if (!pendingJob.description) missing.push('Description');
          if (!pendingJob.jobType) missing.push('Job Type');
          if (!pendingJob.sourceUrl && !pendingJob.applicationUrl && !pendingJob.applyUrl) missing.push('Source URL');
          if (!pendingJob.postedAt) missing.push('Posted Date');
          
          if (missing.length > 0) {
            return res.status(422).json({
              success: false,
              missingFields: missing,
              message: 'Job requires manual completion before publishing.'
            });
          }
        }
      }
    }

    if (!force) {
      const liveJobs = (await JobRepository.getAll({ limit: 10000 })).jobs;
      const validIds: string[] = [];

      for (const id of ids) {
        const pendingJob = allPending.find(j => j.id === id);
        if (pendingJob) {
          const otherPending = allPending.filter(j => j.id !== id);`;
          
    const newContent = content.replace(regex, replacement);
    fs.writeFileSync('server/routes/jobRoutes.ts', newContent);
    console.log("Success");
} else {
    console.log("Not matched");
}
