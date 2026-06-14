# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Check all active deb-related processes
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "fpm|tar.*deb|app-builder" | grep -v grep | head -10'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('Deb-related processes:', flush=True)
if out:
    for line in out.split('\n'):
        print(' ', line[:150], flush=True)
else:
    print('  (none)', flush=True)

# Check what the node process is doing
r = subprocess.run(['ssh', SERVER, 'ls -la /proc/3179956/fd/ 2>/dev/null | head -20'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('\nNode process FDs:', flush=True)
print(out[:500] if out else '  (cannot access)', flush=True)
