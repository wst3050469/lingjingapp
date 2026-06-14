# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Kill all stale build processes
print('Killing stale build processes...', flush=True)
r = subprocess.run(['ssh', SERVER, 'pkill -9 -f "fpm" 2>/dev/null; pkill -9 -f "dpkg-deb" 2>/dev/null; pkill -9 -f "timeout" 2>/dev/null; pkill -9 -f "app-builder" 2>/dev/null; pkill -9 -f "tar.*staging" 2>/dev/null; sleep 1'], capture_output=True, timeout=20)
print('Done.', flush=True)

# Check remaining
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "fpm|dpkg-deb|electron-builder" | grep -v grep | wc -l'], capture_output=True, timeout=10)
remaining = r.stdout.decode('utf-8', errors='replace').strip()
print(f'Remaining processes: {remaining}', flush=True)

# Remove the invalid deb
r = subprocess.run(['ssh', SERVER, 'rm -f ' + ELEC + '/release-v17374/*.deb ' + ELEC + '/*.deb 2>/dev/null; rm -rf /tmp/deb-build-* /tmp/*.asar /tmp/asartest* /tmp/lingjing-* 2>/dev/null'], capture_output=True, timeout=10)
print('Cleaned temp files.', flush=True)

# Sync the fixed after-pack hook to the build machine's git working tree
print('\nSyncing after-pack-hook fix...', flush=True)
r = subprocess.run(['scp', 'D:/lingjing-ide/desktop/electron/scripts/after-pack-hook.cjs', f'{SERVER}:{ELEC}/scripts/after-pack-hook.cjs'], capture_output=True, timeout=10)
print('Hook synced:', 'OK' if r.returncode == 0 else 'FAIL', flush=True)

print('\n✅ 清理完成', flush=True)
