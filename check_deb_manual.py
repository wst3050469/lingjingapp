# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check deb result
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/*.deb ' + ELEC + '/release-v17374/*.deb 2>&1'], capture_output=True, timeout=10)
print('Deb files:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Check log
r = subprocess.run(['ssh', SERVER, 'cat ' + ELEC + '/manual-deb.log 2>/dev/null'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('Manual deb log:', out[:500], flush=True)
else:
    print('Manual deb log empty or not found', flush=True)

# Check if fpm is still running
r = subprocess.run(['ssh', SERVER, 'ps aux | grep fpm | grep -v grep | head -3'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('\nfpm still running:', flush=True)
    for line in out.split('\n'):
        print(' ', line[:150], flush=True)
else:
    print('\nNo fpm running', flush=True)

# Check node process
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "node.*cli" | grep -v grep | head -2'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('Node running:', out[:150], flush=True)
else:
    print('Node not running', flush=True)
