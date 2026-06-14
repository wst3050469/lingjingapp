# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

ELEC = '/home/liuhui/lingjing/desktop/electron'
BUILDER = ELEC + '/node_modules/.bin/electron-builder'

print('Starting Linux electron-builder (may take 20-30 min)...', flush=True)

# Run with no capture so we can see progress in the log
import datetime
start = datetime.datetime.now()
print(f'Start time: {start.isoformat()}', flush=True)

try:
    r = subprocess.run(
        ['ssh', 'liuhui@192.168.1.9', f'cd {ELEC}; {BUILDER} --linux --x64 --publish never 2>&1'],
        capture_output=True,
        timeout=3600
    )
    elapsed = (datetime.datetime.now() - start).total_seconds()
    print(f'Elapsed: {elapsed:.0f}s', flush=True)
    print(f'RC: {r.returncode}', flush=True)
    out = r.stdout.decode('utf-8', errors='replace')
    print('\n--- OUTPUT (last 1500 chars) ---')
    print(out[-1500:], flush=True)
    if r.stderr:
        print('\n--- STDERR ---')
        print(r.stderr.decode('utf-8', errors='replace')[:500], flush=True)
    
    # List output files
    if r.returncode == 0:
        print('\n--- OUTPUT FILES ---', flush=True)
        r2 = subprocess.run(
            ['ssh', 'liuhui@192.168.1.9', f'ls -lh {ELEC}/release-v17374/'],
            capture_output=True, timeout=10
        )
        print(r2.stdout.decode('utf-8', errors='replace'), flush=True)
except subprocess.TimeoutExpired:
    print('TIMEOUT after 3600s', flush=True)
except Exception as e:
    print(f'EXCEPTION: {repr(e)}', flush=True)

print('DONE', flush=True)
