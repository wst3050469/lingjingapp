const { readFileSync, statSync } = require('fs');
const { execSync } = require('child_process');
const { join, resolve } = require('path');
const ROOT = resolve(__dirname, '..');

// Tar dist
execSync('powershell -NoProfile -Command "cd \\"' + join(ROOT, 'packages/core') + '\\"; tar -czf \\"' + join(ROOT, 'dist-fixed.tar.gz') + '\\" dist"', { shell: 'cmd.exe', stdio: 'pipe' });
console.log('Tar size MB:', (statSync(join(ROOT, 'dist-fixed.tar.gz')).size / 1024 / 1024).toFixed(0));

// Upload via SSH
const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.log('SFTP ERR:', err.message); process.exit(1); }
    const s = sftp.createWriteStream('/tmp/dist-fixed.tar.gz');
    s.on('close', () => { console.log('UPLOADED'); c.end(); });
    s.end(readFileSync(join(ROOT, 'dist-fixed.tar.gz')));
  });
});
c.on('error', e => { console.log('SSH ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
