# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    try:
        sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
    except:
        pass

r = subprocess.run(['ssh', 'liuhui@192.168.1.9', 'tail -20 /home/liuhui/lingjing/desktop/electron/linux-build.log'], capture_output=True, timeout=15)
out = r.stdout.decode('utf-8', errors='replace')
print(out, flush=True)
