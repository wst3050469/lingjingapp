import json, os

path = '/var/www/html/versions.json'
with open(path, 'r') as f:
    data = json.load(f)

android_entry = {
    'url': 'lingjing-mobile-v1.52.7.apk',
    'size': 81475650
}

# 1. Update the v1.52.7 version entry
for v in data['versions']:
    if v['version'] == '1.52.7':
        if 'files' not in v:
            v['files'] = {}
        v['files']['android'] = android_entry
        break

# 2. Update the top-level files
if 'files' not in data:
    data['files'] = {}
data['files']['android'] = android_entry

with open(path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('versions.json updated successfully')
