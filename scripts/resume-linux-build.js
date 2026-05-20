const { Client } = require('ssh2');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132'
};

async function main() {
  console.log('=== Linux v1.44.9 继续构建 ===\n');
  
  const conn = new Client();
  
  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('Connected.');
      
      const buildCmd = `
set -e
cd /root/lingjing-git

echo "=== Before ==="
cat packages/electron/package.json | grep '"version"'

# Extract fresh artifacts over existing source
echo "Extracting artifacts to /root/lingjing-git/..."
cd /root/lingjing-git
tar -xzf /root/artifacts-v1449.tar.gz

echo ""
echo "=== After extraction ==="
cat /root/lingjing-git/packages/electron/package.json | grep '"version"'
cat /root/lingjing-git/packages/core/package.json | grep '"version"'

# Now build
cd /root/lingjing-git/packages/electron

# Ensure electron is installed
if [ ! -d node_modules/electron/dist ]; then
  echo "Reinstalling electron..."
  npm install electron@35.7.5 --save-dev 2>&1 | tail -5
fi

# Build Linux packages
echo ""
echo "=== Building Linux packages ==="
rm -rf release-v1449
npx electron-builder build --linux --x64 --config electron-builder.json 2>&1

echo ""
echo "=== Build results ==="
ls -lh release-v1449/ 2>/dev/null || echo "No release-v1449 dir"

# Find any release dir
echo ""
echo "=== Finding release dirs ==="
find /root/lingjing-git/packages/electron -maxdepth 2 -name "*.AppImage" -o -name "*.deb" 2>/dev/null | head -10

# Deploy
echo ""
echo "=== Deploying ==="
if [ -d release-v1449 ]; then
  cp release-v1449/*.AppImage /var/www/downloads/ 2>/dev/null || true
  cp release-v1449/*.deb /var/www/downloads/ 2>/dev/null || true
  cp release-v1449/latest-linux.yml /var/www/downloads/ 2>/dev/null || true
fi

# Also check other possible output paths
for f in /root/lingjing-git/packages/electron/release-v*/LingJing-1.44.9-linux*; do
  if [ -f "$f" ]; then
    cp "$f" /var/www/downloads/ 2>/dev/null || true
  fi
done

echo ""
echo "=== Final file list ==="
ls -lh /var/www/downloads/LingJing-1.44.9-linux* /var/www/downloads/latest-linux.yml 2>/dev/null || echo "No Linux files found"
`;
      
      conn.exec(buildCmd, { pty: true }, (err, stream) => {
        if (err) { reject(err); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.on('close', () => {
          console.log('\n=== Build process ended ===');
          conn.end();
          resolve();
        });
      });
    });
    conn.on('error', reject);
    conn.connect(SERVER);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
