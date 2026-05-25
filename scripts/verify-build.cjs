const fs = require('fs');
const m = fs.readFileSync('packages/electron/dist/main.js', 'utf8');

const firstOnIdx = m.indexOf('cloudClient.on');
const firstWsIdx = m.indexOf('connectWebSocket');

console.log('First cloudClient.on at index:', firstOnIdx);
console.log('First connectWebSocket at index:', firstWsIdx);

if (firstOnIdx >= 0 && firstWsIdx >= 0) {
  if (firstOnIdx < firstWsIdx) {
    console.log('✅ FIX VERIFIED: event listeners registered BEFORE connectWebSocket()');
  } else {
    console.log('❌ FIX NOT APPLIED: connectWebSocket() called BEFORE event listeners');
  }
}

// Count occurrences
const onCount = (m.match(/cloudClient\.on/g) || []).length;
const wsCount = (m.match(/connectWebSocket/g) || []).length;
console.log('cloudClient.on occurrences:', onCount);
console.log('connectWebSocket occurrences:', wsCount);
