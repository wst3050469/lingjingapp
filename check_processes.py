# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Check all related processes
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "fpm|mksquashfs|node.*electron-builder" | grep -v grep | head -10'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
