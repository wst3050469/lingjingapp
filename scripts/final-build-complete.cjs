const { Client } = require('ssh2');
const c = new Client();

c.on('ready', () => {
  function exec(cmd) {
    return new Promise((res) => {
      c.exec(cmd, (err, s) => {
        if (err) { console.log('EXEC ERR:', err.message); res(''); return; }
        let o = '';
        s.on('data', d => { process.stdout.write(d.toString()); o += d; });
        s.stderr.on('data', d => { process.stderr.write(d.toString()); });
        s.on('close', () => res(o.trim()));
      });
    });
  }

  (async () => {
    let r;

    // Step 1: Update version
    console.log('\n=== Step 1: Update version ===');
    r = await exec('sed -i s/1.49.0/1.50.0/g /root/lingjing-git/packages/electron/package.json && grep version /root/lingjing-git/packages/electron/package.json');
    console.log('Version:', r);

    // Step 2: Copy dist to electron (direct from /tmp, avoiding packages/core/dist)
    console.log('\n=== Step 2: Copy dist to electron ===');
    r = await exec('rm -rf /tmp/build-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && mkdir -p /tmp/build-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cd /tmp/build-dist && tar -xzf /tmp/dist-fixed.tar.gz && cd dist && tar cf - . | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js');
    console.log('Dist copy:', r);

    // Step 3: Build main.js
    console.log('\n=== Step 3: Build main.js ===');
    r = await exec('cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1');
    console.log('Main build:', r.substring(Math.max(0, r.length - 200)));

    // Step 4: Build Linux installer
    console.log('\n=== Step 4: Build Linux (5-10 min) ===');
    r = await exec('cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1');
    console.log('Linux build complete');
    console.log('Tail:', r.split('\n').filter(l => l.trim()).slice(-5).join('\n'));

    // Step 5: Copy artifacts to download dir
    console.log('\n=== Step 5: Copy artifacts ===');
    r = await exec('for f in /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*; do [ -f "$f" ] && cp "$f" /var/www/downloads/$(basename "$f") && echo "COPIED $(basename "$f")"; done');
    console.log(r);

    // Step 6: Verify
    console.log('\n=== Step 6: Verify ===');
    r = await exec('ls -la /var/www/downloads/LingJing-1.50.0-linux-* 2>/dev/null || echo NO_LINUX_FILES');
    console.log('Download files:\n' + r);

    // Step 7: Update versions.json
    console.log('\n=== Step 7: Update versions.json ===');
    r = await exec('cat /var/www/downloads/versions.json');
    const versions = JSON.parse(r);
    const entry = versions.versions.find(v => v.version === '1.50.0');
    if (entry) {
      entry.status = 'pending_review';
      const appImage = entry.files['linux-x64'] ? true : await exec('ls /var/www/downloads/LingJing-1.50.0-linux-*AppImage 2>/dev/null && echo FOUND || echo NOT_FOUND');
      if (appImage === 'FOUND' || (entry.files['linux-x64'] && appImage !== 'NOT_FOUND')) {
        // Get sizes
        const files = (await exec('ls /var/www/downloads/LingJing-1.50.0-linux-* 2>/dev/null')).split('\n').filter(Boolean);
        for (const f of files) {
          const name = f.split('/').pop();
          const sz = await exec('stat -c%s /var/www/downloads/' + name);
          if (name.includes('.AppImage')) entry.files['linux-x64'] = { url: name, size: parseInt(sz) };
          if (name.includes('.deb')) entry.files['linux-deb'] = { url: name, size: parseInt(sz) };
        }
      }
    }
    const updatedJson = JSON.stringify(versions, null, 2);
    const locs = ['/var/www/downloads', '/root/lingjing-update/data', '/var/www/update-server/data', '/opt/lingjing-update/data'];
    for (const loc of locs) {
      await exec('mkdir -p ' + loc + ' && cat > ' + loc + '/versions.json << EOF\n' + updatedJson + '\nEOF');
      console.log('  ' + loc + ' updated');
    }

    // Step 8: Update latest-linux.yml
    console.log('\n=== Step 8: latest-linux.yml ===');
    const appImg = await exec('ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*AppImage 2>/dev/null || echo ""');
    const deb = await exec('ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*deb 2>/dev/null || echo ""');
    let yml = 'version: 1.50.0\nfiles:\n';
    for (const f of [appImg, deb].filter(Boolean)) {
      const name = f.split('/').pop();
      const hash = await exec('openssl dgst -sha512 -binary "' + f + '" | base64 -w0');
      const size = await exec('stat -c%s "' + f + '"');
      yml += '  - url: ' + name + '\n    sha512: ' + hash + '\n    size: ' + size + '\n';
    }
    const firstPath = appImg || deb;
    const firstHash = appImg ? await exec('openssl dgst -sha512 -binary "' + appImg + '" | base64 -w0') : '';
    yml += 'path: ' + firstPath.split('/').pop() + '\nsha512: ' + firstHash + '\nreleaseDate: ' + new Date().toISOString() + '\n';
    await exec('cat > /var/www/downloads/latest-linux.yml << EOF\n' + yml + '\nEOF');
    console.log('latest-linux.yml done');

    // Step 9: Restart PM2
    console.log('\n=== Step 9: Restart PM2 ===');
    await exec('pm2 restart update-server 2>/dev/null || true');
    await exec('pm2 restart cloud-server 2>/dev/null || true');
    
    console.log('\n=== ALL COMPLETE ===');
    c.end();
  })();
});

c.on('error', e => { console.log('SSH ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
