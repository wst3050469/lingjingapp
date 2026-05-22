const { execSync } = require('child_process');
const result = execSync('D: && cd D:\\lingjing\\lingjing && tar -tzf dist1500.tar.gz', { encoding: 'utf8', shell: 'cmd.exe' });
const lines = result.trim().split('\n');
console.log('Total files:', lines.length);
const distLines = lines.filter(l => l.startsWith('dist/'));
console.log('dist/ entries:', distLines.length);
const sqliteLines = lines.filter(l => l.includes('sqlite'));
console.log('sqlite files:', sqliteLines.length);
if (sqliteLines.length > 0) console.log('First sqlite:', sqliteLines[0]);
if (distLines.length > 0) {
  console.log('First 10 dist entries:');
  distLines.slice(0, 10).forEach(l => console.log('  ' + l));
}
