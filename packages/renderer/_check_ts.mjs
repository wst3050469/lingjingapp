import { execSync } from 'child_process';
try {
  execSync('npx tsc --noEmit --skipLibCheck', {cwd: 'D:/lingjing/lingjing/packages/renderer', encoding:'utf8', timeout:60000, stdio:'pipe'});
  console.log('Renderer TS: OK (0 errors)');
} catch(e) {
  const out = e.stdout || '';
  const stderr = e.stderr || '';
  const errors = (out + stderr).split('\n').filter(l => l.includes('error TS'));
  console.log('TS errors: ' + errors.length);
  errors.forEach(l => console.log('  ' + l.trim()));
}
