# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Kill all old processes first
subprocess.run(['ssh', SERVER, 'pkill -9 -f "fpm" 2>/dev/null; pkill -9 -f "node.*cli" 2>/dev/null; pkill -9 -f "app-builder" 2>/dev/null; sleep 1'], capture_output=True, timeout=15)
print('Killed everything', flush=True)

# Run fpm in background with proper timeout
LOG = ELEC + '/fpm-deb.log'
cmd = f'timeout 300 fpm -s dir -t deb -n lingjing-ide -v 1.73.73 --architecture amd64 --package {ELEC}/release-v17374/LingJing-1.73.73-linux-x86_64.deb --description "LingJing IDE" --maintainer "support@lingjing.ai" --deb-compression xz -C {ELEC}/release-v17374/linux-unpacked . > {LOG} 2>&1; echo EXIT=$?'
r = subprocess.run(['ssh', SERVER, f'nohup sh -c "{cmd}" > /dev/null 2>&1 & echo $!'], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'fpm started PID={pid}', flush=True)
print(f'Check: cat {LOG}', flush=True)
