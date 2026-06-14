# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check source
r = subprocess.run(['ssh', SERVER, f'ls -la {ELEC}/release-v17374/linux-unpacked/ | head -5'], capture_output=True, timeout=10)
print('Source:', r.stdout.decode('utf-8', errors='replace'), flush=True)

# Check if temp dir was created  
r = subprocess.run(['ssh', SERVER, 'ls -la /tmp/lingjing-deb-build/opt/灵境/ 2>&1 | head -5'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace')
print('Temp target:', out[:300], flush=True)

# Try a simple copy test
r = subprocess.run(['ssh', SERVER, 'mkdir -p /tmp/test-cn/灵境 && cp ' + ELEC + '/release-v17374/linux-unpacked/lingjing /tmp/test-cn/灵境/ 2>&1 || echo CP_FAILED'], capture_output=True, timeout=15)
out = r.stdout.decode('utf-8', errors='replace')
print('Copy test:', out[:200], flush=True)

# Check if linux-unpacked/lingjing exists
r = subprocess.run(['ssh', SERVER, 'ls -la ' + ELEC + '/release-v17374/linux-unpacked/lingjing 2>&1'], capture_output=True, timeout=10)
print('lingjing binary:', r.stdout.decode('utf-8', errors='replace').strip()[:200], flush=True)
