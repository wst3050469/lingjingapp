# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check processes - use timeout 5 for each
r = subprocess.run(['ssh', '-oConnectTimeout=5', SERVER, 'ps aux | grep -E "tar|ar" | grep -v grep | wc -l'], capture_output=True, timeout=15)
print('tar/ar processes:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Check deb file existence
r = subprocess.run(['ssh', '-oConnectTimeout=5', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.deb 2>&1 || echo NOT_FOUND'], capture_output=True, timeout=15)
print('Deb:', r.stdout.decode('utf-8', errors='replace').strip()[:200], flush=True)
