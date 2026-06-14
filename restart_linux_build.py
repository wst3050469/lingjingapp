# -*- coding: utf-8 -*-
import subprocess, sys, time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Kill all build-related processes
print('Killing all build processes...', flush=True)
cmds = [
    'pkill -f "electron-builder" 2>/dev/null',
    'pkill -f "fpm" 2>/dev/null',
    'pkill -f "mksquashfs" 2>/dev/null',
    'pkill -f "app-builder" 2>/dev/null',
    'sleep 2',
]
r = subprocess.run(['ssh', SERVER, '; '.join(cmds)], capture_output=True, timeout=20)
print('Killed.', flush=True)

# Verify nothing is running
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "fpm|mksquashfs|electron-builder" | grep -v grep | head -5'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
if out:
    print('Still running:', out[:200], flush=True)
    sys.exit(1)

# Clean old files
r = subprocess.run(['ssh', SERVER, 'rm -rf ' + ELEC + '/release-v17374/linux-unpacked ' + ELEC + '/release-v17374/__appImage-x64 2>/dev/null'], capture_output=True, timeout=10)
print('Cleaned old build artifacts.', flush=True)

# Install asar globally (to fix after-pack hook)
r = subprocess.run(['ssh', SERVER, 'npm install -g @electron/asar 2>&1 | tail -3'], capture_output=True, timeout=60)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('npm install -g asar:', out[:200], flush=True)

# Verify asar works
r = subprocess.run(['ssh', SERVER, 'asar --version 2>&1'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('asar version:', out[:100], flush=True)

# Start build fresh
LOG = ELEC + '/linux-build3.log'
cmd = f'nohup sh -c "cd {ELEC} && {ELEC}/node_modules/.bin/electron-builder --linux --x64 --publish never" > {LOG} 2>&1 & echo $!'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'New build started with PID: {pid}', flush=True)

# Verify running
time.sleep(2)
r = subprocess.run(['ssh', SERVER, f'ps -p {pid} >/dev/null 2>&1 && echo RUNNING || echo DONE'], capture_output=True, timeout=10)
print(f'Status: {r.stdout.decode("utf-8", errors="replace").strip()}', flush=True)
print(f'Log: {LOG}', flush=True)
