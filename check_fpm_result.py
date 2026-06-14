# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check fpm status
r = subprocess.run(['ssh', SERVER, 'ps aux | grep fpm | grep -v grep | head -3'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('fpm running:', flush=True)
    for line in out.split('\n'):
        print(' ', line[:150], flush=True)
else:
    print('fpm NOT running', flush=True)

# Check log
r = subprocess.run(['ssh', SERVER, 'cat ' + ELEC + '/fpm-deb.log 2>/dev/null'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('\nLog:', flush=True)
print(out[:500] if out else '  (empty)', flush=True)

# Check deb file
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.deb ' + ELEC + '/*.deb 2>&1'], capture_output=True, timeout=10)
print('\nDeb:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
