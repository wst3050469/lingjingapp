# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Check result
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "dpkg-deb|fpm|app-builder|tar.*staging" | grep -v grep | wc -l'], capture_output=True, timeout=10)
print('Remaining:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Check deb files
r = subprocess.run(['ssh', SERVER, 'ls -lh /home/liuhui/lingjing/desktop/electron/release-v17374/*.deb 2>&1 || echo NO DEB'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Clean up temp files
r = subprocess.run(['ssh', SERVER, 'rm -rf /tmp/deb-* /tmp/build-deb* /tmp/package-dir-staging-* /tmp/*.asar /tmp/asartest* /tmp/lingjing-* 2>/dev/null; echo DONE'], capture_output=True, timeout=10)
print('Temp cleaned:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
