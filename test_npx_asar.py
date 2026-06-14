# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Test npx @electron/asar with different approaches
tests = [
    'cd /home/liuhui/lingjing/desktop/electron; npx @electron/asar --version 2>&1',
    'cd /home/liuhui/lingjing/desktop/electron; PATH=/home/liuhui/.npm-global/bin:$PATH npx @electron/asar --version 2>&1',
    'npx --package @electron/asar asar --version 2>&1',
]

for cmd in tests:
    r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=60)
    out = r.stdout.decode('utf-8', errors='replace').strip()
    print(f'$ {cmd.split(";")[-1].strip()[:100]}') 
    print(' ', out[:300])
    print()
