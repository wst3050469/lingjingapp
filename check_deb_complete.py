# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check if build script process still running
r = subprocess.run(['ssh', '-oConnectTimeout=5', SERVER, 'ps aux | grep "build-deb-ar" | grep -v grep | head -2'], capture_output=True, timeout=15)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('Build script running:', bool(out), flush=True)

# Check if the log is readable now
r = subprocess.run(['ssh', '-oConnectTimeout=5', SERVER, 'tail -5 ' + ELEC + '/deb-ar.log 2>/dev/null'], capture_output=True, timeout=15)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('Log:', out[:200] if out else '(empty)', flush=True)

# Check deb
r = subprocess.run(['ssh', '-oConnectTimeout=5', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.deb 2>&1'], capture_output=True, timeout=15)
print('Deb:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
