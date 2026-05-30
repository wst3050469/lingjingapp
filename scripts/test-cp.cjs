const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const script = `
set -x
ls -la /root/lingjing-git/packages/core/dist/index.js
ls -d /root/lingjing-git/packages/core/dist
\cp -rv /root/lingjing-git/packages/core/dist/index.js /tmp/
echo "CP1_RESULT: $?"
ls -la /tmp/index.js
rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist
mkdir -p /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist
\cp -rv /root/lingjing-git/packages/core/dist/index.js /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/
echo "CP2_RESULT: $?"
`.trim();
  c.exec('bash -s', (e, s) => {
    s.stdin.write(script);
    s.stdin.end();
    let stdout = '', stderr = '';
    s.on('data', d => stdout += d);
    s.stderr.on('data', d => stderr += d);
    s.on('close', () => { console.log('STDOUT:', stdout); console.log('STDERR:', stderr); c.end(); });
  });
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
