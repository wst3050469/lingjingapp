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
    console.log('=== Step 1: Clean and extract ===');
    let r = await exec('rm -rf /root/lingjing-git/packages/core/dist && cd /root/lingjing-git/packages/core && tar -xzf /tmp/dist-fixed.tar.gz && ls dist/index.js');
    console.log('Result:', r);

    console.log('=== Step 2: Update version ===');
    r = await exec('sed -i s/1.49.0/1.50.0/g /root/lingjing-git/packages/electron/package.json');
    r = await exec('grep version /root/lingjing-git/packages/electron/package.json');
    console.log('Version:', r);

    console.log('=== Step 3: Copy dist (cp -r) ===');
    r = await exec('rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/');
    console.log('Copy result:', r.substring(0, 200));
    r = await exec('ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js && echo CP_OK');
    if (r.includes('CP_OK')) {
      console.log('Copy OK');
    } else {
      console.log('Copy failed, trying tar pipe...');
      r = await exec('rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && mkdir -p /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cd /root/lingjing-git/packages/core/dist && tar cf - . | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist');
      r = await exec('ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js && echo TARPIPE_OK');
      console.log('Tar pipe:', r);
    }

    console.log('=== Step 4: Build main.js ===');
    r = await exec('cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1');
    console.log('Main built:', r.substring(r.length - 200));

    console.log('=== Step 5: Build Linux installer ===');
    r = await exec('cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1');
    console.log('Linux build done. Last lines:', r.split('\n').filter(l => l.trim()).slice(-3).join(' | '));

    console.log('=== Step 6: Check artifacts ===');
    r = await exec('ls -la /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null || echo NO_FILES');
    console.log('Artifacts:', r);

    c.end();
  })();
});

c.on('error', e => { console.log('SSH ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
