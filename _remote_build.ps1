# Remote build and deploy script
Write-Host "=== Phase 96 Build & Deploy v1.52.6 ==="

$sshBase = "ssh root@120.55.5.220"

# Step 1: Pull latest code on production
Write-Host "[1/4] Pulling latest code on production..."
$result = Invoke-Expression "$sshBase 'cd /root/lingjing-git && git pull origin main'"
Write-Host $result

# Step 2: Build Electron (Linux AppImage + Deb)
Write-Host "[2/4] Building Electron (Linux)..."
$result = Invoke-Expression "$sshBase 'cd /root/lingjing-git && pnpm install --frozen-lockfile && cd packages/electron && node scripts/build-main.mjs && node scripts/pre-package.mjs && npx electron-builder build --linux --x64'"
Write-Host $result

# Step 3: Copy build artifacts to download directory
Write-Host "[3/4] Deploying build artifacts..."
$result = Invoke-Expression "$sshBase 'cp -f /root/lingjing-git/packages/electron/dist/*.AppImage /var/www/html/downloads/ 2>/dev/null; cp -f /root/lingjing-git/packages/electron/dist/*.deb /var/www/html/downloads/ 2>/dev/null; ls -la /var/www/html/downloads/*.AppImage /var/www/html/downloads/*.deb 2>/dev/null'"
Write-Host $result

# Step 4: Update versions.json and restart update-server
Write-Host "[4/4] Updating versions and restarting update-server..."
$result = Invoke-Expression "$sshBase '/root/lingjing-git/scripts/update-versions.sh 2>/dev/null || echo "No update script, manual update needed"'"
Write-Host $result

Write-Host "=== Build & Deploy Complete ==="
