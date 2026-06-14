# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check if asar command works
r = subprocess.run(['ssh', SERVER, 'which asar && asar --version 2>&1'], capture_output=True, timeout=10)
print('asar:', r.stdout.decode('utf-8', errors='replace').strip()[:200], flush=True)

# Check npx behavior
r = subprocess.run(['ssh', SERVER, 'npx @electron/asar --version 2>&1 | head -3'], capture_output=True, timeout=30)
print('npx asar:', r.stdout.decode('utf-8', errors='replace').strip()[:200], flush=True)

# Check if asar extract works on a small test
# First create a small asar
r = subprocess.run(['ssh', SERVER, 'mkdir -p /tmp/asartest && echo test > /tmp/asartest/test.txt && asar pack /tmp/asartest /tmp/test.asar && asar extract /tmp/test.asar /tmp/asartest2 && cat /tmp/asartest2/test.txt'], capture_output=True, timeout=30)
print('asar test:', r.stdout.decode('utf-8', errors='replace').strip()[:300], flush=True)
if r.returncode != 0:
    print('ERR:', r.stderr.decode('utf-8', errors='replace')[:200], flush=True)

# Check if the asar extract process is still running
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "asar" | grep -v grep | head -5'], capture_output=True, timeout=10)
print('\nasar processes:', r.stdout.decode('utf-8', errors='replace').strip()[:500], flush=True)
