# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Quick check
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "electron-builder" | grep -v grep | head -1'], capture_output=True, timeout=10)
running = r.stdout.decode('utf-8', errors='replace').strip()
print('Running:', running[:100] if running else 'NO', flush=True)

r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/ 2>&1'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

r = subprocess.run(['ssh', SERVER, 'tail -3 ' + ELEC + '/linux-build2.log'], capture_output=True, timeout=10)
print('Log:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
