import { execSync } from 'child_process';
try {
  const out = execSync('npx vite build 2>&1', {cwd: 'D:/lingjing/lingjing/packages/renderer', encoding:'utf8', timeout:60000, stdio:'pipe'});
  const relevant = out.split('\n').filter(l => l.includes('✓') || l.includes('error') || l.includes('built') || l.includes('transforming'));
  console.log('Vite build:');
  relevant.forEach(l => console.log('  ' + l.trim()));
} catch(e) {
  console.log('Vite build FAILED:');
  console.log((e.stdout || '') + (e.stderr || ''));
}
