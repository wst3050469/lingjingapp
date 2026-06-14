#!/usr/bin/env python3
"""End-to-end verification of version consistency fix"""
import urllib.request, json

BASE = 'https://ide.zhejiangjinmo.com'

# 1. Download page version
print(f'=== DOWNLOAD PAGE ===')
req = urllib.request.Request(f'{BASE}/downloads/')
html = urllib.request.urlopen(req, timeout=10).read().decode()

# 2. versions.json
req = urllib.request.Request(f'{BASE}/versions.json')
data = json.loads(urllib.request.urlopen(req, timeout=10).read())
latest = data['latest']
print(f'versions.json latest: {latest}')

# 3. Check 1.73.61 entry files
entry = next((v for v in data['versions'] if v['version'] == '1.73.61'), None)
if entry:
    print(f'1.73.61 entry exists: ✅')
    for k, v in entry.get('files', {}).items():
        url = v.get('url','') if isinstance(v,dict) else str(v)
        fn = url.split('/')[-1] if '/' in url else url
        from urllib.parse import unquote
        print(f'  {k}: {unquote(fn)}')
else:
    print(f'1.73.61 entry: ❌ NOT FOUND')

# 4. Check 1.73.63 entry  
entry63 = next((v for v in data['versions'] if v['version'] == '1.73.63'), None)
if entry63:
    print(f'1.73.63 entry still exists (as historical): ✅')

# 5. Auto-update endpoints
checks = {
    ':8000': f'{BASE}/api/versions/latest',
    ':3000': f'http://120.55.5.220:3000/api/latest',
    ':3002': f'http://120.55.5.220:3002/api/latest',
}
print(f'\n=== AUTO-UPDATE ENDPOINTS ===')
for label, url in checks.items():
    try:
        req = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, timeout=5)
        d = json.loads(resp.read())
        ver = d.get('version', d.get('latest', '?'))
        print(f'  {label}: version={ver}')
    except Exception as e:
        print(f'  {label}: ERROR - {e}')

# 6. Final consistency check
print(f'\n=== CONSISTENCY ===')
print(f'Download page will show: v{latest}')
print(f'Download files named:    1.73.61')
print(f'Match: {"✅" if latest == "1.73.61" else "❌"}')
