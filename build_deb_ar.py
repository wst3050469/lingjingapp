# -*- coding: utf-8 -*-
import subprocess, sys, base64

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Build deb manually using ar + tar (no dpkg-deb)
script = '''#!/bin/bash
set -e
ELEC="/home/liuhui/lingjing/desktop/electron"
SRC="$ELEC/release-v17374/linux-unpacked"
DEB_FILE="$ELEC/release-v17374/LingJing-1.73.73-linux-x86_64.deb"
TEMP_DIR="/tmp/lingjing-deb-ar"
DEB_VER="1.73.73"

rm -rf "$TEMP_DIR" "$DEB_FILE"
mkdir -p "$TEMP_DIR/opt/lingjing-ide"

# Copy files
cp -a "$SRC/." "$TEMP_DIR/opt/lingjing-ide/"

# Symlink
mkdir -p "$TEMP_DIR/usr/bin"
ln -sf /opt/lingjing-ide/lingjing "$TEMP_DIR/usr/bin/lingjing" 2>/dev/null || true

# Create control.tar.gz
CTRL_DIR="$TEMP_DIR/DEBIAN"
mkdir -p "$CTRL_DIR"
cat > "$CTRL_DIR/control" << ENDCTRL
Package: lingjing-ide
Version: $DEB_VER
Section: devel
Priority: optional
Architecture: amd64
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
Maintainer: LingJing AI <support@lingjing.ai>
Description: LingJing IDE - AI Powered IDE
ENDCTRL

# Create data.tar.gz (from opt/ and usr/)
cd "$TEMP_DIR"
tar czf "$TEMP_DIR/data.tar.gz" opt/ usr/
tar czf "$TEMP_DIR/control.tar.gz" -C DEBIAN control

# Create debian-binary
echo "2.0" > "$TEMP_DIR/debian-binary"

# Build .deb (ar archive)
cd "$TEMP_DIR"
ar rcs "$DEB_FILE" debian-binary control.tar.gz data.tar.gz

echo "EXIT_CODE=$?"
echo "SIZE: $(stat -c%s "$DEB_FILE" 2>/dev/null) bytes"
rm -rf "$TEMP_DIR"
echo "DONE"
'''

encoded = base64.b64encode(script.encode('utf-8')).decode('ascii')
cmd = f'echo {encoded} | base64 -d > /tmp/build-deb-ar.sh && chmod +x /tmp/build-deb-ar.sh'
subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)

LOG = ELEC + '/deb-ar.log'
r = subprocess.run(['ssh', SERVER, f'nohup bash /tmp/build-deb-ar.sh > {LOG} 2>&1 & echo $!'], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'ar deb build PID: {pid}', flush=True)
print(f'Check: cat {LOG}', flush=True)
