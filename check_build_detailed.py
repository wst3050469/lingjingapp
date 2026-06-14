# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check if mksquashfs is still running
r = subprocess.run(['ssh', SERVER, 'ps aux | grep mksquashfs | grep -v grep | head -2'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('AppImage building...', flush=True)
    for line in out.split('\n'):
        print(' ', line[:120], flush=True)
else:
    print('AppImage complete, checking next step...', flush=True)

# Show release files
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/'], capture_output=True, timeout=10)
print('\nRelease files:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Full log
r = subprocess.run(['ssh', SERVER, 'cat ' + ELEC + '/linux-build3.log 2>/dev/null'], capture_output=True, timeout=30)
print('Build log:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
