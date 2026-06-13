import subprocess, os, json, urllib.request

print("=" * 50)
print("  生产环境全面巡检")
print("=" * 50)

# 1. 磁盘空间
print("\n--- 磁盘 ---")
r = subprocess.run(['df', '-h', '/'], capture_output=True, text=True)
for line in r.stdout.split('\n'):
    if 'Filesystem' in line or '/dev/' in line:
        print(f'  {line}')

# 2. 内存
print("\n--- 内存 ---")
r = subprocess.run(['free', '-h'], capture_output=True, text=True)
for line in r.stdout.split('\n')[:3]:
    print(f'  {line}')

# 3. Nginx 状态
print("\n--- Nginx ---")
r = subprocess.run(['systemctl', 'is-active', 'nginx'], capture_output=True, text=True)
print(f'  nginx: {r.stdout.strip()}')

# 4. Cloud server 健康
print("\n--- Cloud Server ---")
try:
    r = urllib.request.urlopen('http://localhost:8000/api/latest', timeout=5)
    print(f'  localhost:8000 ✅ HTTP {r.status}')
except Exception as e:
    print(f'  localhost:8000 ❌ {e}')

try:
    r = urllib.request.urlopen('https://ide.zhejiangjinmo.com/api/latest', timeout=5)
    d = json.loads(r.read())
    print(f'  ide.zhejiangjinmo.com ✅ v{d["version"]}')
except Exception as e:
    print(f'  ide.zhejiangjinmo.com ❌ {e}')

# 5. 检查最近错误日志
print("\n--- 最近PM2错误 (最后5行) ---")
for svc, name in [(7, 'cloud-server'), (3, 'update-server'), (4, 'lingjing-update-server')]:
    logfile = f'/root/.pm2/logs/{name}-error.log'
    if os.path.exists(logfile):
        with open(logfile) as f:
            lines = f.readlines()
            recent = [l for l in lines[-20:] if 'ERROR' in l.upper() or 'error' in l.lower() or 'fail' in l.lower() or 'crash' in l.lower()]
            if recent:
                print(f'  {name}: {len(recent)} recent errors')
                for l in recent[-3:]:
                    print(f'    {l.strip()[:120]}')
            else:
                print(f'  {name}: clean')

# 6. 检查 versions.json 完整性
print("\n--- versions.json 路径检查 ---")
paths = [
    '/var/www/html/versions.json',
    '/var/www/downloads/versions.json', 
    '/var/www/lingjing/versions.json',
    '/opt/lingjing/update-server/versions.json',
    '/var/www/update-server/data/versions.json',
]
for p in paths:
    if os.path.exists(p):
        with open(p) as f:
            d = json.load(f)
        latest = d.get('latest', '?')
        vcount = len(d.get('versions', []))
        print(f'  ✅ {p.split("/")[-3]}/{p.split("/")[-2]}/{p.split("/")[-1]}: latest={latest}, {vcount} versions')

print("\n巡检完毕")
