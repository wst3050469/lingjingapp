# -*- coding: utf-8 -*-
import subprocess, sys, datetime

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

ELEC = '/home/liuhui/lingjing/desktop/electron'
BUILDER = ELEC + '/node_modules/.bin/electron-builder'

print('Starting Linux build (no timeout)...', flush=True)
start = datetime.datetime.now()
print(f'Start: {start.isoformat()}', flush=True)

# Use Popen to see output in real time
p = subprocess.Popen(
    ['ssh', 'liuhui@192.168.1.9', f'cd {ELEC}; {BUILDER} --linux --x64 --publish never 2>&1'],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Read output with a timeout
import select
import os

output = []
while True:
    # Check if process is still running
    ret = p.poll()
    
    # Read any available output
    try:
        # Use select on Unix-like, but on Windows we read with timeout
        import time
        time.sleep(2)
        # Check if there's data to read
        if p.stdout:
            import msvcrt
            # Windows: use msvcrt to check if data available
            # Actually, we can't easily do non-blocking reads on Windows pipes
            pass
    except:
        pass
    
    elapsed = (datetime.datetime.now() - start).total_seconds()
    if elapsed > 60:
        # Print status every 60s
        print(f'  ... still running ({elapsed:.0f}s elapsed)', flush=True)
    
    if ret is not None:
        break
    
    if elapsed > 3600:
        print('TIMEOUT - killing process', flush=True)
        p.kill()
        break

stdout_data = p.stdout.read() if p.stdout else b''
stderr_data = p.stderr.read() if p.stderr else b''
out = stdout_data.decode('utf-8', errors='replace')
err = stderr_data.decode('utf-8', errors='replace')

elapsed = (datetime.datetime.now() - start).total_seconds()
print(f'\nCompleted in {elapsed:.0f}s, RC: {p.returncode}', flush=True)
print('\n--- OUTPUT ---')
print(out[-2000:], flush=True)
if err:
    print('\n--- STDERR ---')
    print(err[:500], flush=True)

# List output files
if p.returncode == 0:
    print('\n--- OUTPUT FILES ---', flush=True)
    r = subprocess.run(['ssh', 'liuhui@192.168.1.9', f'ls -lh {ELEC}/release-v17374/'], capture_output=True, timeout=10)
    print(r.stdout.decode('utf-8', errors='replace'), flush=True)

print('DONE', flush=True)
