# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Run fpm directly and capture output
cmd = f'cd {ELEC} && fpm -s dir -t deb -n lingjing-ide -v 1.73.73 --architecture amd64 --description "LingJing IDE" --maintainer "support@lingjing.ai" --deb-compression xz -C release-v17374/linux-unpacked . 2>&1'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=120)
out = r.stdout.decode('utf-8', errors='replace')
err = r.stderr.decode('utf-8', errors='replace')
print('RC:', r.returncode, flush=True)
print('OUT:', out[:1000], flush=True)
if err:
    print('ERR:', err[:500], flush=True)
