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
const ARTIFACTS = path.join(ROOT, 'artifacts.tar.gz');

async function main() {
  console.log('=== Linux v1.44.9 构建部署 ===\n');
  
  const conn = new Client();
  
  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('1. Connected to server');
      
      conn.sftp((err, sftp) => {
        if (err) { reject(err); return; }
        
        console.log('2. Uploading artifacts (3.7 MB)...');
        const readStream = fs.createReadStream(ARTIFACTS);
        const writeStream = sftp.createWriteStream('/root/artifacts-v1449.tar.gz');
        
        readStream.pipe(writeStream);
        
        writeStream.on('close', () => {
          console.log('3. Uploaded! Extracting and building...');
          sftp.end();
          
          const buildCmd = `
set -e
cd /root/lingjing-git

# Backup package.json files for version comparison
echo "=== Before ==="
cat packages/electron/package.json | grep version

# Extract artifacts over existing source
cd /
tar -xzf /root/artifacts-v1449.tar.gz -C /root/lingjing-git

echo "=== After (versions patched) ==="
cat /root/lingjing-git/packages/electron/package.json | grep version

cd /root/lingjing-git

# Fix version in electron-builder output dir name - check if it needs to be v1449
echo "=== Checking electron-builder.json ==="
cat packages/electron/electron-builder.json | grep output

# Ensure electron is installed
cd packages/electron
if [ ! -d node_modules/electron ]; then
  echo "Installing electron..."
  npm install electron@35.7.5 --save-dev 2>&1 | tail -3
fi

# Build Linux packages
echo "\\n=== Building Linux packages ==="
rm -rf release-v1449
npx electron-builder build --linux --x64 --config electron-builder.json 2>&1

echo "\\n=== Build results ==="
ls -lh release-v1449/ 2>/dev/null || echo "No release-v1449 directory"

# If release dir has different name, find it
echo "Checking for any release dirs..."
find packages/electron -maxdepth 1 -name "release-v*" -type d 2>/dev/null
ls -lh packages/electron/release-*/ 2>/dev/null || true

# Deploy any found files
echo "\\n=== Deploying ==="
for dir in packages/electron/release-v*; do
  if [ -d "$dir" ]; then
    cp "$dir"/*.AppImage /var/www/downloads/ 2>/dev/null || true
    cp "$dir"/*.deb /var/www/downloads/ 2>/dev/null || true
    cp "$dir"/latest-linux.yml /var/www/downloads/ 2>/dev/null || true
    echo "Deployed from: $dir"
  fi
done

echo "\\n=== Final file list ==="
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
