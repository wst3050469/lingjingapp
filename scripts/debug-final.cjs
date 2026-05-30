const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const script = `
set -x
cd /root/lingjing-git/packages/core
stat dist
ls dist/index.js
tar cf - dist 2>&1 | wc -c
echo "TAR_TEST_DONE"
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
