# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Copy prompts directory
print('Copying prompts directory...', flush=True)
r = subprocess.run(['scp', '-r', 'D:/lingjing-ide/desktop/electron/prompts', f'{SERVER}:{ELEC}/prompts_tmp'], capture_output=True, timeout=30)
if r.returncode == 0:
    # Move to proper location
    subprocess.run(['ssh', SERVER, f'rm -rf {ELEC}/prompts && mv {ELEC}/prompts_tmp {ELEC}/prompts'], capture_output=True, timeout=10)
    print('Prompts copied ✅', flush=True)
else:
    print('SCP failed:', r.stderr.decode('utf-8', errors='replace')[:200], flush=True)

# Start build in background
LOG = ELEC + '/linux-build2.log'
cmd = f'nohup sh -c "cd {ELEC} && {ELEC}/node_modules/.bin/electron-builder --linux --x64 --publish never" > {LOG} 2>&1 & echo $!'
r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=10)
pid = r.stdout.decode('utf-8', errors='replace').strip()
print(f'Build started with PID: {pid}', flush=True)

# Quick check
import time
time.sleep(3)
r = subprocess.run(['ssh', SERVER, f'ps -p {pid} >/dev/null 2>&1 && echo RUNNING || echo DONE'], capture_output=True, timeout=10)
print(f'Status: {r.stdout.decode("utf-8", errors="replace").strip()}', flush=True)

print(f'\nLog: {LOG}', flush=True)
print('Wait a few minutes then check with: tail -30 /home/liuhui/lingjing/desktop/electron/linux-build2.log', flush=True)
