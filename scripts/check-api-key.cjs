const s = require('fs').readFileSync('packages/core/src/cloud/sync-client.ts', 'utf8');
const d = require('fs').readFileSync('packages/core/dist/cloud/sync-client.js', 'utf8');
const lines = s.split('\n').filter(l => l.includes('DEFAULT'));
console.log('Source DEFAULT lines:', JSON.stringify(lines));
const dlines = d.split('\n').filter(l => l.includes('DEFAULT'));
console.log('Dist DEFAULT lines:', JSON.stringify(dlines));
