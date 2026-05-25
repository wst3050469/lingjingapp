const fs = require('fs');
const content = fs.readFileSync('packages/electron/src/ipc/cloud-ipc.ts','utf8');
const crCount = (content.match(/\r\n/g) || []).length;
const lfCount = (content.match(/\n/g) || []).length;
console.log('CRLF:', crCount, 'LF:', lfCount, 'Lines:', lfCount);
// Show raw bytes for line 67
const lines = content.split('\n');
console.log('Line 67 hex:', Buffer.from(lines[66]).toString('hex'));
