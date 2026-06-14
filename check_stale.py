# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Check what processes remain
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "fpm|dpkg-deb|electron-builder|tar.*staging|app-builder" | grep -v grep'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('Remaining processes:', flush=True)
for line in out.split('\n') if out else ['(none)']:
    print(' ', line[:150], flush=True)

# Try harder kill
if out:
    r = subprocess.run(['ssh', SERVER, 'kill -9 $(pgrep -f "fpm|dpkg|app-builder|tar.*staging") 2>/dev/null; echo done'], capture_output=True, timeout=10)
    print('Force killed.', flush=True)
