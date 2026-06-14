# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

r = subprocess.run(['ssh', SERVER, 'cat ' + ELEC + '/linux-build3.log'], capture_output=True, timeout=30)
out = r.stdout.decode('utf-8', errors='replace')
print(out, flush=True)
