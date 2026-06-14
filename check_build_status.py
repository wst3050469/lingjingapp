# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Check if still running
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "electron-builder" | grep -v grep'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('STILL RUNNING:', out[:200], flush=True)
else:
    print('BUILD COMPLETED', flush=True)
    
# Check output files
r = subprocess.run(['ssh', SERVER, 'ls -lh /home/liuhui/lingjing/desktop/electron/release-v17374/'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
