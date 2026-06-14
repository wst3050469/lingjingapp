# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Kill all build processes
print('Killing processes...', flush=True)
subprocess.run(['ssh', SERVER, 'pkill -f "electron-builder"; pkill -f "fpm"; pkill -f "mksquashfs"; pkill -f "app-builder"; echo done'], capture_output=True, timeout=20)
print('Killed old processes', flush=True)

# Verify nothing running
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "fpm|mksquashfs|electron-builder" | grep -v grep | wc -l'], capture_output=True, timeout=10)
left = r.stdout.decode('utf-8', errors='replace').strip()
print(f'Remaining processes: {left}', flush=True)

# Clean artifacts  
subprocess.run(['ssh', SERVER, 'rm -rf ' + ELEC + '/release-v17374/linux-unpacked ' + ELEC + '/release-v17374/__appImage-x64'], capture_output=True, timeout=10)
print('Cleaned old artifacts', flush=True)

# Start build
LOG = ELEC + '/linux-build3.log'
cmd = f'nohup sh -c "cd {ELEC} && {ELEC}/node_modules/.bin/electron-builder --linux --x64 --publish never" > {LOG} 2>&1 & echo $!'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'Build started PID: {pid}', flush=True)
print(f'Log: {LOG}', flush=True)
