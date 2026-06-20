import json, os, hashlib
from datetime import date

base = '/var/www/downloads/v1.73.131'
ver = '1.73.131'
key_map = {}

# Map by key pattern
for f in os.listdir(base):
    path = os.path.join(base, f)
    size = os.path.getsize(path)
    sha = hashlib.sha512(open(path, 'rb').read()).hexdigest()
    url = f'/downloads/v1.73.131/{f}'
    
    if 'blockmap' in f:
        key_map['win-x64_blockmap'] = (url, size, sha)
    elif 'Setup' in f and 'blockmap' not in f:
        key_map['win-x64_setup'] = (url, size, sha)
    elif 'Portable' in f:
        key_map['win-x64_portable'] = (url, size, sha)
    elif 'AppImage' in f:
        key_map['linux-x64_appimage'] = (url, size, sha)
    elif '.deb' in f:
        key_map['linux-x64_deb'] = (url, size, sha)
    elif '.apk' in f:
        key_map['android'] = (url, size, sha)

files = {}
expected_order = ['win-x64_setup', 'win-x64_portable', 'win-x64_blockmap', 'linux-x64_appimage', 'linux-x64_deb', 'android']
for k in expected_order:
    if k in key_map:
        url, size, sha = key_map[k]
        files[k] = {'url': url, 'size': size, 'sha512': sha}
        print(f'  {k}: {size} bytes')

print(f'\nTotal: {len(files)} platforms')

with open('/var/www/downloads/versions.json', 'r') as fh:
    data = json.load(fh)

data['versions'].insert(0, {
    'version': ver,
    'status': 'published',
    'releaseDate': str(date.today()),
    'releaseNotes': f'v{ver}: downloads.js ReferenceError hotfix (page was stuck on v1.73.120)',
    'files': files
})
data['latest'] = ver

for path in ['/var/www/downloads/versions.json', '/var/www/html/versions.json']:
    with open(path, 'w') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

print(f'Saved: latest = {ver}')
