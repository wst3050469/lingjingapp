# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Get full log
r = subprocess.run(['ssh', SERVER, 'wc -l /home/liuhui/lingjing/desktop/electron/linux-build.log'], capture_output=True, timeout=10)
print('Log lines:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

r = subprocess.run(['ssh', SERVER, 'cat /home/liuhui/lingjing/desktop/electron/linux-build.log'], capture_output=True, timeout=30)
out = r.stdout.decode('utf-8', errors='replace')
print('FULL LOG:')
print(out, flush=True)
