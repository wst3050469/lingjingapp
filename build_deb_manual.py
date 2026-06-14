# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Kill all stale build processes
print('Killing stale processes...', flush=True)
subprocess.run(['ssh', SERVER, 'pkill -f "fpm" 2>/dev/null; pkill -f "app-builder" 2>/dev/null; pkill -f "tar.*staging" 2>/dev/null; sleep 1'], capture_output=True, timeout=15)

# Check remaining
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "fpm|tar.*staging" | grep -v grep | wc -l'], capture_output=True, timeout=10)
print('Left:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Try building deb directly from the existing linux-unpacked
print('\nBuilding deb manually with fpm...', flush=True)
cmd = f'cd {ELEC} && fpm -s dir -t deb -n lingjing-ide -v 1.73.73 --architecture amd64 --url https://lingjing.ai --description "灵境 IDE" --maintainer "LingJing AI <support@lingjing.ai>" -d libgtk-3-0 -d libnotify4 -d libnss3 -d libxss1 -d libxtst6 -d xdg-utils -d libatspi2.0-0 -d libsecret-1-0 --deb-compression xz -C release-v17374/linux-unpacked . 2>&1'
LOG = ELEC + '/manual-deb.log'
cmd2 = f'nohup sh -c "{cmd}" > {LOG} 2>&1 & echo $!'
r = subprocess.run(['ssh', SERVER, cmd2], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'Manual deb build started PID: {pid}', flush=True)

print(f'\nManual deb build PID: {pid}', flush=True)
print(f'Check later with: cat {LOG}', flush=True)
