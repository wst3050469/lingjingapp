# -*- coding: utf-8 -*-
import subprocess, sys, base64

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Write a clean build script
script = '''#!/bin/bash
set -ex
ELEC="/home/liuhui/lingjing/desktop/electron"
SRC="$ELEC/release-v17374/linux-unpacked"
DEB_DIR="/tmp/deb-build-$$"
DEB_FILE="$ELEC/release-v17374/LingJing-1.73.73-linux-x86_64.deb"

rm -rf "$DEB_DIR" "$DEB_FILE"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/opt/\\u7075\\u5883"

# Copy app files - use tar for reliability
cd "$SRC"
tar cf - . | tar xf - -C "$DEB_DIR/opt/\\u7075\\u5883"

# Create control file
cat > "$DEB_DIR/DEBIAN/control" << 'ENDCTRL'
Package: lingjing-ide
Version: 1.73.73
Section: devel
Priority: optional
Architecture: amd64
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
Maintainer: LingJing AI <support@lingjing.ai>
Description: LingJing IDE - AI Powered IDE
ENDCTRL

# Symlink
mkdir -p "$DEB_DIR/usr/bin"
ln -sf /opt/\\u7075\\u5883/\\u7075\\u5883 "$DEB_DIR/usr/bin/lingjing" 2>/dev/null || true

# Build
dpkg-deb --build "$DEB_DIR" "$DEB_FILE"
echo "SUCCESS: $(ls -lh "$DEB_FILE")"
rm -rf "$DEB_DIR"
'''

encoded = base64.b64encode(script.encode('utf-8')).decode('ascii')
cmd = f'echo {encoded} | base64 -d > /tmp/build-deb-v3.sh && chmod +x /tmp/build-deb-v3.sh'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
print('Script created:', r.returncode, flush=True)

# Run synchronously with timeout
LOG = ELEC + '/dpkg-deb-v2.log'
r = subprocess.run(['ssh', SERVER, f'bash /tmp/build-deb-v3.sh > {LOG} 2>&1'], capture_output=True, timeout=300)
print('RC:', r.returncode, flush=True)

# Check result
r = subprocess.run(['ssh', SERVER, 'cat ' + LOG], capture_output=True, timeout=15)
print('Log:', r.stdout.decode('utf-8', errors='replace').strip()[-500:], flush=True)

r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.deb 2>&1'], capture_output=True, timeout=10)
print('Deb:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
