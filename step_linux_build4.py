# -*- coding: utf-8 -*-
import subprocess, sys, datetime

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

ELEC = '/home/liuhui/lingjing/desktop/electron'
BUILDER = ELEC + '/node_modules/.bin/electron-builder'
LOG = '/home/liuhui/lingjing/desktop/electron/linux-build.log'

# Run build on build machine, writing output to a log file
cmd = f'cd {ELEC}; {BUILDER} --linux --x64 --publish never > {LOG} 2>&1; echo EXIT_CODE=$?'

print('Starting Linux build in background...', flush=True)
start = datetime.datetime.now()
print(f'Start: {start.isoformat()}', flush=True)

r = subprocess.run(
    ['ssh', 'liuhui@192.168.1.9', cmd],
    capture_output=True, timeout=3600
)

# Check the exit code from the log
rc_out = r.stdout.decode('utf-8', errors='replace')
elapsed = (datetime.datetime.now() - start).total_seconds()
print(f'Elapsed: {elapsed:.0f}s', flush=True)
print(f'SSH RC: {r.returncode}', flush=True)
print(f'Output: {rc_out.strip()}', flush=True)

# Read the log file
r2 = subprocess.run(
    ['ssh', 'liuhui@192.168.1.9', f'tail -100 {LOG}'],
    capture_output=True, timeout=30
)
out = r2.stdout.decode('utf-8', errors='replace')
print('\n--- Build Log (last 100 lines) ---')
print(out, flush=True)

# Check if EXIT_CODE=0
if 'EXIT_CODE=0' in rc_out:
    print('\n✅ BUILD SUCCESSFUL!', flush=True)
    # List output files
    r3 = subprocess.run(['ssh', 'liuhui@192.168.1.9', f'ls -lh {ELEC}/release-v17374/'], capture_output=True, timeout=10)
    print(r3.stdout.decode('utf-8', errors='replace'), flush=True)
else:
    exit_code = rc_out.strip().split('EXIT_CODE=')[-1] if 'EXIT_CODE=' in rc_out else 'unknown'
    print(f'\n❌ BUILD FAILED (exit code: {exit_code})', flush=True)

print('DONE', flush=True)
