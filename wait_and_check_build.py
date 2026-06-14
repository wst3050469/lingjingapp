# -*- coding: utf-8 -*-
import subprocess, sys, time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Wait and check repeatedly
for i in range(10):
    r = subprocess.run(['ssh', SERVER, 'ps aux | grep "electron-builder" | grep -v grep | head -1'], capture_output=True, timeout=10)
    running = r.stdout.decode('utf-8', errors='replace').strip()
    
    if not running:
        print(f'Check {i+1}: Build completed!', flush=True)
        break
    
    # Show process age and latest log
    r2 = subprocess.run(['ssh', SERVER, 'tail -5 ' + ELEC + '/linux-build2.log'], capture_output=True, timeout=10)
    log = r2.stdout.decode('utf-8', errors='replace').strip()
    
    # Show release dir
    r3 = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/*.AppImage ' + ELEC + '/release-v17374/*.deb 2>&1'], capture_output=True, timeout=10)
    files = r3.stdout.decode('utf-8', errors='replace').strip()
    
    print(f'Check {i+1}/10 - Running: {running[:80] if running else "NO"}', flush=True)
    if log:
        print(f'  Log: {log.split(chr(10))[-1][:120]}', flush=True)
    if files:
        for line in files.split('\n'):
            print(f'  {line}', flush=True)
    
    if i < 9:
        time.sleep(30)

print('\nFinal result:', flush=True)

# Check output
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Check final log
r = subprocess.run(['ssh', SERVER, 'tail -10 ' + ELEC + '/linux-build2.log'], capture_output=True, timeout=10)
print('Last log lines:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
