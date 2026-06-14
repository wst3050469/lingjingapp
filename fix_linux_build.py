# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Kill existing build
print('Killing old build...', flush=True)
subprocess.run(['ssh', SERVER, 'kill 3127532 2>/dev/null; sleep 1'], capture_output=True, timeout=10)

# Fix 1: Install @electron/asar
print('Installing @electron/asar...', flush=True)
r = subprocess.run(['ssh', SERVER, 'cd ' + ELEC + ' && npm install --save-dev @electron/asar 2>&1 | tail -3'], capture_output=True, timeout=120)
print(r.stdout.decode('utf-8', errors='replace')[:200], flush=True)

# Verify asar installed
r = subprocess.run(['ssh', SERVER, 'npx @electron/asar --version 2>&1'], capture_output=True, timeout=30)
print('asar version:', r.stdout.decode('utf-8', errors='replace').strip()[:100], flush=True)

# Fix 2: Create prompts directory
print('Creating prompts directory...', flush=True)
r = subprocess.run(['ssh', SERVER, 'mkdir -p ' + ELEC + '/prompts'], capture_output=True, timeout=10)
print('Created prompts dir:', r.returncode, flush=True)

# Fix 3: Check if mksquashfs is available for AppImage
print('Checking build tools...', flush=True)
r = subprocess.run(['ssh', SERVER, 'which mksquashfs; which fpm; which rpm'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Check fpm
r = subprocess.run(['ssh', SERVER, 'which fpm 2>/dev/null || gem list fpm 2>/dev/null | head -3 || echo "FPM not found"'], capture_output=True, timeout=15)
print('FPM:', r.stdout.decode('utf-8', errors='replace').strip()[:300], flush=True)

print('\nFixes applied. Ready to retry build.', flush=True)
