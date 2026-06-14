# -*- coding: utf-8 -*-
import subprocess, sys, base64

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Build script - no unicode escapes, use tar for reliable copy
script = '''#!/bin/bash
ELEC="/home/liuhui/lingjing/desktop/electron"
SRC="$ELEC/release-v17374/linux-unpacked"
DEB_DIR="/tmp/deb-build-$$"
DEB_FILE="$ELEC/release-v17374/LingJing-1.73.73-linux-x86_64.deb"
APP_DIR="/opt/\\xe7\\x81\\xb5\\xe5\\xa2\\x83"

rm -rf "$DEB_DIR" "$DEB_FILE"
mkdir -p "$DEB_DIR/DEBIAN" "$DEB_DIR$APP_DIR"

cd "$SRC"
tar cf - . | tar xf - -C "$DEB_DIR$APP_DIR"

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

mkdir -p "$DEB_DIR/usr/bin"
ln -sf "$APP_DIR/\\xe7\\x81\\xb5\\xe5\\xa2\\x83" "$DEB_DIR/usr/bin/lingjing" 2>/dev/null || true

dpkg-deb --build "$DEB_DIR" "$DEB_FILE" 2>&1
echo "SIZE: $(du -sh "$DEB_FILE" 2>/dev/null)"
rm -rf "$DEB_DIR"
echo "DONE"
'''

encoded = base64.b64encode(script.encode('utf-8')).decode('ascii')
cmd = f'echo {encoded} | base64 -d > /tmp/build-deb-v4.sh && chmod +x /tmp/build-deb-v4.sh'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
print('Script created:', r.returncode, flush=True)

LOG = ELEC + '/dpkg-deb-v3.log'
r = subprocess.run(['ssh', SERVER, f'nohup bash /tmp/build-deb-v4.sh > {LOG} 2>&1 & echo $!'], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'PID: {pid}', flush=True)
print(f'Check: cat {LOG}', flush=True)
