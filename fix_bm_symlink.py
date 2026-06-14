# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC_NM_CORE = '/home/liuhui/lingjing/desktop/electron/node_modules/@codepilot/core'
SOURCE_CORE = '/home/liuhui/lingjing/desktop/core'

# Fix symlink: remove symlink and replace with real file copy
print('Fixing @codepilot/core symlink...', flush=True)

# Remove symlink
r = subprocess.run(['ssh', SERVER, f'rm -f {ELEC_NM_CORE}'], capture_output=True, timeout=10)
print('  rm symlink:', r.returncode, flush=True)

# Copy real files (following symlinks with -rL)
r = subprocess.run(
    ['ssh', SERVER, f'cp -rL {SOURCE_CORE} {ELEC_NM_CORE}'],
    capture_output=True, timeout=30
)
print('  cp real files:', r.returncode, flush=True)
if r.stderr:
    print('  ERR:', r.stderr.decode('utf-8', errors='replace')[:300], flush=True)

# Verify
r = subprocess.run(
    ['ssh', SERVER, f'ls -la {ELEC_NM_CORE} && file {ELEC_NM_CORE}'],
    capture_output=True, timeout=10
)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Also verify dist/agent-mode exists
r = subprocess.run(
    ['ssh', SERVER, f'ls {ELEC_NM_CORE}/dist/agent-mode/'],
    capture_output=True, timeout=10
)
print('agent-mode:', r.stdout.decode('utf-8', errors='replace')[:200], flush=True)

print('Ready to retry Linux build!', flush=True)
