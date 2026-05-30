const { Client } = require('ssh2');
const c = new Client();

c.on('ready', () => {
  function exec(cmd) {
    return new Promise((res) => {
      c.exec(cmd, (err, s) => {
        let o = '';
        s.on('data', d => { process.stdout.write(d.toString()); o += d; });
        s.stderr.on('data', d => { process.stderr.write(d.toString()); });
        s.on('close', () => res(o));
      });
    });
  }

  (async () => {
    // Update version
    console.log('=== Update version ===');
    await exec('sed -i s/1.49.0/1.50.0/g /root/lingjing-git/packages/electron/package.json');
    
    // Extract dist
    console.log('=== Extract dist ===');
    await exec('cd /root/lingjing-git/packages/core && tar -xzf /tmp/dist-fixed.tar.gz');
    await exec('ls /root/lingjing-git/packages/core/dist/index.js && echo DIST_OK');
    
    // Copy to electron
    console.log('=== Copy dist ===');
    await exec('rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist');
    // Use find + cp approach
    await exec('mkdir -p /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist');
    await exec('cd /root/lingjing-git/packages/core/dist && tar cf - . | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist');
    await exec('ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js && echo DIST_COPIED');
    
    // Build main
    console.log('=== Build main.js ===');
    await exec('cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -5');
    
    // Build Linux
    console.log('=== Build Linux (this takes 5-10 min) ===');
    const output = await exec('cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1 | tail -10');
    
    // Check artifacts
    console.log('=== Check artifacts ===');
    await exec('ls -la /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null || echo NO_FILES');
    
    c.end();
  })();
});

c.on('error', e => { console.log('SSH ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
