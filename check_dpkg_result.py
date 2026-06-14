# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

r = subprocess.run(['ssh', SERVER, 'cat ' + ELEC + '/dpkg-deb.log'], capture_output=True, timeout=15)
out = r.stdout.decode('utf-8', errors='replace')
print('Log:', out, flush=True)

# Check if deb exists
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.deb 2>&1'], capture_output=True, timeout=10)
print('Deb:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
