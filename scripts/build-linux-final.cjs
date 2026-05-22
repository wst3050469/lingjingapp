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
    // Step 1: Update version
    console.log('=== Step 1: Update version ===');
    await exec('sed -i s/1.49.0/1.50.0/g /root/lingjing-git/packages/electron/package.json');

    // Step 2+3: Extract dist and copy directly to electron (single exec, skip packages/core)
    console.log('=== Step 2: Extract dist + copy to electron ===');
    r = await exec('rm -rf /tmp/build-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && mkdir -p /tmp/build-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cd /tmp/build-dist && tar -xzf /tmp/dist-fixed.tar.gz && cd dist && tar cf - . | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js');
    console.log('Direct copy result:', r);

    // Step 4: Build main.js
    console.log('=== Step 4: Build main.js ===');
    await exec('cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -3');
    console.log('Main build done');

    // Step 5: Build Linux installer
    console.log('=== Step 5: Build Linux installer (5-10 min) ===');
    await exec('cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1');
    console.log('Linux build done');

    // Step 6: Check and copy artifacts
    console.log('=== Step 6: Find and copy artifacts ===');
    r = await exec('for f in /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*; do [ -f "$f" ] && cp "$f" /var/www/downloads/$(basename "$f") && echo "COPIED $(basename "$f")"; done');
    console.log('Copy result:', r);

    // Step 7: Verify
    console.log('=== Step 7: Verify download files ===');
    r = await exec('ls -la /var/www/downloads/LingJing-1.50.0-linux-* 2>/dev/null || echo NO_DL_FILES');
    console.log('Download dir:', r);

    c.end();
  })();
});

c.on('error', e => { console.log('SSH ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
