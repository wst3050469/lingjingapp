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

async function main() {
  console.log('=== Linux v1.44.9 构建部署 (v2 - 使用 pnpm) ===\n');
  
  // First, check if there's a complete git repo on the server we can use
  const conn = new Client();
  
  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      conn.exec('cd /root/lingjing-git && git log --oneline -1 && cat packages/electron/package.json | head -3', (err, stream) => {
        if (err) { reject(err); return; }
        let out = '';
        stream.on('data', d => out += d.toString());
        stream.on('close', () => {
          console.log('Server git status:\n' + out);
          conn.end();
          resolve();
        });
      });
    });
    conn.on('error', reject);
    conn.connect(SERVER);
  });
  
  // Update source files on server via SFTP
  console.log('\nSyncing changed v1.44.9 source files...');
  
  const conn2 = new Client();
  await new Promise((resolve, reject) => {
    conn2.on('ready', () => {
      conn2.sftp((err, sftp) => {
        if (err) { reject(err); return; }
        
        const files = [
          { local: 'package.json', remote: '/root/lingjing-git/package.json' },
          { local: 'packages/core/package.json', remote: '/root/lingjing-git/packages/core/package.json' },
          { local: 'packages/electron/package.json', remote: '/root/lingjing-git/packages/electron/package.json' },
          { local: 'packages/electron/electron-builder.json', remote: '/root/lingjing-git/packages/electron/electron-builder.json' },
          { local: 'packages/electron/src/ipc/cloud-ipc.ts', remote: '/root/lingjing-git/packages/electron/src/ipc/cloud-ipc.ts' },
          { local: 'packages/electron/src/ipc/ipc-verifier.ts', remote: '/root/lingjing-git/packages/electron/src/ipc/ipc-verifier.ts' },
          { local: 'packages/electron/src/preload.ts', remote: '/root/lingjing-git/packages/electron/src/preload.ts' },
          { local: 'packages/renderer/src/components/settings/tabs/CloudSyncTab.tsx', remote: '/root/lingjing-git/packages/renderer/src/components/settings/tabs/CloudSyncTab.tsx' },
        ];
        
        let i = 0;
        function next() {
          if (i >= files.length) {
            console.log('All files synced!');
            sftp.end();
            conn2.end();
            resolve();
            return;
          }
          const f = files[i++];
          try {
            const content = fs.readFileSync(path.join(ROOT, f.local));
            sftp.writeFile(f.remote, content, (err) => {
              if (err) console.error(`Error uploading ${f.local}: ${err.message}`);
              else process.stdout.write('.');
              next();
            });
          } catch(e) {
            console.error(`Error reading ${f.local}: ${e.message}`);
            next();
          }
        }
        next();
      });
    });
    conn2.on('error', reject);
    conn2.connect(SERVER);
  });
  
  console.log('\n\nNow syncing core dist files...');
  
  // Sync the complete dist/ directory for core (needed for esbuild bundling)
  const conn3 = new Client();
  await new Promise((resolve, reject) => {
    conn3.on('ready', () => {
      conn3.exec('rm -rf /tmp/core-dist && mkdir -p /tmp/core-dist', (err) => {
        if (err) { reject(err); return; }
        
        conn3.sftp((err, sftp) => {
          if (err) { reject(err); return; }
          
          // Upload core dist as tar from local
          const localDist = path.join(ROOT, 'packages', 'core', 'dist');
          const files2 = [];
          
          function walkDir(dir, base) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              const relPath = path.join(base, entry.name).replace(/\\/g, '/');
              if (entry.isDirectory()) {
                walkDir(fullPath, relPath);
              } else {
                files2.push({ local: fullPath, remote: '/tmp/core-dist/' + relPath });
              }
            }
          }
          walkDir(localDist, '');
          
          console.log(`Uploading ${files2.length} dist files...`);
          
          let j = 0;
          function next2() {
            if (j >= files2.length) {
              console.log('\nAll dist files uploaded. Moving to packages...');
              conn3.exec('cp -r /tmp/core-dist /root/lingjing-git/packages/core/dist && cp -r /tmp/core-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist', (err) => {
                if (err) console.error('Copy error:', err.message);
                conn3.exec('rm -rf /tmp/core-dist', () => {});
                console.log('Dist files synced!');
                sftp.end();
                conn3.end();
                resolve();
              });
              return;
            }
            const f = files2[j++];
            try {
              const content = fs.readFileSync(f.local);
              const remotePath = f.remote;
              const dir = path.dirname(remotePath).replace(/\\/g, '/');
              
              conn3.exec('mkdir -p ' + dir, () => {
                sftp.writeFile(remotePath, content, (err) => {
                  if (err) console.error(`Error: ${f.remote}: ${err.message}`);
                  if (j % 100 === 0) process.stdout.write(`\n  ${j}/${files2.length}`);
                  next2();
                });
              });
            } catch(e) {
              console.error(`Error reading ${f.local}: ${e.message}`);
              next2();
            }
          }
          next2();
        });
      });
    });
    conn3.on('error', (e) => { console.error('Connection error:', e); reject(e); });
    conn3.connect(SERVER);
  });
  
  console.log('\n\n=== Now building on server ===');
  
  const conn4 = new Client();
  await new Promise((resolve, reject) => {
    conn4.on('ready', () => {
      const buildScript = `
cd /root/lingjing-git

# Check version
echo "Version from package.json:"
cat packages/electron/package.json | head -3

# Build core
echo "\\nBuilding core..."
cd packages/core
pnpm build 2>&1 | tail -5
cd ../..

# Build renderer
echo "\\nBuilding renderer..."
cd packages/renderer
pnpm build 2>&1 | tail -5
cd ../..

# Build electron
echo "\\nBuilding electron main..."
cd packages/electron
pnpm build 2>&1 | tail -10

# Now also sync the dist from core to electron node_modules
echo "\\nSyncing core dist to electron node_modules..."
cp -r ../core/dist node_modules/@codepilot/core/dist/

# Build main.js with fresh core dist
node scripts/build-main.mjs 2>&1 | tail -5

# Build Linux
echo "\\nBuilding Linux packages..."
rm -rf release-v1449
npx electron-builder build --linux --x64 --config electron-builder.json 2>&1

echo "\\n=== Build results ==="
ls -lh release-v1449/ 2>/dev/null || echo "No release dir"

# Deploy
if [ -d release-v1449 ]; then
  echo "\\n=== Deploying ==="
  cp release-v1449/*.AppImage /var/www/downloads/ 2>/dev/null || true
  cp release-v1449/*.deb /var/www/downloads/ 2>/dev/null || true
  cp release-v1449/latest-linux.yml /var/www/downloads/ 2>/dev/null || true
  echo "Files in /var/www/downloads/:"
  ls -lh /var/www/downloads/LingJing-1.44.9-linux* 2>/dev/null || echo "No Linux files"
fi
      `;
      
      conn4.exec(buildScript, { pty: true }, (err, stream) => {
        if (err) { reject(err); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.on('close', () => {
          console.log('\n=== Build and deploy process complete ===');
          conn4.end();
          resolve();
        });
      });
    });
    conn4.on('error', reject);
    conn4.connect(SERVER);
  });
  
  // Update versions.json
  console.log('\n=== Updating versions.json ===');
  const conn5 = new Client();
  await new Promise((resolve, reject) => {
    conn5.on('ready', () => {
      conn5.exec('ls -lh /var/www/downloads/LingJing-1.44.9-linux* 2>/dev/null', (err, stream) => {
        let out = '';
        stream.on('data', d => out += d.toString());
        stream.on('close', () => {
          console.log('Linux files on server:\n' + out);
          conn5.end();
          resolve();
        });
      });
    });
    conn5.on('error', reject);
    conn5.connect(SERVER);
  });
}

main().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
