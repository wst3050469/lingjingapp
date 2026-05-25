const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'packages', 'electron', 'src', 'ipc', 'cloud-ipc.ts');
const content = fs.readFileSync(filePath, 'utf8');
const idx = content.indexOf('// Auto-register for JWT');
const snippet = content.slice(idx, idx + 1950);
// Show as escaped string for comparison
console.log("ACTUAL:" + JSON.stringify(snippet));
