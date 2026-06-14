# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

ELEC = '/home/liuhui/lingjing/desktop/electron'
BUILDER = ELEC + '/node_modules/.bin/electron-builder'
LOG = '/home/liuhui/lingjing/desktop/electron/linux-build.log'
PIDFILE = '/tmp/linux-build.pid'
SERVER = 'liuhui@192.168.1.9'

# Kill any existing build
subprocess.run(['ssh', SERVER, 'pkill -f electron-builder 2>/dev/null; sleep 1'], capture_output=True, timeout=10)

# Start build in background using nohup
cmd = f'nohup sh -c "cd {ELEC} && {BUILDER} --linux --x64 --publish never" > {LOG} 2>&1 & echo $!'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'Build started with PID: {pid}', flush=True)

# Save PID
subprocess.run(['ssh', SERVER, f'echo {pid} > {PIDFILE}'], capture_output=True, timeout=5)

# Initial check
r = subprocess.run(['ssh', SERVER, f'ps -p {pid} >/dev/null 2>&1 && echo RUNNING || echo DONE'], capture_output=True, timeout=10)
print(f'Status: {r.stdout.decode("utf-8", errors="replace").strip()}', flush=True)

print(f'\nLog file: {LOG}', flush=True)
print('Check status later with: ssh liuhui@192.168.1.9 "tail -30 /home/liuhui/lingjing/desktop/electron/linux-build.log"', flush=True)
