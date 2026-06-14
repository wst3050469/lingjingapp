# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Test npx in different shells
tests = [
    'which npx 2>&1; echo ---',
    'sh -c "which npx" 2>&1; echo ---',
    'npx --version 2>&1; echo ---',
    'sh -c "npx --version" 2>&1; echo ---',
]

for cmd in tests:
    r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
    out = r.stdout.decode('utf-8', errors='replace').strip()
    print(f'$ {cmd}')
    print(' ', out[:200])
    print()
