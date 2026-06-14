# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check all build processes
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "electron-builder|fpm|mksquashfs|app-builder" | grep -v grep | head -5'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('Build processes:', flush=True)
    for line in out.split('\n'):
        print(' ', line[:150], flush=True)
else:
    print('No build processes running - BUILD COMPLETED', flush=True)

# Check release files
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/'], capture_output=True, timeout=10)
print('\nRelease files:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Show last log
r = subprocess.run(['ssh', SERVER, 'tail -5 ' + ELEC + '/linux-build3.log'], capture_output=True, timeout=10)
print('Last log lines:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
