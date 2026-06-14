# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Quick check
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "tar\|ar" | grep -v grep | grep -v "ps aux" | head -3'], capture_output=True, timeout=10)
running = r.stdout.decode('utf-8', errors='replace').strip()
print('Running:', bool(running), flush=True)

r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.deb 2>&1'], capture_output=True, timeout=10)
print('Deb:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

r = subprocess.run(['ssh', SERVER, 'cat ' + ELEC + '/deb-ar.log 2>/dev/null'], capture_output=True, timeout=10)
print('Log:', r.stdout.decode('utf-8', errors='replace').strip()[:200], flush=True)
