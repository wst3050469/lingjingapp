const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const { execSync } = require('child_process');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132'
};

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('=== Step 1: Sync source to server ===');
  
  // Create a temp sync script
  const syncScript = `
set -e
cd /root/lingjing-build-1449

# Ensure dir exists
mkdir -p packages/electron/src/ipc
mkdir -p packages/electron/scripts
mkdir -p packages/electron/assets
mkdir -p packages/electron/types
mkdir -p packages/core/package.json
mkdir -p packages/renderer/src/components/settings/tabs

echo "Step 1: Source synced, building..."
cd /root/lingjing-build-1449

# Build @codepilot/core
echo "Building core..."
cd packages/core
npm install 2>&1 | tail -3
npx tsc 2>&1 | tail -3
cd ../..

# Build renderer
echo "Building renderer..."
cd packages/renderer
npm install 2>&1 | tail -3
npx vite build 2>&1 | tail -3
cd ../..

# Build electron
echo "Building electron main..."
cd packages/electron
npm install 2>&1 | tail -3
cp -r ../core/dist node_modules/@codepilot/core/dist 2>/dev/null || true
node scripts/build-main.mjs 2>&1 | tail -5

# Build Linux packages
echo "Building Linux packages (AppImage + deb)..."
rm -f release-v1449/*.AppImage release-v1449/*.deb release-v1449/*.yml 2>/dev/null || true
npx electron-builder build --linux --x64 --config electron-builder.json 2>&1 | tail -10

echo "---"
echo "Build complete! Checking output..."
ls -lh release-v1449/ 2>/dev/null || echo "No release-v1449 dir"
echo "---"
echo "Checking release dir..."
ls -lh dist/ 2>/dev/null | head -5
`;

  fs.writeFileSync(path.join(ROOT, '_build-linux.sh'), syncScript);
  
  console.log('Syncing source files...');
  
  // Use SSH2 to sync files
  const conn = new Client();
  
  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('Connected to server');
      
      // Create build directory
      conn.exec('rm -rf /root/lingjing-build-1449 && mkdir -p /root/lingjing-build-1449', (err, stream) => {
        if (err) { reject(err); return; }
        let out = '';
        stream.on('data', d => out += d.toString());
        stream.on('close', () => {
          console.log('Build directory created');
          
          // Now we need to sync files via sftp
          conn.sftp((err, sftp) => {
            if (err) { reject(err); return; }
            
            // Copy build script
            const scriptContent = fs.readFileSync(path.join(ROOT, '_build-linux.sh'), 'utf-8');
            sftp.writeFile('/root/lingjing-build-1449/build.sh', Buffer.from(scriptContent, 'utf-8'), (err) => {
              if (err) { reject(err); return; }
              console.log('Build script uploaded');
              
              // Set executable
              conn.exec('chmod +x /root/lingjing-build-1449/build.sh', (err) => {
                if (err) { reject(err); return; }
                
                // Now upload all necessary files
                const filesToUpload = [
                  // Root level
                  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
                  
                  // Core
                  { local: 'packages/core/package.json', remote: 'packages/core/package.json' },
                  { local: 'packages/core/tsconfig.json', remote: 'packages/core/tsconfig.json' },
                  
                  // Electron
                  { local: 'packages/electron/package.json', remote: 'packages/electron/package.json' },
                  { local: 'packages/electron/tsconfig.json', remote: 'packages/electron/tsconfig.json' },
                  { local: 'packages/electron/tsconfig.preload.json', remote: 'packages/electron/tsconfig.preload.json' },
                  { local: 'packages/electron/electron-builder.json', remote: 'packages/electron/electron-builder.json' },
                  { local: 'packages/electron/scripts/build-main.mjs', remote: 'packages/electron/scripts/build-main.mjs' },
                  { local: 'packages/electron/src/main.ts', remote: 'packages/electron/src/main.ts' },
                  { local: 'packages/electron/src/preload.ts', remote: 'packages/electron/src/preload.ts' },
                  { local: 'packages/electron/src/ipc/cloud-ipc.ts', remote: 'packages/electron/src/ipc/cloud-ipc.ts' },
                  { local: 'packages/electron/src/ipc/ipc-verifier.ts', remote: 'packages/electron/src/ipc/ipc-verifier.ts' },
                  
                  // Renderer
                  { local: 'packages/renderer/package.json', remote: 'packages/renderer/package.json' },
                  { local: 'packages/renderer/vite.config.ts', remote: 'packages/renderer/vite.config.ts' },
                  { local: 'packages/renderer/tsconfig.json', remote: 'packages/renderer/tsconfig.json' },
                  { local: 'packages/renderer/index.html', remote: 'packages/renderer/index.html' },
                  { local: 'packages/renderer/src/components/settings/tabs/CloudSyncTab.tsx', remote: 'packages/renderer/src/components/settings/tabs/CloudSyncTab.tsx' },
                ];
                
                let uploaded = 0;
                function uploadNext() {
                  if (uploaded >= filesToUpload.length) {
                    console.log(`All ${filesToUpload.length} files uploaded. Running build...`);
                    sftp.end();
                    conn.end();
                    resolve();
                    return;
                  }
                  
                  const f = filesToUpload[uploaded];
                  const localPath = typeof f === 'string' ? path.join(ROOT, f) : path.join(ROOT, f.local);
                  const remotePath = typeof f === 'string' ? f : f.remote;
                  
                  try {
                    const content = fs.readFileSync(localPath);
                    const fullRemote = '/root/lingjing-build-1449/' + remotePath;
                    const dir = path.dirname(fullRemote).replace(/\\/g, '/');
                    
                    // Ensure directory exists
                    conn.exec('mkdir -p ' + dir, () => {
                      sftp.writeFile(fullRemote, content, (err) => {
                        if (err) {
                          console.error(`Failed to upload ${remotePath}: ${err.message}`);
                        } else {
                          process.stdout.write('.');
                        }
                        uploaded++;
                        uploadNext();
                      });
                    });
                  } catch(e) {
                    console.error(`\nError reading ${localPath}: ${e.message}`);
                    uploaded++;
                    uploadNext();
                  }
                }
                uploadNext();
              });
            });
          });
        });
      });
    });
    conn.on('error', reject);
    conn.connect(SERVER);
  });
  
  console.log('\nFiles synced. Now running build...');
  
  // Step 2: Run build on server
  const conn2 = new Client();
  await new Promise((resolve, reject) => {
    conn2.on('ready', () => {
      conn2.exec('cd /root/lingjing-build-1449 && bash build.sh 2>&1', { pty: true }, (err, stream) => {
        if (err) { reject(err); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.on('close', () => {
          console.log('\nBuild process completed');
          conn2.end();
          resolve();
        });
      });
    });
    conn2.on('error', reject);
    conn2.connect(SERVER);
  });
  
  // Step 3: Deploy
  console.log('\n=== Step 3: Deploy Linux builds ===');
  const conn3 = new Client();
  await new Promise((resolve, reject) => {
    conn3.on('ready', () => {
      conn3.exec('ls -lh /root/lingjing-build-1449/packages/electron/release-v1449/', (err, stream) => {
        if (err) {
          console.error('No release-v1449 directory, checking other dirs...');
          conn3.exec('find /root/lingjing-build-1449/packages/electron -name "*.AppImage" -o -name "*.deb" 2>/dev/null', (err2, stream2) => {
            if (err2) { reject(err2); return; }
            stream2.on('data', d => console.log(d.toString()));
            stream2.on('close', () => { conn3.end(); resolve(); });
          });
          return;
        }
        let out = '';
        stream.on('data', d => out += d.toString());
        stream.on('close', () => {
          console.log('Build outputs:\n' + out);
          conn3.end();
          resolve();
        });
      });
    });
    conn3.on('error', reject);
    conn3.connect(SERVER);
  });
}

main().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
