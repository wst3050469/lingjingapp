# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Clean temp files
subprocess.run(['ssh', SERVER, 'rm -rf /tmp/lingjing-* /tmp/deb-* /tmp/build-deb* /tmp/test-cn /tmp/asartest* 2>/dev/null'], capture_output=True, timeout=15)
print('Temp cleaned', flush=True)

# Check remaining processes
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "tar|ar" | grep -v grep | wc -l'], capture_output=True, timeout=15)
print('Remaining tar/ar:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
