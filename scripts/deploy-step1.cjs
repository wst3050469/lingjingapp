const { readFileSync, statSync, existsSync } = require('fs');
const { join, resolve } = require('path');
const { execSync } = require('child_process');
const ROOT = resolve(__dirname, '..');

// Upload dist tar
execSync('powershell -NoProfile -Command "cd \\"'+join(ROOT,'packages/core')+'\\"; tar -czf \\"'+join(ROOT,'dist-fixed.tar.gz')+'\\" dist"', { shell:'cmd.exe', stdio:'pipe' });
console.log('Tar size:', (statSync(join(ROOT,'dist-fixed.tar.gz')).size/1024/1024).toFixed(0), 'MB');

// Upload to server
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    const s = sftp.createWriteStream('/tmp/dist-fixed.tar.gz');
    s.on('close', () => { console.log('Upload done'); conn.end(); });
    s.end(readFileSync(join(ROOT,'dist-fixed.tar.gz')));
  });
});
conn.on('error', e => { console.log('SSH ERR:', e.message); process.exit(1); });
conn.connect({ host:'120.55.5.220', port:22, username:'root', password:'WsT13575967132' });
