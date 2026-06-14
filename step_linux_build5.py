# -*- coding: utf-8 -*-
import subprocess, sys, datetime

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

ELEC = '/home/liuhui/lingjing/desktop/electron'
BUILDER = ELEC + '/node_modules/.bin/electron-builder'
LOG = '/home/liuhui/lingjing/desktop/electron/linux-build.log'

print('Starting Linux build in background...', flush=True)
print('(logs written to', LOG, 'on build machine)', flush=True)
start = datetime.datetime.now()

# Run build and write to log, capture exit code
cmd = 'cd ' + ELEC + '; ' + BUILDER + ' --linux --x64 --publish never > ' + LOG + ' 2>&1; echo EXIT_CODE=$?'

# First check if electron-builder exists
r = subprocess.run(['ssh', 'liuhui@192.168.1.9', 'ls -la ' + BUILDER], capture_output=True, timeout=10)
print('Builder exists:', r.returncode == 0, flush=True)

# Run the build
r = subprocess.run(['ssh', 'liuhui@192.168.1.9', cmd], capture_output=True, timeout=3600)
elapsed = (datetime.datetime.now() - start).total_seconds()
print(f'Completed in {elapsed:.0f}s', flush=True)
print(f'RC: {r.returncode}', flush=True)
out = r.stdout.decode('utf-8', errors='replace')
print(f'Output: {out.strip()}', flush=True)
if r.stderr:
    print(f'Stderr: {r.stderr.decode("utf-8", errors="replace")[:300]}', flush=True)

# Read the log
r2 = subprocess.run(['ssh', 'liuhui@192.168.1.9', 'tail -30 ' + LOG], capture_output=True, timeout=30)
print('\n--- Build log ---')
print(r2.stdout.decode('utf-8', errors='replace'), flush=True)

if 'EXIT_CODE=0' in out:
    print('\n✅ SUCCESS!', flush=True)
    r3 = subprocess.run(['ssh', 'liuhui@192.168.1.9', 'ls -lh ' + ELEC + '/release-v17374/'], capture_output=True, timeout=10)
    print(r3.stdout.decode('utf-8', errors='replace'), flush=True)
else:
    print('\n❌ FAILED', flush=True)
