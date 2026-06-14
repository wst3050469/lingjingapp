# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check if process is still running
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "electron-builder" | grep -v grep | head -3'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace')
print('Process status:', flush=True)
print(out[:300] if out.strip() else '  (not running - build completed)', flush=True)

# Check output files
r = subprocess.run(['ssh', SERVER, f'ls -lh {ELEC}/release-v17374/ 2>&1'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace')
print('\nOutput files:', flush=True)
print(out, flush=True)

# Check full log
r = subprocess.run(['ssh', SERVER, f'tail -10 {ELEC}/linux-build.log'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace')
print('\nLast 10 log lines:', flush=True)
print(out, flush=True)
