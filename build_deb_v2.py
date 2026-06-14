# -*- coding: utf-8 -*-
import subprocess, sys, base64

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Write a build script on the build machine
script = '''#!/bin/bash
set -e
ELEC="/home/liuhui/lingjing/desktop/electron"
SRC="$ELEC/release-v17374/linux-unpacked"
DEB_DIR="$ELEC/release-v17374/deb-build"
DEB_FILE="$ELEC/release-v17374/LingJing-1.73.73-linux-x86_64.deb"

rm -rf "$DEB_DIR"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/opt"

# Copy app files
cp -a "$SRC" "$DEB_DIR/opt/灵境"

# Create control file
cat > "$DEB_DIR/DEBIAN/control" << ENDCONTROL
Package: lingjing-ide
Version: 1.73.73
Section: devel
Priority: optional
Architecture: amd64
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
Maintainer: LingJing AI <support@lingjing.ai>
Description: LingJing IDE - AI Powered IDE
ENDCONTROL

# Create symlink
mkdir -p "$DEB_DIR/usr/bin"
ln -sf /opt/灵境/灵境 "$DEB_DIR/usr/bin/lingjing"

# Build deb
dpkg-deb --build "$DEB_DIR" "$DEB_FILE"
echo "DONE: $(ls -lh "$DEB_FILE")"

# Cleanup
rm -rf "$DEB_DIR"
'''

encoded = base64.b64encode(script.encode('utf-8')).decode('ascii')
cmd = f'echo {encoded} | base64 -d > /tmp/build-deb-dpkg.sh && chmod +x /tmp/build-deb-dpkg.sh'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
print('Script created:', r.returncode, flush=True)

# Run it in background
LOG = ELEC + '/dpkg-deb.log'
r = subprocess.run(['ssh', SERVER, f'nohup /tmp/build-deb-dpkg.sh > {LOG} 2>&1 & echo $!'], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'Build PID: {pid}', flush=True)
print(f'Check: cat {LOG}', flush=True)
