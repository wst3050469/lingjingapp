# -*- coding: utf-8 -*-
import subprocess, sys, json

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

PROD = 'root@120.55.5.220'
BM = 'liuhui@192.168.1.9'

# 1. Production server - check files
print('=== 生产服务器 ===', flush=True)
r = subprocess.run(['ssh', PROD, 'ls -lh /root/cloud-server/public/downloads/'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# 2. Check versions.json
r = subprocess.run(['ssh', PROD, 'cat /root/cloud-server/public/downloads/versions.json'], capture_output=True, timeout=10)
v = json.loads(r.stdout.decode('utf-8', errors='replace'))
print(f'latest: {v.get("latest")}', flush=True)
print(f'versions count: {len(v.get("versions",[]))}', flush=True)
for ver in v.get('versions', []):
    platforms = list(ver.get('files', {}).keys())
    print(f'  v{ver["version"]}: platforms={platforms}', flush=True)

# 3. Check update endpoints
print('\n=== 更新端点 ===', flush=True)
for port in ['3002', '8000']:
    r = subprocess.run(['ssh', PROD, f'curl -s http://localhost:{port}/api/latest 2>/dev/null || echo FAIL'], capture_output=True, timeout=10)
    out = r.stdout.decode('utf-8', errors='replace').strip()[:200]
    print(f'  :{port} -> {out}', flush=True)

# 4. Check PM2 services
r = subprocess.run(['ssh', PROD, 'pm2 list 2>/dev/null | grep -E "online|errored"'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('\nPM2:', out[:300] if out else '(check manually)', flush=True)

# 5. Check if build machine is clean
print('\n=== 构建机 ===', flush=True)
r = subprocess.run(['ssh', BM, 'ps aux | grep -cE "fpm|dpkg|electron-builder"'], capture_output=True, timeout=10)
print(f'Build processes: {r.stdout.decode("utf-8", errors="replace").strip()}', flush=True)

# 6. Check git status
print('\n=== Git ===', flush=True)
r = subprocess.run(['git', 'log', '--oneline', '-3'], cwd='D:/lingjing-ide', capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

print('\n✅ 全面检查完成', flush=True)
