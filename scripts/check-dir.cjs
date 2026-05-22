const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  function exec(cmd) {
    return new Promise((res) => {
      c.exec(cmd, (err, s) => {
        let o = '';
        s.on('data', d => o += d);
        s.stderr.on('data', d => process.stderr.write(d));
        s.on('close', () => res(o));
      });
    });
  }

  (async () => {
    // Check if packages/core has any special files
    let r = await exec('ls -la /root/lingjing-git/packages/core/ | head -20');
    console.log('Core dir:\n' + r);
    
    r = await exec('file /root/lingjing-git/packages/core/dist 2>/dev/null || echo "dist does not exist"');
    console.log('Dist file type:\n' + r);
    
    r = await exec('stat /root/lingjing-git/packages/core 2>&1');
    console.log('Core stat:\n' + r);
    
    c.end();
  })();
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
