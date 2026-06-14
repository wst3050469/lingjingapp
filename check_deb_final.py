# -*- coding: utf-8 -*-
import subprocess, sys, time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

print('Checking deb build status...', flush=True)
r = subprocess.run(['ssh', SERVER, 'cat ' + ELEC + '/deb-final.log'], capture_output=True, timeout=15)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.deb 2>&1'], capture_output=True, timeout=10)
print('Deb:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
