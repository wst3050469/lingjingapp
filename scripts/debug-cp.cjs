const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec(`
    set -x
    mkdir -p /root/lingjing-git/packages/core/dist
    cd /root/lingjing-git
    git checkout HEAD -- packages/core/dist/index.js packages/core/dist/fusion/index.js 2>&1
    ls -la packages/core/dist/
    cp -r packages/core/dist /tmp/testdist 2>&1
    echo "CP_RESULT: $?"
    ls /tmp/testdist 2>&1 | head -5
  `, (e, s) => {
    let o = '', err = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => err += d);
    s.on('close', () => { console.log('STDOUT:', o); console.log('STDERR:', err); c.end(); });
  });
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
