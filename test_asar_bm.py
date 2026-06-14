# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Test npx @electron/asar directly on build machine
r = subprocess.run(['ssh', SERVER, f'cd {ELEC} && npx @electron/asar --version 2>&1'], capture_output=True, timeout=30)
print('npx --version:', r.stdout.decode('utf-8', errors='replace').strip()[:200], flush=True)

# Check what npx does with extract on a test file
r = subprocess.run(['ssh', SERVER, f'cd {ELEC} && ASAR_PATH="{ELEC}/release-v17374/linux-unpacked/resources/app.asar" && ls -la "$ASAR_PATH"'], capture_output=True, timeout=10)
print('ASAR exists:', r.stdout.decode('utf-8', errors='replace').strip()[:200], flush=True)

# Try a different syntax
r = subprocess.run(['ssh', SERVER, f'cd {ELEC} && npx @electron/asar list "{ELEC}/release-v17374/linux-unpacked/resources/app.asar" 2>&1 | head -20'], capture_output=True, timeout=60)
print('asar list:', r.stdout.decode('utf-8', errors='replace').strip()[:300], flush=True)
if r.returncode != 0:
    print('ERR:', r.stderr.decode('utf-8', errors='replace')[:200], flush=True)

# Check the @electron/asar package
r = subprocess.run(['ssh', SERVER, f'npm root -g && ls "$(npm root -g)/@electron/asar/" 2>/dev/null || echo NOT FOUND'], capture_output=True, timeout=10)
print('global asar:', r.stdout.decode('utf-8', errors='replace').strip()[:200], flush=True)
