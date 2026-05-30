const { Client } = require('ssh2');
const conn = new Client();

function log(m) { console.log(new Date().toISOString().substr(11,8) + ' ' + m); }

conn.on('ready', async () => {
  function exec(cmd) {
    return new Promise((res) => {
      conn.exec(cmd, (err, stream) => {
        let o = '';
        stream.on('data', d => o += d);
        stream.stderr.on('data', d => {});
        stream.on('close', () => res(o.trim()));
      });
    });
  }

  log('Connected. Reading versions.json...');
  let r = await exec('cat /var/www/downloads/versions.json');
  const versions = JSON.parse(r);

  // Count current versions
  log(`Current versions count: ${versions.versions.length}`);

  // Keep only last 5 unique versions (remove duplicates)
  // v1.50.0, v1.49.0, v1.48.1, v1.48.0, v1.47.3
  const keepVersions = ['1.50.0', '1.49.0', '1.48.1', '1.48.0', '1.47.3'];

  // Filter - keep only entries that are in keepVersions list
  const filtered = versions.versions.filter(v => keepVersions.includes(v.version));
  
  // Also deduplicate: if multiple entries for same version, keep the first one
  const seen = new Set();
  const deduped = [];
  for (const entry of filtered) {
    if (!seen.has(entry.version)) {
      seen.add(entry.version);
      deduped.push(entry);
    }
  }

  // Set v1.50.0 to pending_review
  const v150 = deduped.find(v => v.version === '1.50.0');
  if (v150) {
    v150.status = 'pending_review';
    v150.submittedAt = new Date().toISOString();
    // Remove publishedAt if present
    delete v150.publishedAt;
    log('Set v1.50.0 status to pending_review');
  }

  // Also ensure v1.49.0 (last working) is published
  const v149 = deduped.find(v => v.version === '1.49.0');
  if (v149) {
    v149.status = 'published';
    log('Set v1.49.0 status to published');
  }

  // Update latest pointer to point to v1.49.0 (last working version)
  // Don't point to pending_review version
  versions.latest = '1.49.0';
  versions.versions = deduped;
  
  log(`Filtered to ${deduped.length} unique versions`);
  deduped.forEach(v => log(`  ${v.version} (${v.status})`));

  const updatedJson = JSON.stringify(versions, null, 2);

  // Write to all 4 locations
  const verLocs = [
    '/var/www/downloads',
    '/root/lingjing-update/data',
    '/var/www/update-server/data',
    '/opt/lingjing-update/data',
  ];

  for (const loc of verLocs) {
    try {
      await exec(`mkdir -p ${loc} && cat > ${loc}/versions.json << 'ENJSON'\n${updatedJson}\nENJSON`);
      log(`  ${loc}/versions.json updated`);
    } catch (e) {
      log(`  ${loc} skipped: ${e.message}`);
    }
  }

  // Clean up old files on server
  log('Cleaning up old download files...');
  // Remove old Linux files (keep only 5 most recent)
  const keepFiles = [
    'LingJing-1.47.3-linux-x86_64.AppImage',
    'LingJing-1.47.3-linux-x86_64.deb',
    'LingJing-1.48.1-linux-x86_64.AppImage',
    'LingJing-1.48.1-linux-x86_64.deb',
    'LingJing-Setup-1.49.0-linux-x86_64.AppImage',
    'LingJing-Setup-1.49.0-linux-amd64.deb',
    'LingJing-1.50.0-win-x64.exe',
    'LingJing-Portable-1.50.0-win-x64.exe',
    'LingJing-1.49.0-win-x64.exe',
    'LingJing-Portable-1.49.0-win-x64.exe',
    'LingJing-Setup-1.49.0-win-x64.exe',
    'LingJing-Portable-1.48.1-win-x64.exe',
    'LingJing-Setup-1.48.1-win-x64.exe',
    'LingJing-Portable-1.48.0-win-x64.exe',
    'LingJing-Setup-1.48.0-win-x64.exe',
    'latest.yml',
    'latest-linux.yml',
  ];

  // Actually, let's be more careful. Just clean versions.json for now.
  // File cleanup can be done separately.

  // Restart PM2
  log('Restarting PM2...');
  await exec('pm2 restart update-server 2>/dev/null || true');
  await exec('pm2 restart cloud-server 2>/dev/null || true');

  // Verify
  r = await exec(`curl -s https://ide.zhejiangjinmo.com/api/latest`);
  log(`API /latest: ${r}`);

  conn.end();
  log('Done!');
});

conn.on('error', e => { log('ERR: ' + e.message); process.exit(1); });
conn.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
