const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132'
};

const ROOT = path.resolve(__dirname, '..');
const TAR_PATH = path.join(ROOT, 'lingjing-src-v1449.tar.gz');

async function main() {
  console.log('=== Linux v1.44.9 构建部署 ===\n');
  
  const conn = new Client();
  
  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('1. Connected to server');
      
      conn.sftp((err, sftp) => {
        if (err) { reject(err); return; }
        
        console.log('2. Uploading source archive (222 MB)...');
        const readStream = fs.createReadStream(TAR_PATH);
        const writeStream = sftp.createWriteStream('/root/lingjing-src-v1449.tar.gz');
        
        readStream.pipe(writeStream);
        
        let bytes = 0;
        readStream.on('data', d => {
          bytes += d.length;
          if (bytes % (10 * 1024 * 1024) < 1024) {
            console.log(`   Uploaded: ${(bytes / 1024 / 1024).toFixed(0)} MB`);
          }
        });
        
        writeStream.on('close', () => {
          console.log('3. Source uploaded, extracting and building...');
          sftp.end();
          
          // Run build script
          const buildCommands = `
set -e
cd /root
echo "Extracting source..."
rm -rf lingjing-build-1449
mkdir -p lingjing-build-1449
tar -xzf lingjing-src-v1449.tar.gz -C lingjing-build-1449
cd lingjing-build-1449

echo "Installing core deps..."
cd packages/core
npm install --no-frozen-lockfile 2>&1 | tail -3
echo "Building core..."
npx tsc 2>&1 | tail -3
cd ../..

echo "Installing renderer deps..."
cd packages/renderer
npm install --no-frozen-lockfile 2>&1 | tail -3
echo "Building renderer..."
npx vite build 2>&1 | tail -3
cd ../..

echo "Installing electron deps..."
cd packages/electron
npm install --no-frozen-lockfile 2>&1 | tail -3
echo "Syncing core dist..."
rm -rf node_modules/@codepilot/core
mkdir -p node_modules/@codepilot/core
cp -r ../core/dist node_modules/@codepilot/core/dist
cp ../core/package.json node_modules/@codepilot/core/

echo "Building electron main..."
node scripts/build-main.mjs 2>&1 | tail -5

echo "Building Linux packages..."
rm -rf release-v1449
npx electron-builder build --linux --x64 --config electron-builder.json 2>&1 | tail -10

echo "=== Build complete ==="
ls -lh release-v1449/ 2>/dev/null || echo "No release dir"

# Copy to downloads
echo "Deploying..."
cp release-v1449/*.AppImage /var/www/downloads/ 2>/dev/null || true
cp release-v1449/*.deb /var/www/downloads/ 2>/dev/null || true
cp release-v1449/latest-linux.yml /var/www/downloads/ 2>/dev/null || true

echo "=== Deployment complete ==="
echo "Files in /var/www/downloads/:"
ls -lh /var/www/downloads/LingJing-1.44.9-linux* 2>/dev/null || echo "No Linux files found"
          `;
          
          conn.exec(buildCommands, { pty: true }, (err, stream) => {
            if (err) { reject(err); return; }
            stream.on('data', d => process.stdout.write(d.toString()));
            stream.on('close', () => {
              console.log('\n=== Build and deploy complete ===');
              conn.end();
              resolve();
            });
          });
        });
      });
    });
    conn.on('error', reject);
    conn.connect(SERVER);
  });
}

main().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
