# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check for deb file specifically
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.deb 2>&1'], capture_output=True, timeout=10)
print('Deb files:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Check node process
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "node.*cli.js" | grep -v grep | head -2'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('Node running:', out[:150], flush=True)
else:
    print('Node not running.', flush=True)

# Full log
r = subprocess.run(['ssh', SERVER, 'cat ' + ELEC + '/linux-build3.log'], capture_output=True, timeout=30)
print('\nFull log:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
