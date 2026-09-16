const fs = require('fs');
let content = fs.readFileSync('src/services/scraperService.ts', 'utf8');

// Fix JSON-LD inference
content = content.replace(
    /const isRemote = \(\s*item\.jobLocationType === 'TELECOMMUTE' \|\|\s*item\.applicantLocationRequirements !== undefined \|\|\s*title\.toLowerCase\(\)\.includes\('remote'\) \|\|\s*description\.toLowerCase\(\)\.includes\('remote'\)\s*\);/,
    "const isRemote = (item.jobLocationType === 'TELECOMMUTE' || item.applicantLocationRequirements !== undefined);"
);

// Fix NEXT_DATA inference
content = content.replace(
    /const isRemote = item\.isRemote \|\| \(item\.title \|\| ''\)\.toLowerCase\(\)\.includes\('remote'\) \|\| loc\.toLowerCase\(\)\.includes\('remote'\);/,
    "const isRemote = item.isRemote;"
);

// Just in case the format is slightly different, let's also do a general regex for the JSON-LD
content = content.replace(
    /item\.jobLocationType === 'TELECOMMUTE' \|\n?\|?\s*item\.applicantLocationRequirements !== undefined \|\n?\|?\s*title\.toLowerCase\(\)\.includes\('remote'\) \|\n?\|?\s*description\.toLowerCase\(\)\.includes\('remote'\)/,
    "item.jobLocationType === 'TELECOMMUTE' || item.applicantLocationRequirements !== undefined"
);

fs.writeFileSync('src/services/scraperService.ts', content);
console.log("Replaced next/json-ld inferences");
