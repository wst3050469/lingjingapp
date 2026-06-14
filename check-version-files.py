#!/usr/bin/env python3
"""Check 1.73.63 entry in versions.json for actual file URLs"""
import urllib.request, json

req = urllib.request.Request('https://ide.zhejiangjinmo.com/versions.json')
data = json.loads(urllib.request.urlopen(req, timeout=10).read())

# Find 1.73.63 entry
entry = next((v for v in data.get('versions', []) if v['version'] == '1.73.63'), None)
if entry:
    print(f'=== v{entry["version"]} ===')
    print(f'releaseDate: {entry.get("releaseDate")}')
    print(f'status: {entry.get("status")}')
    print(f'\nfiles:')
    files = entry.get('files', {})
    for k, v in files.items():
        url = v.get('url', '') if isinstance(v, dict) else str(v)
        # Extract filename from URL
        from urllib.parse import unquote
        fn = unquote(url.split('/')[-1]) if '/' in url else url
        size_mb = ''
        if isinstance(v, dict) and v.get('size'):
            size_mb = f' ({v["size"]/1024/1024:.0f} MB)'
        print(f'  {k}: {fn}{size_mb}')
        
    # Check if file names contain version
    print(f'\n=== Version in filenames ===')
    for k, v in files.items():
        url = v.get('url', '') if isinstance(v, dict) else str(v)
        fn = url.split('/')[-1] if '/' in url else url
        # Check if 1.73.63 appears in filename
        has_17363 = '1.73.63' in fn
        has_17361 = '1.73.61' in fn
        print(f'  {k}: 1.73.63? {has_17363} | 1.73.61? {has_17361} | {fn}')
else:
    print('ERROR: v1.73.63 entry not found!')
    
# Also check what files actually exist on the server
print(f'\n=== Actual files on server ===')
import subprocess
r = subprocess.run(['ls', '-lh', '/var/www/downloads/'], capture_output=True, text=True)
for line in r.stdout.split('\n'):
    if '1.73' in line or 'LingJing' in line or 'Setup' in line or '.exe' in line or 'AppImage' in line or '.deb' in line or '.apk' in line:
        print(f'  {line.strip()}')
