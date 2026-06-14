# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'root@120.55.5.220'
REMOTE_DL = '/root/cloud-server/public/downloads/'

# Verify production server state
print('=== 生产服务器部署验证 ===', flush=True)
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + REMOTE_DL], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

r = subprocess.run(['ssh', SERVER, 'cat ' + REMOTE_DL + 'versions.json'], capture_output=True, timeout=10)
print('versions.json:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Check if update-server is running
r = subprocess.run(['ssh', SERVER, 'pm2 list 2>/dev/null | head -10'], capture_output=True, timeout=10)
print('PM2:', r.stdout.decode('utf-8', errors='replace'), flush=True)

# Check build machine deb status
BM = 'liuhui@192.168.1.9'
print('\n=== 构建机状态 ===', flush=True)
r = subprocess.run(['ssh', BM, 'ps aux | grep -E "fpm|dpkg-deb|electron-builder" | grep -v grep | wc -l'], capture_output=True, timeout=10)
remaining = r.stdout.decode('utf-8', errors='replace').strip()
print(f'剩余构建进程: {remaining}', flush=True)

r = subprocess.run(['ssh', BM, 'ls -lh /home/liuhui/lingjing/desktop/electron/release-v17374/*.deb 2>&1 || echo "NO DEB"'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Check current git status
print('\n=== Git 状态 ===', flush=True)
r = subprocess.run(['git', 'log', '--oneline', '-1'], cwd='D:/lingjing-ide', capture_output=True, timeout=10)
print('HEAD:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
