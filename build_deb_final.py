# -*- coding: utf-8 -*-
import subprocess, sys, base64

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Write a robust build script on the build machine
script = '''#!/bin/bash
set -e
ELEC="/home/liuhui/lingjing/desktop/electron"
SRC="$ELEC/release-v17374/linux-unpacked"
DEB_FILE="$ELEC/release-v17374/LingJing-1.73.73-linux-x86_64.deb"
TEMP_DIR="/tmp/lingjing-deb-build"

rm -rf "$TEMP_DIR" "$DEB_FILE"
mkdir -p "$TEMP_DIR/DEBIAN"
mkdir -p "$TEMP_DIR/opt/灵境"

# Copy with rsync for reliability (skip if no rsync)
if command -v rsync &>/dev/null; then
  rsync -a "$SRC/" "$TEMP_DIR/opt/灵境/"
else
  cp -a "$SRC/." "$TEMP_DIR/opt/灵境/"
fi

# Control file
cat > "$TEMP_DIR/DEBIAN/control" << 'EOF'
Package: lingjing-ide
Version: 1.73.73
Section: devel
Priority: optional
Architecture: amd64
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
Maintainer: LingJing AI <support@lingjing.ai>
Description: LingJing IDE - AI Powered IDE
EOF

# Symlink
mkdir -p "$TEMP_DIR/usr/bin"
ln -sf /opt/灵境/lingjing "$TEMP_DIR/usr/bin/lingjing" 2>/dev/null || true

# Build with gzip compression (faster than xz)
dpkg-deb -Zgzip --build "$TEMP_DIR" "$DEB_FILE"
echo "EXIT_CODE=$?"
echo "SIZE: $(stat -c%s "$DEB_FILE" 2>/dev/null || echo 0) bytes"
rm -rf "$TEMP_DIR"
echo "DONE"
'''

encoded = base64.b64encode(script.encode('utf-8')).decode('ascii')
cmd = f'echo {encoded} | base64 -d > /tmp/build-deb-final.sh && chmod +x /tmp/build-deb-final.sh'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
print('Script created:', r.returncode, flush=True)

# Run in background with log
LOG = ELEC + '/deb-final.log'
r = subprocess.run(['ssh', SERVER, f'nohup bash /tmp/build-deb-final.sh > {LOG} 2>&1 & echo $!'], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'deb build PID: {pid}', flush=True)
print(f'Using gzip compression (faster), check: cat {LOG}', flush=True)
