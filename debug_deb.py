# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'
SRC = ELEC + '/release-v17374/linux-unpacked'

# Check the source directory
r = subprocess.run(['ssh', SERVER, 'ls ' + SRC + ' 2>&1 | head -10'], capture_output=True, timeout=10)
print('Source contents:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Check if the copy had issues
r = subprocess.run(['ssh', SERVER, 'ls -la ' + ELEC + '/release-v17374/deb-build/opt/灵境/ 2>&1 | head -10'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('\nCopied target:', out, flush=True)

# Check deb content
r = subprocess.run(['ssh', SERVER, 'dpkg-deb --contents ' + ELEC + '/release-v17374/LingJing-1.73.73-linux-x86_64.deb 2>&1 | head -20'], capture_output=True, timeout=30)
print('\nDeb contents:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
