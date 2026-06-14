# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Run fpm in background via a script on the build machine
fpm_script = f'''#!/bin/bash
cd {ELEC}
timeout 300 fpm -s dir -t deb \\
  -n lingjing-ide \\
  -v 1.73.73 \\
  --architecture amd64 \\
  --package {ELEC}/release-v17374/LingJing-1.73.73-linux-x86_64.deb \\
  --description "LingJing IDE" \\
  --maintainer "support@lingjing.ai" \\
  --deb-compression xz \\
  -C {ELEC}/release-v17374/linux-unpacked \\
  . > {ELEC}/fpm-deb.log 2>&1
echo "EXIT_CODE=$?"
'''

# Write script to build machine
import base64
encoded = base64.b64encode(fpm_script.encode('utf-8')).decode('ascii')
cmd = f'echo {encoded} | base64 -d > /tmp/build-deb.sh && chmod +x /tmp/build-deb.sh'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
print('Script created:', r.returncode, flush=True)

# Run script in background
r = subprocess.run(['ssh', SERVER, 'nohup /tmp/build-deb.sh > /dev/null 2>&1 & echo $!'], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'fpm PID: {pid}', flush=True)
print(f'Check: cat {ELEC}/fpm-deb.log', flush=True)
