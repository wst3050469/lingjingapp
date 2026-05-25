const fs = require('fs');
const content = fs.readFileSync('packages/electron/src/ipc/cloud-ipc.ts', 'utf8');
const idx = content.indexOf('// Auto-register for JWT');
if (idx >= 0) {
  const snippet = content.slice(idx, idx + 1200);
  console.log(JSON.stringify(snippet));
} else {
  console.log('Pattern not found at all');
  // Search for partial
  const idx2 = content.indexOf('Auto-register');
  if (idx2 >= 0) {
    console.log('Found at', idx2);
    console.log(JSON.stringify(content.slice(idx2 - 20, idx2 + 400)));
  }
}
