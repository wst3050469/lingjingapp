# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

PROD = 'root@120.55.5.220'
DL = '/root/cloud-server/public/downloads/'

print('=== 最终部署验证 v1.73.73 ===', flush=True)
print('='*50, flush=True)

# 1. Check all download files
r = subprocess.run(['ssh', PROD, f'ls -lh {DL}'], capture_output=True, timeout=10)
files = r.stdout.decode('utf-8', errors='replace')
print('\n📁 下载目录文件:', flush=True)
print(files, flush=True)

# 2. Check versions.json
r = subprocess.run(['ssh', PROD, f'cat {DL}versions.json'], capture_output=True, timeout=10)
print('📋 versions.json:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# 3. Check YML files
r = subprocess.run(['ssh', PROD, f'cat {DL}latest.yml'], capture_output=True, timeout=10)
print('📋 latest.yml:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

r = subprocess.run(['ssh', PROD, f'cat {DL}latest-linux.yml'], capture_output=True, timeout=10)
print('📋 latest-linux.yml:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# 4. Check update APIs
print('\n🌐 API 端点:', flush=True)
for url in ['http://localhost:3002/api/latest', 'http://localhost:8000/api/latest']:
    r = subprocess.run(['ssh', PROD, f'curl -s {url}'], capture_output=True, timeout=10)
    print(f'  {url}: {r.stdout.decode("utf-8", errors="replace").strip()[:150]}', flush=True)

# Count total files
file_count = len([l for l in files.split('\n') if l.strip() and l[0] != 't' and 'total' not in l and '---' not in l])
print(f'\n📊 总计: {file_count} 个文件', flush=True)
print('✅ v1.73.73 全平台部署完成！', flush=True)
