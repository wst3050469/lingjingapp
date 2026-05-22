const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  console.log('Building Linux (5-10 min)...');
  c.exec('cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1', (e, s) => {
    if (e) { console.log('EXEC ERR:', e.message); c.end(); return; }
    let o = '';
    s.on('data', d => { process.stdout.write(d.toString()); o += d; });
    s.stderr.on('data', d => process.stderr.write(d.toString()));
    s.on('close', () => {
      const lastLines = o.split('\n').filter(l => l.trim()).slice(-10);
      console.log('\n=== LAST 10 LINES ===');
      lastLines.forEach(l => console.log(l));
      c.end();
    });
  });
});
c.on('error', e => { console.log('SSH ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
