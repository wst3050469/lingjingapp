# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Check process status
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "electron-builder" | grep -v grep | head -3'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('Process:', flush=True)
if out:
    for line in out.split('\n'):
        print(' ', line[:120], flush=True)
else:
    print('  (not running)', flush=True)

# Check log
r = subprocess.run(['ssh', SERVER, 'tail -30 /home/liuhui/lingjing/desktop/electron/linux-build2.log'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace')
print('\nLog output:', flush=True)
print(out, flush=True)

# Check release directory
r = subprocess.run(['ssh', SERVER, 'ls -lh /home/liuhui/lingjing/desktop/electron/release-v17374/ 2>&1'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace')
print('\nRelease dir:', flush=True)
print(out, flush=True)
